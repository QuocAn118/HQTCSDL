$ErrorActionPreference = 'Stop'

$DeviceId = 3
$Server = 'localhost,1433'
$Database = 'SwiftletCare_Perf'

function Invoke-LostUpdateTest {
    param(
        [string]$Procedure,
        [string]$Label
    )

    Write-Host "`n===== $Label =====" -ForegroundColor Cyan

    & sqlcmd -S $Server -E -C -d $Database -l 30 -b `
        -Q "UPDATE dbo.Devices SET Level = 0 WHERE DeviceId = $DeviceId;"

    if ($LASTEXITCODE -ne 0) {
        throw "Khong reset duoc Level."
    }

    $tempDir = Join-Path $env:TEMP ("lost-update-" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $tempDir | Out-Null

    $sqlFile = Join-Path $tempDir 'session.sql'
    $out1 = Join-Path $tempDir 'session1.out'
    $out2 = Join-Path $tempDir 'session2.out'
    $err1 = Join-Path $tempDir 'session1.err'
    $err2 = Join-Path $tempDir 'session2.err'

    "USE $Database;`nEXEC dbo.$Procedure @DeviceId = $DeviceId, @Delta = 10;`nGO" |
        Set-Content -Encoding UTF8 $sqlFile

    $argumentLine = "-S `"$Server`" -E -C -d `"$Database`" -l 30 -b -i `"$sqlFile`""

    $p1 = Start-Process -FilePath 'sqlcmd.exe' `
        -ArgumentList $argumentLine -NoNewWindow -PassThru `
        -RedirectStandardOutput $out1 -RedirectStandardError $err1

    $p2 = Start-Process -FilePath 'sqlcmd.exe' `
        -ArgumentList $argumentLine -NoNewWindow -PassThru `
        -RedirectStandardOutput $out2 -RedirectStandardError $err2

    $p1.WaitForExit()
    $p2.WaitForExit()
    $p1.Refresh()
    $p2.Refresh()

    Write-Host "`n--- Session 1 ---"
    Get-Content $out1
    if ((Get-Item $err1).Length -gt 0) { Get-Content $err1 }

    Write-Host "`n--- Session 2 ---"
    Get-Content $out2
    if ((Get-Item $err2).Length -gt 0) { Get-Content $err2 }

    Write-Host "`nProcess exit codes: Session 1=$($p1.ExitCode), Session 2=$($p2.ExitCode)"

    Write-Host "`n--- Final database state ---"
    & sqlcmd -S $Server -E -C -d $Database -l 30 -b `
        -Q "SELECT DeviceId, Code, Level FROM dbo.Devices WHERE DeviceId = $DeviceId;"

    if ($LASTEXITCODE -ne 0) {
        throw "Khong doc duoc trang thai cuoi trong database."
    }

    Remove-Item $tempDir -Recurse -Force
}

Invoke-LostUpdateTest -Procedure 'demo_LostUpdate_Naive' -Label 'NAIVE'
Invoke-LostUpdateTest -Procedure 'demo_LostUpdate_Safe' -Label 'SAFE'

Write-Host "`nHoan tat hai bai kiem thu." -ForegroundColor Green
