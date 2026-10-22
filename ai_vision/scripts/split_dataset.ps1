$ErrorActionPreference='Stop'
$base=(Resolve-Path (Join-Path $PSScriptRoot '../data/working/sourced_v1')).Path
$out=[IO.Path]::GetFullPath((Join-Path $base '../split_v1'))
if (Test-Path -LiteralPath $out) { throw 'Output already exists; refusing overwrite' }
$rows=@(Import-Csv -LiteralPath (Join-Path $base 'image_review.csv'))
$rng=[Random]::new(20261022)
foreach ($row in $rows) {
    $stem=[IO.Path]::GetFileName($row.image) -replace '\.rf\..*$','' -replace '(?i)_(jpg|jpeg|png)$',''
    $kind='original_name'
    $key=$stem.ToLowerInvariant()
    if ($stem -match '(?i)^(.*?)[_-](?:mp4|avi|mov)[_-]?\d+') {
        $key=($matches[1] -replace '(?i)(?:[-_]1[-_]?)$','').ToLowerInvariant(); $kind='video_filename'
    } elseif ($row.source_group -eq 'swiftlet' -and $stem -match '^(.*?)[_-]\d+$') {
        $key=$matches[1].ToLowerInvariant(); $kind='swiftlet_sequence_filename'
    } elseif ($row.source_group -eq 'swiftlet' -and $stem -match '(?i)^LBS\d+$') {
        $key='lbs_photo_sequence'; $kind='conservative_photo_sequence'
    }
    $row | Add-Member -NotePropertyName split_group -NotePropertyValue ($row.source_group+':'+$key)
    $row | Add-Member -NotePropertyName grouping_method -NotePropertyValue $kind
}
# Subset-sum assigns whole groups, selecting counts closest to each class target.
function Select-WholeGroups($groups,$target) {
    $plans=@{0=@()}
    foreach ($group in ($groups | Sort-Object { $rng.Next() })) {
        foreach ($sum in @($plans.Keys | Sort-Object -Descending)) {
            $next=[int]$sum+$group.Count
            if (!$plans.ContainsKey($next)) { $plans[$next]=@($plans[$sum])+@($group.Name) }
        }
    }
    $best=$plans.Keys | Where-Object { $_ -gt 0 } | Sort-Object @{Expression={[Math]::Abs($_-$target)}},@{Expression={$_}} | Select-Object -First 1
    return $plans[$best]
}
$counts=@()
foreach ($class in @('owl','rat','snake','swiftlet')) {
    $items=@($rows | Where-Object source_group -eq $class)
    $groups=@($items | Group-Object split_group | Sort-Object Name)
    $target=[int][Math]::Round($items.Count*.1)
    $test=@(Select-WholeGroups $groups $target)
    $rest=@($groups | Where-Object Name -notin $test)
    $val=@(Select-WholeGroups $rest $target)
    foreach ($row in $items) {
        $row.proposed_split=if ($row.split_group -in $test) {'test'} elseif ($row.split_group -in $val) {'val'} else {'train'}
    }
    $counts += [pscustomobject]@{class=$class;total=$items.Count;train=@($items | Where-Object proposed_split -eq train).Count;val=@($items | Where-Object proposed_split -eq val).Count;test=@($items | Where-Object proposed_split -eq test).Count;groups=$groups.Count}
}
if (@($rows | Group-Object split_group | Where-Object { @($_.Group.proposed_split | Sort-Object -Unique).Count -ne 1 }).Count) { throw 'Group leakage' }
if (@($rows | Group-Object sha256 | Where-Object Count -gt 1).Count) { throw 'Duplicate hashes' }
foreach ($split in @('train','val','test')) {
    New-Item -ItemType Directory -Path "$out/$split/images","$out/$split/labels" | Out-Null
}
$manifest=@()
foreach ($row in $rows) {
    $src=Join-Path $base $row.image
    $srcLabel=Join-Path (Join-Path ([IO.Directory]::GetParent([IO.Path]::GetDirectoryName($src)).FullName) 'labels') ([IO.Path]::GetFileNameWithoutExtension($src)+'.txt')
    $file=$row.source_group+'_'+[IO.Path]::GetFileName($src)
    $dest="$($row.proposed_split)/images/$file"
    $destLabel="$($row.proposed_split)/labels/$([IO.Path]::GetFileNameWithoutExtension($file)).txt"
    if (Test-Path -LiteralPath (Join-Path $out $dest)) { throw 'Filename collision' }
    Copy-Item -LiteralPath $src -Destination (Join-Path $out $dest)
    Copy-Item -LiteralPath $srcLabel -Destination (Join-Path $out $destLabel)
    $manifest += [pscustomobject]@{image=$dest;label=$destLabel;split=$row.proposed_split;class=$row.source_group;source_id=$row.source_id;split_group=$row.split_group;grouping_method=$row.grouping_method;original_image=$row.image;sha256=$row.sha256;objects=$row.objects}
}
$manifest | Export-Csv -LiteralPath "$out/split_manifest.csv" -NoTypeInformation -Encoding UTF8
$counts | Export-Csv -LiteralPath "$out/class_counts.csv" -NoTypeInformation -Encoding UTF8
@(('path: "'+$out.Replace('\','/')+'"'),'train: train/images','val: val/images','test: test/images','nc: 4','names: [owl, rat, snake, swiftlet]') | Set-Content -LiteralPath "$out/data.yaml" -Encoding UTF8
$verified=0
foreach ($record in $manifest) {
    $actual=(Get-FileHash -LiteralPath (Join-Path $out $record.image) -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $record.sha256) { throw 'Copied image hash mismatch' }
    if (!(Test-Path -LiteralPath (Join-Path $out $record.label))) { throw 'Missing copied label' }
    $verified++
}
$summary=[ordered]@{date='2026-10-22';seed=20261022;input='sourced_v1';images=$rows.Count;ratio_target=@{train=.8;val=.1;test=.1};classes=$counts;verification=@{image_hashes_verified=$verified;group_overlap=0;duplicate_hashes=0};grouping='Original filename without Roboflow suffix; explicit video prefix; swiftlet numbered sequence; LBS photo sequence kept together';limitations='Filename-based grouping cannot prove absence of visually similar scenes or videos exported under different names.'}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$out/split_summary.json" -Encoding UTF8
$rows | Export-Csv -LiteralPath "$base/image_review.csv" -NoTypeInformation -Encoding UTF8
$manifest | Select-Object class,split,split_group,image,source_id | Export-Csv -LiteralPath (Join-Path $PSScriptRoot '../splits.csv') -NoTypeInformation -Encoding UTF8
$summary | ConvertTo-Json -Depth 8
