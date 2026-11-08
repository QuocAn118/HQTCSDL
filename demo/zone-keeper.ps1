# Giu nhip so do cho MOT khu vuc ma simulator da ngung gui (start-demo chay simulator voi --drop <Zone>-SENSOR).
# Moi 10 giay gui du 4 chi so (at = gio UTC hien tai, tai khoan simulator, khong in mat khau):
#   - binh thuong: TEMP ~27.8, HUMID ~82, CO2 ~600, LIGHT 2
#   - khi co co %TEMP%\swiftletcare-demo\hot-<Zone>.flag (do hot-now.ps1 tao): TEMP lay tu noi dung co.
# Nho vay quat khong bi so do binh thuong cua simulator keo tat/bat lien tuc khi demo "qua nhiet".
# start-demo.ps1 tu mo cua so nay; tat bang stop-demo.ps1.
param([string]$Zone = 'H1-F2')
. (Join-Path $PSScriptRoot 'lib.ps1')

$mqtt = Get-SimMqtt
$sensor = "$Zone-SENSOR"
$flag = Join-Path $StateDir "hot-$Zone.flag"
$rnd = New-Object System.Random
while ($true) {
    if (Test-Path $flag) {
        $t = [double]::Parse((Get-Content $flag -Raw).Trim(), [Globalization.CultureInfo]::InvariantCulture)
        $at = Send-Readings $mqtt $sensor $t
        Write-Host "$at $sensor NONG TEMP $t"
    } else {
        $t = [math]::Round(27.8 + ($rnd.NextDouble() - 0.5) * 0.2, 2)
        $h = [math]::Round(82 + ($rnd.NextDouble() - 0.5) * 0.4, 2)
        $c = [math]::Round(600 + ($rnd.NextDouble() - 0.5) * 10, 2)
        $at = Send-Readings $mqtt $sensor $t $h $c 2
        Write-Host "$at $sensor binh thuong TEMP $t HUMID $h CO2 $c"
    }
    Start-Sleep -Seconds 10
}
