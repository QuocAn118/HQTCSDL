
param(
    [string]$Database = 'SwiftletCare_Test'
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '..\lib.ps1')

try {
    # 1. Chi cho phep database co hau to _Test
    Assert-DbSuffix -Database $Database -Suffix '_Test'

    $DatabaseRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $DeployScript = Join-Path $DatabaseRoot 'scripts\deploy.ps1'

    if (-not (Test-Path $DeployScript)) {
        throw "Khong tim thay deploy.ps1: $DeployScript"
    }

    $Cfg = Read-DotEnv

    foreach ($key in 'APP_BACKEND_PASSWORD', 'APP_REPORT_PASSWORD') {
        if (-not $Cfg[$key]) {
            throw "Thieu $key trong database/.env"
        }
    }

    # 2. Deploy lai database Test
    Write-Host "`n[1/6] Deploy database: $Database"

    & powershell.exe -NoProfile -ExecutionPolicy Bypass `
        -File $DeployScript -Database $Database -Reset

    if ($LASTEXITCODE -ne 0) {
        throw "Deploy that bai (ma $LASTEXITCODE)"
    }

    # 3. Kiem tra server login va orphan users
    Write-Host "`n[2/6] Kiem tra login va orphan users"

    $CheckQuery = @"
SET NOCOUNT ON;

IF SUSER_ID(N'app_backend') IS NULL
    THROW 51001, 'Thieu login app_backend. Chay security/create-logins.ps1 truoc.', 1;

IF SUSER_ID(N'app_report') IS NULL
    THROW 51002, 'Thieu login app_report. Chay security/create-logins.ps1 truoc.', 1;

IF EXISTS (
    SELECT 1
    FROM sys.database_principals dp
    LEFT JOIN sys.server_principals sp ON sp.sid = dp.sid
    WHERE dp.name IN (N'app_backend', N'app_report')
      AND sp.sid IS NULL
)
    THROW 51003, 'Phat hien user mo coi. Deploy lai database hoac ALTER USER.', 1;

PRINT 'PASS: login ton tai, khong co orphan user.';
"@

    Invoke-SqlWin -Database $Database -Query $CheckQuery

    # 4. Chay security.test.sql bang swiftlet_dev
    Write-Host "`n[3/6] Chay security.test.sql"

    $SecurityFile = Join-Path $PSScriptRoot 'security.test.sql'

    if (-not (Test-Path $SecurityFile)) {
        throw "Khong tim thay $SecurityFile"
    }

    Invoke-Sql `
        -Cfg $Cfg `
        -Database $Database `
        -File $SecurityFile

    # 5. Smoke test bang hai login ung dung
    $SmokeFile = Join-Path $PSScriptRoot 'login-smoke.sql'

    if (-not (Test-Path $SmokeFile)) {
        throw "Khong tim thay $SmokeFile"
    }

    $SmokeQuery = Get-Content $SmokeFile -Raw

    Write-Host "`n[4/6] Smoke test app_backend"

    $ExitCode = Invoke-SqlAs `
        -Login 'app_backend' `
        -Password $Cfg.APP_BACKEND_PASSWORD `
        -Database $Database `
        -Query $SmokeQuery

    if ($ExitCode -ne 0) {
        throw "Smoke test app_backend that bai (ma $ExitCode)"
    }

    Write-Host 'PASS: app_backend doc duoc vw_OpenAlerts.'

    Write-Host "`n[5/6] Smoke test app_report"

    $ExitCode = Invoke-SqlAs `
        -Login 'app_report' `
        -Password $Cfg.APP_REPORT_PASSWORD `
        -Database $Database `
        -Query $SmokeQuery

    if ($ExitCode -ne 0) {
        throw "Smoke test app_report that bai (ma $ExitCode)"
    }

    Write-Host 'PASS: app_report doc duoc vw_OpenAlerts.'

    # 6. Thu DROP TABLE bang app_backend.
    # Theo spec: thao tac phai that bai (exit code khac 0).
    Write-Host "`n[6/6] Kiem tra app_backend khong co quyen DROP TABLE"

    $DropQuery = 'DROP TABLE dbo.SensorReadings;'

    $ExitCode = Invoke-SqlAs `
        -Login 'app_backend' `
        -Password $Cfg.APP_BACKEND_PASSWORD `
        -Database $Database `
        -Query $DropQuery

    if ($ExitCode -eq 0) {
        throw 'app_backend co the DROP TABLE. Kiem tra lai phan GRANT.'
    }

    Write-Host 'PASS: app_backend bi tu choi DROP TABLE.'

    Write-Host "`nsecurity: PASS"
}
catch {
    Write-Host "`nsecurity: FAIL"
    Write-Host $_.Exception.Message
    exit 1
}
