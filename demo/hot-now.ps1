# Duong tat "quat tu bat": dat khu vuc H1-F2 vao che do nong (TEMP 31.5 > Max 30) va gui ngay mot tin du 4 chi so
# (at = gio UTC hien tai, tai khoan simulator doc tu simulator/.env, khong in). Vong dieu khien tu dong cua backend
# bat FAN, ghi ControlLogs ly do "TEMP 31.5 > Max 30" va mo canh bao nguong.
# Can zone-keeper.ps1 dang chay (start-demo mo san, simulator da --drop H1-F2-SENSOR) de so do binh thuong
# cua simulator khong keo quat tat/bat lien tuc. Sau -Seconds giay tu tro ve binh thuong (quat tat);
# -Seconds 0 = giu nong den khi chay demo\cool-now.ps1.
# Chay tu goc repo:  powershell -ExecutionPolicy Bypass -File demo\hot-now.ps1 [-Seconds 40] [-Temp 31.5]
param([double]$Temp = 31.5, [int]$Seconds = 40, [string]$Zone = 'H1-F2')
. (Join-Path $PSScriptRoot 'lib.ps1')

$keeper = (Test-Path $StateFile) -and (Select-String -Path $StateFile -Pattern '^keeper\|' -Quiet)
if (-not $keeper) { Write-Warning 'Khong thay zone-keeper do start-demo mo: simulator co the keo quat tat/bat lien tuc.' }
$mqtt = Get-SimMqtt
$fan = "$Zone-FAN"
$flag = Join-Path $StateDir "hot-$Zone.flag"
[IO.File]::WriteAllText($flag, $Temp.ToString([Globalization.CultureInfo]::InvariantCulture))
$wait = Start-CommandWait $mqtt $fan 15
$t0 = Get-Date
$at = Send-Readings $mqtt "$Zone-SENSOR" $Temp
Write-Host ("Da gui {0}-SENSOR: TEMP {1}, HUMID 82, CO2 600, LIGHT 2, at {2}" -f $Zone, $Temp, $at)
$wait.Process.WaitForExit()
$cmd = Get-Content $wait.Out -ErrorAction SilentlyContinue
if ($cmd -match '"isOn"\s*:\s*true') { Write-Host ("{0} BAT sau {1:N1} giay: {2}" -f $fan, ((Get-Date) - $t0).TotalSeconds, $cmd) }
elseif ($cmd) { Write-Warning "Co lenh cho $fan nhung khong phai bat: $cmd" }
else { Write-Warning "$fan khong co lenh moi trong 15 giay: quat co the da bat san, dang MANUAL, hoac backend chua chay -> dieu khien tay tren web." }
if ($Seconds -gt 0) {
    Start-Sleep -Seconds $Seconds
    & (Join-Path $PSScriptRoot 'cool-now.ps1') -Zone $Zone
}
