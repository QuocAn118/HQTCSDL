# Chay demo\sql-demo.sql tren SwiftletCare_Dev bang sqlcmd, thong tin dang nhap doc tu database/.env (khong in mat khau).
# Chay tu goc repo:  powershell -ExecutionPolicy Bypass -File demo\run-sql.ps1
. (Join-Path $PSScriptRoot 'lib.ps1')

$cfg = Read-EnvFile (Join-Path $Repo 'database\.env')
foreach ($k in 'DB_SERVER', 'DB_PORT', 'DB_USER', 'DB_PASSWORD') { if (-not $cfg[$k]) { throw "Thieu $k trong database/.env" } }
$sqlcmd = 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE'
if (-not (Test-Path $sqlcmd)) { $sqlcmd = 'sqlcmd' }
$env:SQLCMDPASSWORD = $cfg.DB_PASSWORD
try {
    & $sqlcmd -S "$($cfg.DB_SERVER),$($cfg.DB_PORT)" -U $cfg.DB_USER -d SwiftletCare_Dev -b -I -C -f 65001 -W -s ' | ' -i (Join-Path $PSScriptRoot 'sql-demo.sql')
    if ($LASTEXITCODE -ne 0) { throw "sqlcmd loi (ma $LASTEXITCODE)" }
} finally {
    Remove-Item Env:\SQLCMDPASSWORD -ErrorAction SilentlyContinue
}
