# Bat he thong demo theo checklist spec backend 7.4: Mosquitto -> simulator (normal) -> backend -> web.
# Chay tu goc repo:  powershell -ExecutionPolicy Bypass -File demo\start-demo.ps1 [-SkipAi]
# Backend chay voi BAN SAO backend/.env trong %TEMP%\swiftletcare-demo (DEMO_TOOLS=true); .env that khong bi sua.
# Khong in mat khau hay khoa. Tat bang demo\stop-demo.ps1.
param([switch]$SkipAi)
. (Join-Path $PSScriptRoot 'lib.ps1')

function Step([string]$msg) { Write-Host ("[{0}] {1}" -f (Get-Date).ToString('HH:mm:ss'), $msg) }

# 0. Kiem truoc
if (Test-Path $StateFile) { throw "Da co ${StateFile}: demo dang chay hoac lan truoc chua tat. Chay demo\stop-demo.ps1 truoc." }
foreach ($p in 3000, 3001) { if (Test-Port $p) { throw "Cong $p dang bi chiem. Tat tien trinh do (hoac demo\stop-demo.ps1) roi chay lai." } }
$sims = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'src[\\/]main\.mjs' }
if ($sims) { throw 'Da co simulator dang chay (node src/main.mjs). Chi duoc chay mot simulator tren mot broker.' }
$benv = Read-EnvFile (Join-Path $Repo 'backend\.env')
if ($benv.DB_NAME -notmatch '_Dev$') { throw "backend/.env co DB_NAME=$($benv.DB_NAME): bo demo nay chi chay tren CSDL _Dev." }
foreach ($k in 'AI_SERVICE_KEY', 'MQTT_PASSWORD', 'JWT_SECRET') { if (-not $benv[$k]) { throw "Thieu $k trong backend/.env" } }
$mqtt = Get-SimMqtt
if (-not $mqtt.Password) { throw 'Thieu MQTT_PASSWORD trong simulator/.env' }
if (-not (Test-Path (Join-Path $Repo 'web\.env.local'))) { throw 'Thieu web/.env.local (chep tu web/.env.example)' }

# 1. Mosquitto
if (Test-Port 1883) {
    Step 'Mosquitto: cong 1883 da co broker, dung lai broker nay (stop-demo se KHONG tat no).'
} else {
    Step 'Mosquitto: bat infra/mosquitto/mosquitto.conf'
    Start-Tracked 'mosquitto' $Repo "& '$Mosquitto\mosquitto.exe' -c infra/mosquitto/mosquitto.conf -v" | Out-Null
    $end = (Get-Date).AddSeconds(15)
    while (-not (Test-Port 1883) -and (Get-Date) -lt $end) { Start-Sleep -Milliseconds 300 }
    if (-not (Test-Port 1883)) { throw 'Mosquitto khong nghe cong 1883 sau 15 giay' }
}

# 2. Simulator truoc backend (du lieu mau co LastSeenAt cu)
Step 'Simulator: npm start (kich ban normal), ngung rieng H1-F2-SENSOR (--drop) de demo qua nhiet khong bi so do simulator de len'
New-Item -ItemType Directory -Force $StateDir | Out-Null
Start-Tracked 'simulator' (Join-Path $Repo 'simulator') 'npm start -- --drop H1-F2-SENSOR --drop-after 0 --drop-for 600' | Out-Null
$out = Join-Path $StateDir 'first-reading.txt'
$sub = Start-Process "$Mosquitto\mosquitto_sub.exe" -ArgumentList @('-h', $mqtt.Host, '-p', $mqtt.Port, '-u', $mqtt.User, '-P', $mqtt.Password, '-t', 'swiftlet/devices/+/readings', '-C', '1', '-W', '30') -RedirectStandardOutput $out -NoNewWindow -PassThru
$sub.WaitForExit()
if (-not (Get-Content $out -ErrorAction SilentlyContinue)) { throw 'Simulator chua gui so do nao sau 30 giay (xem cua so demo: simulator)' }
Step 'Simulator: da thay so do dau tien tren broker'
Step 'Zone-keeper: giu nhip so do H1-F2 moi 10 giay (demo/zone-keeper.ps1)'
$q = (Join-Path $PSScriptRoot 'zone-keeper.ps1').Replace("'", "''")
Start-Tracked 'keeper' $Repo "& '$q'" | Out-Null

