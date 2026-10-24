param(
    [string]$Base = (Join-Path $PSScriptRoot '../data/working/sourced_v3'),
    [string]$Out = (Join-Path $PSScriptRoot '../data/working/split_v3'),
    [string]$SplitsPath = (Join-Path $PSScriptRoot '../splits.csv')
)
$ErrorActionPreference = 'Stop'
$base = (Resolve-Path -LiteralPath $Base).Path
$out = [IO.Path]::GetFullPath($Out)
if (Test-Path -LiteralPath $out) { throw 'Output already exists; refusing overwrite' }
$rows = @(Import-Csv -LiteralPath (Join-Path $base 'image_review.csv'))
if (!$rows.Count) { throw 'Empty input manifest' }
$mapping = @{}
foreach ($record in @(Import-Csv -LiteralPath $SplitsPath)) {
    if (!$record.nguon -or $record.tap -cnotin @('train','val','test')) { throw 'Invalid split mapping: expected nguon,tap' }
    if ($mapping.ContainsKey($record.nguon)) { throw "Duplicate source: $($record.nguon)" }
    $mapping[$record.nguon] = $record.tap
}
$manifest = @()
$destinations = @{}
foreach ($row in $rows) {
    if (!$row.source_id -or !$mapping.ContainsKey($row.source_id)) { throw "Unknown source: $($row.source_id)" }
    if ($row.source_id -notmatch '^[A-Za-z][A-Za-z0-9]*$') { throw 'Invalid source code' }
    if ($row.source_group -notin @('owl','rat','snake','swiftlet')) { throw 'Unknown class' }
    $src = [IO.Path]::GetFullPath((Join-Path $base $row.image))
    if (!$src.StartsWith($base.TrimEnd('\')+'\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Image outside input directory' }
    $srcLabel = Join-Path (Join-Path ([IO.Directory]::GetParent([IO.Path]::GetDirectoryName($src)).FullName) 'labels') ([IO.Path]::GetFileNameWithoutExtension($src)+'.txt')
    if (!(Test-Path -LiteralPath $src) -or !(Test-Path -LiteralPath $srcLabel)) { throw "Missing image or label: $($row.image)" }
    $hash = (Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne $row.sha256) { throw "Input image hash mismatch: $($row.image)" }
    $split = $mapping[$row.source_id]
    $file = $row.source_id+'_'+[IO.Path]::GetFileName($src)
    $dest = "$split/images/$file"
    if ($destinations.ContainsKey($dest)) { throw "Filename collision: $dest" }
    $destinations[$dest] = $true
    $manifest += [pscustomobject]@{
        image=$dest; label="$split/labels/$([IO.Path]::GetFileNameWithoutExtension($file)).txt"
        split=$split; class=$row.source_group; source_id=$row.source_id
        split_group=$row.source_id; grouping_method='source_id'
        original_image=$row.image; sha256=$hash; objects=$row.objects
    }
}
foreach ($source in $mapping.Keys) {
    if ($manifest.source_id -notcontains $source) { throw "Mapped source has no input images: $source" }
}
foreach ($class in @('owl','rat','snake','swiftlet')) {
    $items = @($manifest | Where-Object class -eq $class)
    $sources = @($items.source_id | Sort-Object -Unique)
    if ($sources.Count -eq 1 -and @($items | Where-Object split -ne train).Count) {
        throw "Single-source class must remain in train: $class"
    }
}
if (@($manifest | Group-Object sha256 | Where-Object Count -gt 1).Count) { throw 'Duplicate hashes' }
if (@($manifest | Group-Object source_id | Where-Object { @($_.Group.split | Sort-Object -Unique).Count -ne 1 }).Count) { throw 'Source leakage' }
foreach ($split in @('train','val','test')) {
    New-Item -ItemType Directory -Path "$out/$split/images","$out/$split/labels" | Out-Null
}
foreach ($record in $manifest) {
    $src = Join-Path $base $record.original_image
    $label = Join-Path (Join-Path ([IO.Directory]::GetParent([IO.Path]::GetDirectoryName($src)).FullName) 'labels') ([IO.Path]::GetFileNameWithoutExtension($src)+'.txt')
    Copy-Item -LiteralPath $src -Destination (Join-Path $out $record.image)
    Copy-Item -LiteralPath $label -Destination (Join-Path $out $record.label)
    if ((Get-FileHash -LiteralPath (Join-Path $out $record.image) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.sha256) { throw 'Copied image hash mismatch' }
    if ((Get-FileHash -LiteralPath $label).Hash -ne (Get-FileHash -LiteralPath (Join-Path $out $record.label)).Hash) { throw 'Copied label hash mismatch' }
}
$counts = foreach ($class in @('owl','rat','snake','swiftlet')) {
    $items = @($manifest | Where-Object class -eq $class)
    [pscustomobject]@{class=$class; total=$items.Count; train=@($items | Where-Object split -eq train).Count; val=@($items | Where-Object split -eq val).Count; test=@($items | Where-Object split -eq test).Count; sources=@($items.source_id | Sort-Object -Unique).Count}
}
$manifest | Export-Csv -LiteralPath "$out/split_manifest.csv" -NoTypeInformation -Encoding UTF8
$counts | Export-Csv -LiteralPath "$out/class_counts.csv" -NoTypeInformation -Encoding UTF8
$sourceCounts = $manifest | Group-Object source_id | ForEach-Object { [pscustomobject]@{source_id=$_.Name; split=$_.Group[0].split; images=$_.Count} }
$sourceCounts | Export-Csv -LiteralPath "$out/source_counts.csv" -NoTypeInformation -Encoding UTF8
@(('path: "'+$out.Replace('\','/')+'"'),'train: train/images','val: val/images','test: test/images','nc: 4','names: [owl, rat, snake, swiftlet]') | Set-Content -LiteralPath "$out/data.yaml" -Encoding UTF8
$summary = [ordered]@{
    images=$manifest.Count; grouping='source_id: entire original dataset or video'
    classes=@($counts); sources=@($sourceCounts)
    verification=@{image_hashes_verified=$manifest.Count; label_hashes_verified=$manifest.Count; source_overlap=0; duplicate_hashes=0}
    no_val_classes=@($counts | Where-Object val -eq 0 | Select-Object -ExpandProperty class)
    no_test_classes=@($counts | Where-Object test -eq 0 | Select-Object -ExpandProperty class)
    limitations='Classes listed in no_val_classes or no_test_classes lack independent evaluation data. Do not report aggregate four-class evaluation without coverage of all classes.'
}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$out/split_summary.json" -Encoding UTF8
$summary | ConvertTo-Json -Depth 8
