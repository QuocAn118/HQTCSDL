# Dua khu vuc ve vung binh thuong de vong tu dong tat FAN: bo co nong cua zone-keeper va gui ngay TEMP 27.5
# (<= 28 de tat quat, <= Max - tre 0.5 de dong canh bao nguong), du 4 chi so, at = gio UTC hien tai.
# Chay tu goc repo:  powershell -ExecutionPolicy Bypass -File demo\cool-now.ps1
param([string]$Zone = 'H1-F2', [double]$Temp = 27.5)
. (Join-Path $PSScriptRoot 'lib.ps1')

Remove-Quiet (Join-Path $StateDir "hot-$Zone.flag")
$mqtt = Get-SimMqtt
$fan = "$Zone-FAN"
$wait = Start-CommandWait $mqtt $fan 15
$t0 = Get-Date
$at = Send-Readings $mqtt "$Zone-SENSOR" $Temp
Write-Host ("Da gui {0}-SENSOR: TEMP {1}, at {2}" -f $Zone, $Temp, $at)
$wait.Process.WaitForExit()
$cmd = Get-Content $wait.Out -ErrorAction SilentlyContinue
if ($cmd -match '"isOn"\s*:\s*false') { Write-Host ("{0} TAT sau {1:N1} giay: {2}" -f $fan, ((Get-Date) - $t0).TotalSeconds, $cmd) }
elseif ($cmd) { Write-Warning "Co lenh cho $fan nhung khong phai tat: $cmd" }
else { Write-Warning "$fan khong co lenh moi trong 15 giay (co the da tat san, hoac dang MANUAL)." }
