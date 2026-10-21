
param(
    [Parameter(Mandatory = $true)][string]$Database,
    [switch]$Reset,
    [string]$AnchorDateVn = '2026-10-12',
    [switch]$SkipSeed
)
$ErrorActionPreference = 'Stop'

# Chan ten CSDL khong hop le truoc moi thao tac.
if ($Database -notmatch '^[A-Za-z0-9_]+$') {
    Write-Host "Tu choi: ten CSDL '$Database' chi duoc gom chu, so, dau gach duoi."
    exit 3
}

# Chi cho phep reset database ket thuc bang _Test hoac _Dev.
if ($Reset -and ($Database -notmatch '(?i)_(Test|Dev)$')) {
    Write-Host "Tu choi -Reset: '$Database' khong ket thuc bang _Test hoac _Dev."
    exit 2
}

if ($AnchorDateVn -notmatch '^\d{4}-\d{2}-\d{2}$') {
    Write-Host 'AnchorDateVn phai co dang yyyy-MM-dd'
    exit 3
}

. (Join-Path $PSScriptRoot 'lib.ps1')
$cfg = Read-DotEnv

$ver = Get-SqlScalar $cfg 'master' "SELECT CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(50))"

if ([version]$ver -lt [version]'13.0.4001') {
    throw "SQL Server $ver thap hon 13.0.4001 (2016 SP1)."
}

if ($Reset) {
    Invoke-Sql -Cfg $cfg -Database 'master' -Query "IF DB_ID(N'$Database') IS NOT NULL BEGIN ALTER DATABASE [$Database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$Database]; END; CREATE DATABASE [$Database];"
} else {
    Invoke-Sql -Cfg $cfg -Database 'master' -Query "IF DB_ID(N'$Database') IS NULL CREATE DATABASE [$Database];"
}

$compat = Get-SqlScalar $cfg 'master' "SELECT compatibility_level FROM sys.databases WHERE name = N'$Database'"

if ([int]$compat -lt 130) {
    throw "compatibility_level $compat < 130 (can cho OPENJSON)."
}

$env:DATABASE_URL = Get-DatabaseUrl $cfg $Database

Push-Location $Root
try {
    & npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) {
        throw 'prisma migrate deploy loi'
    }
} finally {
    Pop-Location
}

foreach ($dir in '00-schema-extras', '01-views', '02-functions-procs', '03-triggers') {
    $path = Join-Path $Root "sql\$dir"

    if (Test-Path $path) {
        foreach ($f in (Get-ChildItem $path -Filter '*.sql' | Sort-Object Name)) {
            Write-Host "-> $dir/$($f.Name)"
            Invoke-Sql -Cfg $cfg -Database $Database -File $f.FullName
        }
    }
}

if (-not $SkipSeed) {
    $seedDir = Join-Path $Root 'sql\seed'

    if (Test-Path $seedDir) {
        foreach ($f in (Get-ChildItem $seedDir -Filter '*.sql' | Sort-Object Name)) {
            Write-Host "-> seed/$($f.Name)"
            Invoke-Sql -Cfg $cfg -Database $Database -File $f.FullName -Variables @("AnchorDateVn=$AnchorDateVn")
        }
    }
}

Write-Host "Trien khai xong: $Database"
exit 0
