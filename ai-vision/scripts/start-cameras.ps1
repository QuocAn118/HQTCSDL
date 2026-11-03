# Mo moi camera mot cua so PowerShell rieng, chay lenh live (spec ai-vision 3.5).
# Chay tu thu muc ai-vision:  powershell -ExecutionPolicy Bypass -File scripts\start-cameras.ps1
# Tuy chon: -Cameras H1-F0-CAMERA   -Heartbeat (chi khi backend da co /api/ai/heartbeat)
param(
    [ValidateSet('H1-F0-CAMERA', 'H2-F0-CAMERA')]
    [string[]]$Cameras = @('H1-F0-CAMERA', 'H2-F0-CAMERA'),
    [switch]$Heartbeat
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
    $quotedPython = $python.Replace("'", "''")
    # Interactive windows let the user stop each camera with Ctrl+C.
    Start-Process -FilePath 'powershell.exe' -WindowStyle Normal -WorkingDirectory $aiDir -ArgumentList @('-NoExit', '-Command', "& '$quotedPython' $cmdArgs")
    Write-Host "Da mo cua so cho $cam"
}
