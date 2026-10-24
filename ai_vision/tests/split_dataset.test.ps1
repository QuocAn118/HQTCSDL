$ErrorActionPreference = 'Stop'
$ai = Split-Path $PSScriptRoot -Parent
$script = Join-Path $ai 'scripts/split_dataset.ps1'
$mapping = @(Import-Csv (Join-Path $ai 'splits.csv'))
if ($mapping.Count -ne 5 -or @($mapping | Group-Object nguon | Where-Object Count -ne 1).Count -or
    @($mapping | Where-Object { $_.tap -notin @('train','val','test') }).Count) {
    throw 'Regression: splits.csv must contain one nguon,tap row per source, not image groups'
}
$temp = Join-Path ([IO.Path]::GetTempPath()) ('swiftlet-split-test-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $temp | Out-Null
try {
    $base = Join-Path $temp 'input'
    $rows = @()
    foreach ($item in @(@('R01','swiftlet','train','same'), @('R01','swiftlet','test','other'),
        @('R05','swiftlet','train','same'), @('R02','rat','valid','rat'),
        @('R03','snake','test','snake'), @('R04','owl','train','owl'))) {
        $dir = Join-Path $base ($item[2] + '/images')
        $labels = Join-Path $base ($item[2] + '/labels')
        New-Item -ItemType Directory -Force -Path $dir,$labels | Out-Null
        $image = Join-Path $dir ($item[0] + '_' + $item[3] + '.jpg')
        [IO.File]::WriteAllText($image, ($item -join ':'))
        [IO.File]::WriteAllText((Join-Path $labels ([IO.Path]::GetFileNameWithoutExtension($image)+'.txt')), '0 0.5 0.5 0.1 0.1')
        $rows += [pscustomobject]@{image=($item[2]+'/images/'+[IO.Path]::GetFileName($image)); source_id=$item[0]; source_group=$item[1]; sha256=(Get-FileHash $image).Hash.ToLowerInvariant(); objects=1}
    }
    $review = Join-Path $base 'image_review.csv'
    $rows | Export-Csv $review -NoTypeInformation -Encoding UTF8
    $before = (Get-FileHash $review).Hash
    $out = Join-Path $temp 'output'
    & $script -Base $base -Out $out | Out-Null
    $manifest = @(Import-Csv (Join-Path $out 'split_manifest.csv'))
    if ($manifest.Count -ne 6) { throw 'All input images must be copied' }
    foreach ($row in $manifest) {
        $expected = ($mapping | Where-Object nguon -eq $row.source_id).tap
        if ($row.split -ne $expected -or $row.split_group -ne $row.source_id) { throw 'Source leakage' }
        if ([IO.Path]::GetFileName($row.image) -notlike ($row.source_id+'_*')) { throw 'Missing source prefix' }
        if ((Get-FileHash (Join-Path $out $row.image)).Hash.ToLowerInvariant() -ne $row.sha256) { throw 'Image changed' }
        if (!(Test-Path (Join-Path $out $row.label))) { throw 'Missing label' }
    }
    if ((Get-FileHash $review).Hash -ne $before) { throw 'Input review must remain unchanged' }
    $summary = Get-Content (Join-Path $out 'split_summary.json') -Raw | ConvertFrom-Json
    if ($summary.verification.source_overlap -ne 0 -or $summary.images -ne 6) { throw 'Incorrect summary' }
    if (($summary.no_val_classes -join ',') -ne 'owl,rat,snake' -or
        ($summary.no_test_classes -join ',') -ne 'owl,rat,snake,swiftlet') { throw 'Summary must report actual missing evaluation classes' }
    $failed = $false
    try { & $script -Base $base -Out $out | Out-Null } catch { $failed = $_.Exception.Message -match 'Output already exists' }
    if (!$failed) { throw 'Must refuse overwrite' }
    foreach ($case in @('unknown','duplicate','invalid','single-source')) {
        $bad = Join-Path $temp ($case+'.csv')
        $content = switch ($case) {
            'unknown' { "nguon,tap`nR01,train`n" }
            'duplicate' { "nguon,tap`nR01,train`nR01,val`n" }
            'invalid' { "nguon,tap`nR01,training`n" }
            'single-source' { "nguon,tap`nR01,train`nR05,val`nR02,test`nR03,train`nR04,train`n" }
        }
        [IO.File]::WriteAllText($bad, $content)
        $failed = $false
        $badOut = Join-Path $temp ($case+'-out')
        try { & $script -Base $base -Out $badOut -SplitsPath $bad | Out-Null } catch {
            $failed = $_.Exception.Message -match 'Unknown source|Duplicate source|Invalid split|Single-source class'
        }
        if (!$failed -or (Test-Path $badOut)) { throw "Invalid mapping accepted or output created: $case" }
    }
    Write-Output 'PASS: source mapping, whole-source copy, provenance, hashes, labels, immutable input, overwrite guard, unknown/duplicate/invalid/single-source rejection'
} finally {
    # Only remove the unique test directory created by this script.
    $resolved = [IO.Path]::GetFullPath($temp)
    if (!$resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()), [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($resolved) -notlike 'swiftlet-split-test-*') { throw 'Unsafe cleanup path' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
