
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib.ps1')

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'deploy.ps1') -Database 'SwiftletCare_Test' -Reset
if ($LASTEXITCODE -ne 0) { Write-Host 'Trien khai SwiftletCare_Test that bai'; exit 1 }

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'tests\deploy-guard.ps1')
if ($LASTEXITCODE -ne 0) { exit 1 }

$cfg = Read-DotEnv
$failed = @()
foreach ($f in (Get-ChildItem (Join-Path $Root 'tests') -Filter '*.test.sql' | Sort-Object Name)) {
    Write-Host "== $($f.Name)"
    try { Invoke-Sql -Cfg $cfg -Database 'SwiftletCare_Test' -File $f.FullName }
    catch { $failed += $f.Name }
}

if ($failed.Count -gt 0) {
    Write-Host "THAT BAI: $($failed -join ', ')"
    exit 1
}

Write-Host 'Tat ca test dat'
exit 0
