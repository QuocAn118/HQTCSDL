
$ErrorActionPreference = 'Stop'
$deploy = Join-Path $PSScriptRoot '..\scripts\deploy.ps1'
if (-not (Test-Path $deploy)) { Write-Host 'FAIL: chua co scripts/deploy.ps1'; exit 1 }

# Moi ten khong ket thuc _Test/_Dev phai bi tu choi voi ma 2, truoc khi doc .env hay goi SQL.
foreach ($name in @('SwiftletCare', 'SwiftletCare_Prod', 'Test', 'master', 'SwiftletCare_Testing')) {
    $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $deploy -Database $name -Reset 2>&1
    if ($LASTEXITCODE -ne 2) { Write-Host "FAIL: -Reset voi '$name' tra ma $LASTEXITCODE (mong 2). $out"; exit 1 }
}

# Ten chua ky tu la bi tu choi voi ma 3 (chong chen SQL vao ten CSDL).
$out = & powershell -NoProfile -ExecutionPolicy Bypass -File $deploy -Database 'x];DROP DATABASE master;--_Test' -Reset 2>&1
if ($LASTEXITCODE -ne 3) { Write-Host "FAIL: ten la tra ma $LASTEXITCODE (mong 3). $out"; exit 1 }

Write-Host 'deploy-guard: PASS'
exit 0
