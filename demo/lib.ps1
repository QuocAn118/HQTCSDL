# Ham dung chung cho cac script demo. Khong in mat khau/khoa.
$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent $PSScriptRoot
$StateDir = Join-Path $env:TEMP 'swiftletcare-demo'
$StateFile = Join-Path $StateDir 'pids.txt'
$BackendEnvCopy = Join-Path $StateDir 'backend.env'
$Mosquitto = 'C:\Program Files\mosquitto'

function Read-EnvFile([string]$Path) {
    if (-not (Test-Path $Path)) { throw "Thieu $Path (chep tu .env.example roi dien gia tri)" }
    $vars = @{}
    foreach ($line in Get-Content $Path) {
        if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$') { $vars[$Matches[1]] = $Matches[2].Trim('"') }
    }
    return $vars
}

# Xoa file bang .NET: Remove-Item cua PowerShell 5.1 loi voi duong dan 8.3 (vd C:\Users\QUOCAN~1) cua %TEMP%.
function Remove-Quiet([string]$Path) { if ([IO.File]::Exists($Path)) { [IO.File]::Delete($Path) } }

function Test-Port([int]$Port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Wait-Http([string]$Url, [int]$Seconds, [string]$Contains = '') {
    $end = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $end) {
        try {
            $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $Url
            if ($r.StatusCode -eq 200 -and (-not $Contains -or $r.Content -like "*$Contains*")) { return $true }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

# Mo mot cua so PowerShell rieng, ghi PID + gio bat dau de stop-demo chi tat dung tien trinh nay.
function Start-Tracked([string]$Name, [string]$Dir, [string]$Command) {
    New-Item -ItemType Directory -Force $StateDir | Out-Null
    $full = "`$Host.UI.RawUI.WindowTitle = 'demo: $Name'; $Command"
    $p = Start-Process powershell.exe -WorkingDirectory $Dir -ArgumentList @('-NoExit', '-Command', $full) -PassThru
    Add-Content -Path $StateFile -Value "$Name|$($p.Id)|$($p.StartTime.ToString('o'))" -Encoding ascii
    return $p
}

# Thong so MQTT cua tai khoan simulator (simulator/.env): host, port, user, password.
function Get-SimMqtt {
    $e = Read-EnvFile (Join-Path $Repo 'simulator\.env')
    if ($e.MQTT_URL -notmatch '^mqtt://([^:/]+):(\d+)') { throw 'MQTT_URL trong simulator/.env phai co dang mqtt://host:port' }
    return @{ Host = $Matches[1]; Port = $Matches[2]; User = $e.MQTT_USERNAME; Password = $e.MQTT_PASSWORD }
}

function Get-UtcSecond {
    return (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
}

# Gui mot tin readings (du 4 chi so) cho mot cam bien, QoS 1. Payload qua file de tranh loi dau nhay cua PowerShell 5.1.
function Send-Readings($Mqtt, [string]$Sensor, [double]$Temp, [double]$Humid = 82, [double]$Co2 = 600, [double]$Light = 2) {
    $at = Get-UtcSecond
    $inv = [Globalization.CultureInfo]::InvariantCulture
    $items = @(@('TEMP', $Temp), @('HUMID', $Humid), @('CO2', $Co2), @('LIGHT', $Light)) | ForEach-Object {
        '{"device":"' + $Sensor + '","metric":"' + $_[0] + '","value":' + $_[1].ToString($inv) + ',"at":"' + $at + '"}'
    }
    $file = Join-Path $StateDir "payload-$Sensor.json"
    New-Item -ItemType Directory -Force $StateDir | Out-Null
    [IO.File]::WriteAllText($file, '[' + ($items -join ',') + ']')
    & "$Mosquitto\mosquitto_pub.exe" -h $Mqtt.Host -p $Mqtt.Port -u $Mqtt.User -P $Mqtt.Password -q 1 -t "swiftlet/devices/$Sensor/readings" -f $file
    if ($LASTEXITCODE -ne 0) { throw "mosquitto_pub loi (ma $LASTEXITCODE)" }
    return $at
}

# Cho lenh command moi (khong lay tin retained cu) cua mot co cau chap hanh. Tra ve tien trinh dang cho.
function Start-CommandWait($Mqtt, [string]$Actuator, [int]$Seconds) {
    $out = Join-Path $StateDir "cmd-$Actuator.txt"
    Remove-Quiet $out
    $p = Start-Process "$Mosquitto\mosquitto_sub.exe" -ArgumentList @('-h', $Mqtt.Host, '-p', $Mqtt.Port, '-u', $Mqtt.User, '-P', $Mqtt.Password, '-t', "swiftlet/devices/$Actuator/command", '-R', '-C', '1', '-W', "$Seconds") -RedirectStandardOutput $out -NoNewWindow -PassThru
    Start-Sleep -Milliseconds 700
    return @{ Process = $p; Out = $out }
}
