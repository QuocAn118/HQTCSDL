# Tat DUNG cac tien trinh do start-demo.ps1 / ai-now.ps1 mo (theo PID + gio bat dau da ghi), xoa ban sao .env.
# Khong tat tien trinh nao khac cua may (khong tat theo ten 'node', 'python'...).
# Chay tu goc repo:  powershell -ExecutionPolicy Bypass -File demo\stop-demo.ps1
. (Join-Path $PSScriptRoot 'lib.ps1')

$killedAi = $false
if (Test-Path $StateFile) {
    $rows = @(Get-Content $StateFile | Where-Object { $_ })
    [array]::Reverse($rows)  # tat nguoc thu tu bat: web, backend, simulator, mosquitto
    foreach ($row in $rows) {
        $name, $id, $start = $row -split '\|'
        $p = Get-Process -Id $id -ErrorAction SilentlyContinue
        if (-not $p) { Write-Host "$name (PID $id): da tat tu truoc"; continue }
        if ($p.StartTime.ToString('o') -ne $start) { Write-Warning "$name (PID $id): PID da thuoc tien trinh khac, KHONG tat"; continue }
        & taskkill.exe /PID $id /T /F | Out-Null
        Write-Host "$name (PID $id): da tat ca cay tien trinh"
        if ($name -eq 'ai') { $killedAi = $true }
    }
    Remove-Quiet $StateFile
} else {
    Write-Host "Khong co ${StateFile}: khong co tien trinh nao do demo bat."
}

# AI bi tat cung thi file khoa con lai; chi xoa khi chinh script nay vua tat tien trinh AI do ai-now.ps1 mo.
$lock = Join-Path $Repo 'ai-vision\data\run\H1-F0-CAMERA.lock'
if ($killedAi -and (Test-Path $lock)) { Remove-Quiet $lock; Write-Host 'Da xoa khoa ai-vision/data/run/H1-F0-CAMERA.lock' }

Remove-Quiet $BackendEnvCopy
if ([IO.Directory]::Exists($StateDir)) {
    foreach ($pat in 'payload-*.json', 'cmd-*.txt', 'hot-*.flag', 'predator-*.*', 'first-reading.txt') { foreach ($f in [IO.Directory]::GetFiles($StateDir, $pat)) { Remove-Quiet $f } }
}
if (Test-Path $BackendEnvCopy) { Write-Warning "Chua xoa duoc $BackendEnvCopy" } else { Write-Host 'Da xoa ban sao backend .env' }
foreach ($port in 1883, 3000, 3001) { if (Test-Port $port) { Write-Host "Cong $port van co tien trinh nghe (khong do demo bat, hoac chua tat xong)" } }
