# Mo moi camera mot cua so PowerShell rieng, chay lenh live (spec ai-vision 3.5).
# Chay tu thu muc ai-vision:  powershell -ExecutionPolicy Bypass -File scripts\start-cameras.ps1
# Tuy chon: -Cameras H1-F0-CAMERA   -Heartbeat (chi khi backend da co /api/ai/heartbeat)
#           -DemoPredators (chi H1 phat V04, V05, V06, V07; so SHA-256 theo README truoc khi chay)
param(
    [ValidateSet('H1-F0-CAMERA', 'H2-F0-CAMERA')]
    [string[]]$Cameras = @('H1-F0-CAMERA', 'H2-F0-CAMERA'),
    [switch]$Heartbeat,
    [switch]$DemoPredators
)
$ErrorActionPreference = 'Stop'
$aiDir = Split-Path -Parent $PSScriptRoot
$python = Join-Path $aiDir '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    throw "Chua co $python - cai moi truong theo README truoc"
}
foreach ($cam in $Cameras) {
    $cmdArgs = "-m swiftletcare_ai live --camera $cam"
    if ($Heartbeat) { $cmdArgs = "$cmdArgs --heartbeat" }
    if ($DemoPredators -and $cam -eq 'H1-F0-CAMERA') {
        $cmdArgs = "$cmdArgs --playlist data/videos/V04.mp4 data/videos/V05.mp4 data/videos/V06.mp4 data/videos/V07.mp4"
    }
    $quotedPython = $python.Replace("'", "''")
    # Interactive windows let the user stop each camera with Ctrl+C.
    Start-Process -FilePath 'powershell.exe' -WindowStyle Normal -WorkingDirectory $aiDir -ArgumentList @('-NoExit', '-Command', "& '$quotedPython' $cmdArgs")
    Write-Host "Da mo cua so cho $cam"
}
