# Moc 2:30: bat AI that cho H1-F0-CAMERA, playlist V05 (ran) -> V06 (cu), co heartbeat, trong cua so rieng.
# Truoc khi mo: kiem .venv, best.pt va SHA-256 cua V05/V06 voi ai-vision/results/video-freeze-2026-11-05.json.
# Sai hash hoac thieu file -> dung, dung demo\predator-now.ps1. Tat bang demo\stop-demo.ps1 (hoac Ctrl+C trong cua so AI).
# Chay tu goc repo:  powershell -ExecutionPolicy Bypass -File demo\ai-now.ps1
. (Join-Path $PSScriptRoot 'lib.ps1')

$ai = Join-Path $Repo 'ai-vision'
$python = Join-Path $ai '.venv\Scripts\python.exe'
foreach ($f in $python, (Join-Path $ai 'data\weights\best.pt')) { if (-not (Test-Path $f)) { throw "Thieu $f -> dung demo\predator-now.ps1" } }
$freeze = Get-Content (Join-Path $ai 'results\video-freeze-2026-11-05.json') -Raw | ConvertFrom-Json
foreach ($name in 'V05.mp4', 'V06.mp4') {
    $path = Join-Path $ai "data\videos\$name"
    if (-not (Test-Path $path)) { throw "Thieu $path -> dung demo\predator-now.ps1" }
    $hash = (Get-FileHash $path -Algorithm SHA256).Hash.ToLower()
    if ($hash -ne $freeze.videos.$name) { throw "$name SAI SHA-256 so voi video-freeze -> khong chay, dung demo\predator-now.ps1" }
    Write-Host "$name khop SHA-256"
}
if (Test-Path (Join-Path $ai 'data\run\H1-F0-CAMERA.lock')) { throw 'Da co khoa data/run/H1-F0-CAMERA.lock: AI H1 dang chay, hoac lan truoc bi tat cung (xem ai-vision/README.md)' }
$q = $python.Replace("'", "''")
Start-Tracked 'ai' $ai "& '$q' -m swiftletcare_ai live --camera H1-F0-CAMERA --heartbeat --playlist data/videos/V05.mp4 data/videos/V06.mp4" | Out-Null
Write-Host 'Da mo cua so AI H1-F0-CAMERA (V05 -> V06). Cho canh bao hien tren web; cung camera + cung lop chi 1 canh bao moi 5 phut.'
