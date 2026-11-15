$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '..\lib.ps1')

try {
    $cfg = Read-DotEnv

    foreach ($key in 'APP_BACKEND_PASSWORD', 'APP_REPORT_PASSWORD') {
        if (-not $cfg[$key]) {
            Write-Host "Thieu $key trong .env"
            exit 3
        }

        if ($cfg[$key].Contains("'")) {
            Write-Host 'Mat khau khong duoc chua dau nhay don.'
            exit 3
        }
    }

    $env:AppBackendPassword = $cfg['APP_BACKEND_PASSWORD']
    $env:AppReportPassword = $cfg['APP_REPORT_PASSWORD']

    $sqlFile = Join-Path $PSScriptRoot 'create-logins.sql'
    Invoke-SqlWin -Database 'master' -File $sqlFile

    Write-Host 'Da tao/cap nhat login app_backend va app_report.'
}
catch {
    Write-Host "CREATE LOGINS FAILED: $($_.Exception.Message)"
    exit 1
}
finally {
    Remove-Item Env:\AppBackendPassword -ErrorAction SilentlyContinue
    Remove-Item Env:\AppReportPassword -ErrorAction SilentlyContinue
}
