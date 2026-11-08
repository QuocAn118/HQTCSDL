# Trien khai lai SwiftletCare_Dev (CHI _Dev) voi ngay neo = hom qua theo gio Viet Nam (checklist spec backend 7.4).
# Khong dong toi SwiftletCare (demo) hay CSDL khac. Chay khi backend da tat (demo\stop-demo.ps1 truoc).
# Chay tu goc repo:  powershell -ExecutionPolicy Bypass -File demo\reset-demo.ps1
. (Join-Path $PSScriptRoot 'lib.ps1')

if (Test-Port 3000) { throw 'Backend dang chay (cong 3000). Chay demo\stop-demo.ps1 truoc khi reset.' }
$anchor = (Get-Date).ToUniversalTime().AddHours(7).Date.AddDays(-1).ToString('yyyy-MM-dd')
Write-Host "Reset SwiftletCare_Dev, ngay neo $anchor ..."
$t0 = Get-Date
& powershell.exe -ExecutionPolicy Bypass -File (Join-Path $Repo 'database\scripts\deploy.ps1') -Database SwiftletCare_Dev -Reset -AnchorDateVn $anchor
if ($LASTEXITCODE -ne 0) { throw "deploy.ps1 loi (ma $LASTEXITCODE)" }
Write-Host ("Xong sau {0:N0} giay. Demo sut dan: /admin/tools nhap {1} 20:30 (gio VN), moi CSDL chi mot lan." -f ((Get-Date) - $t0).TotalSeconds, $anchor)
