# Du phong thien dich: POST /api/ai/predator-detections voi anh mau contracts/fixtures/ai/snake.jpg.
# X-Service-Key doc tu backend/.env (khong in). Backend chan lap: cung camera + cung lop trong +-5 phut -> COOLDOWN
# (luu trong CSDL, khoi dong lai backend KHONG xoa). Tap nhieu lan: doi -Class (snake, rat, owl), cho du 5 phut,
# hoac demo\reset-demo.ps1. Demo that: giu snake (anh la ran).
# Chay tu goc repo:  powershell -ExecutionPolicy Bypass -File demo\predator-now.ps1 [-Class snake] [-Camera H1-F0-CAMERA]
param(
    [ValidateSet('snake', 'rat', 'owl')][string]$Class = 'snake',
    [ValidateSet('H1-F0-CAMERA', 'H2-F0-CAMERA')][string]$Camera = 'H1-F0-CAMERA',
    [double]$Confidence = 0.87
)
. (Join-Path $PSScriptRoot 'lib.ps1')

$benv = Read-EnvFile (Join-Path $Repo 'backend\.env')
if (-not $benv.AI_SERVICE_KEY) { throw 'Thieu AI_SERVICE_KEY trong backend/.env' }
New-Item -ItemType Directory -Force $StateDir | Out-Null
$meta = Join-Path $StateDir 'predator-meta.json'
$inv = [Globalization.CultureInfo]::InvariantCulture
[IO.File]::WriteAllText($meta, '{"camera":"' + $Camera + '","class":"' + $Class + '","confidence":' + $Confidence.ToString($inv) + ',"at":"' + (Get-UtcSecond) + '"}')
$hdr = Join-Path $StateDir 'predator-hdr.txt'
[IO.File]::WriteAllText($hdr, "X-Service-Key: $($benv.AI_SERVICE_KEY)")  # qua file de khoa khong nam tren dong lenh
$img = Join-Path $Repo 'contracts\fixtures\ai\snake.jpg'
try {
    $res = & curl.exe -s -w '\n%{http_code}' -H "@$hdr" -F "metadata=<$meta" -F "image=@$img;type=image/jpeg" "http://localhost:$($benv.PORT)/api/ai/predator-detections"
} finally {
    Remove-Quiet $hdr; Remove-Quiet $meta
}
$code = $res[-1]
$body = ($res | Select-Object -SkipLast 1) -join ''
Write-Host "HTTP $code $body"
if ($body -match '"skipReason"\s*:\s*"COOLDOWN"') {
    Write-Warning "COOLDOWN: da co canh bao $Class cua $Camera trong 5 phut. Doi lop (-Class rat/owl) hoac cho 5 phut; khong sua CSDL bang tay."
}