# 3. Backend voi ban sao .env (DEMO_TOOLS=true)
$lines = Get-Content (Join-Path $Repo 'backend\.env') | Where-Object { $_ -notmatch '^\s*DEMO_TOOLS\s*=' }
Set-Content -Path $BackendEnvCopy -Value ($lines + 'DEMO_TOOLS=true') -Encoding ascii
if (-not (Test-Path (Join-Path $Repo 'backend\dist\main.js'))) {
    Step 'Backend: chua co dist, npm run build'
    Push-Location (Join-Path $Repo 'backend'); npm run build | Out-Null; $code = $LASTEXITCODE; Pop-Location
    if ($code -ne 0) { throw 'npm run build backend loi' }
}
Step 'Backend: node dist/main.js (DEMO_TOOLS=true, ban sao .env)'
Start-Tracked 'backend' (Join-Path $Repo 'backend') "`$env:ENV_FILE='$BackendEnvCopy'; node dist/main.js" | Out-Null
if (-not (Wait-Http "http://localhost:$($benv.PORT)/api/health" 120 '"db":"ok"')) { throw 'Backend chua bao health db=ok sau 120 giay (xem cua so demo: backend)' }
Step 'Backend: health ok'

# 4. Web: next build roi next start -p 3001
Step 'Web: npm run build (khoang 1-2 phut)'
Push-Location (Join-Path $Repo 'web'); npm run build *> (Join-Path $StateDir 'web-build.log'); $code = $LASTEXITCODE; Pop-Location
if ($code -ne 0) { throw "next build loi, xem $StateDir\web-build.log" }
Start-Tracked 'web' (Join-Path $Repo 'web') 'npm start' | Out-Null
if (-not (Wait-Http 'http://localhost:3001/login' 60)) { throw 'Web chua tra /login sau 60 giay (xem cua so demo: web)' }
Step 'Web: http://localhost:3001 san sang'

# 5. AI (khong bat o day: bat o moc 2:30 bang demo\ai-now.ps1 de canh bao khong ra som va khong dinh cooldown)
if (-not $SkipAi) {
    $ai = Join-Path $Repo 'ai-vision'
    $miss = @()
    if (-not (Test-Path "$ai\.venv\Scripts\python.exe")) { $miss += '.venv' }
    if (-not (Test-Path "$ai\data\weights\best.pt")) { $miss += 'data/weights/best.pt' }
    foreach ($v in 'V05.mp4', 'V06.mp4') { if (-not (Test-Path "$ai\data\videos\$v")) { $miss += "data/videos/$v" } }
    if ($miss) { Write-Warning ("AI thieu: " + ($miss -join ', ') + ' -> o moc 2:30 dung demo\predator-now.ps1') }
    else { Step 'AI: du file. Moc 2:30 chay demo\ai-now.ps1 (tu so SHA-256 truoc khi mo).' }
}

Write-Host ''
Write-Host 'SAN SANG. Mo trinh duyet:'
Write-Host '  Tab 1 (owner1): http://localhost:3001  -> Tong quan nha H1; mo san tab Lich su de bang thong ke 7 ngay tai xong'
Write-Host '  Tab 2 (admin, cua so an danh rieng): http://localhost:3001/admin/tools  (khong doi tai khoan trong tab nay)'
Write-Host '  Mat khau: theo database/README.md (khong in o day)'
Write-Host 'Lenh theo kich ban (demo\README.md):'
Write-Host '  1:15  powershell -ExecutionPolicy Bypass -File demo\hot-now.ps1'
Write-Host '  2:30  powershell -ExecutionPolicy Bypass -File demo\ai-now.ps1     (du phong: demo\predator-now.ps1)'
Write-Host '  3:30  powershell -ExecutionPolicy Bypass -File demo\run-sql.ps1'
Write-Host '  Xong: powershell -ExecutionPolicy Bypass -File demo\stop-demo.ps1'
