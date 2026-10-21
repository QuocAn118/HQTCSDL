
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Read-DotEnv {
    $path = Join-Path $Root '.env'
    if (-not (Test-Path $path)) {
        throw '.env khong ton tai. Sao chep .env.example thanh .env roi dien mat khau.'
    }

    $vars = @{}
    foreach ($line in Get-Content $path) {
        if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$') {
            $vars[$Matches[1]] = $Matches[2].Trim('"')
        }
    }

    foreach ($k in 'DB_SERVER', 'DB_PORT', 'DB_USER', 'DB_PASSWORD') {
        if (-not $vars[$k]) {
            throw "Thieu $k trong .env"
        }
    }
    return $vars
}

function Get-DatabaseUrl($Cfg, [string]$Database) {
    "sqlserver://$($Cfg.DB_SERVER):$($Cfg.DB_PORT);database=$Database;user=$($Cfg.DB_USER);password={$($Cfg.DB_PASSWORD)};trustServerCertificate=true"
}

function Invoke-Sql {
    param(
        [hashtable]$Cfg,
        [string]$Database,
        [string]$File,
        [string]$Query,
        [string[]]$Variables = @()
    )

    $sqlArgs = @(
        '-S', "$($Cfg.DB_SERVER),$($Cfg.DB_PORT)",
        '-U', $Cfg.DB_USER,
        '-d', $Database,
        '-b', '-I', '-C', '-f', '65001'
    )

    if ($File) {
        $sqlArgs += @('-i', $File)
    } else {
        $sqlArgs += @('-Q', $Query)
    }

    foreach ($v in $Variables) {
        $sqlArgs += @('-v', $v)
    }

    $env:SQLCMDPASSWORD = $Cfg.DB_PASSWORD
    & "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE" @sqlArgs

    if ($LASTEXITCODE -ne 0) {
        throw "sqlcmd loi (ma $LASTEXITCODE): $File$Query"
    }
}

function Get-SqlScalar($Cfg, [string]$Database, [string]$Query) {
    $env:SQLCMDPASSWORD = $Cfg.DB_PASSWORD

    $out = & "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE" `
        -S "$($Cfg.DB_SERVER),$($Cfg.DB_PORT)" `
        -U $Cfg.DB_USER `
        -d $Database `
        -b -I -C -h -1 -W `
        -Q "SET NOCOUNT ON; $Query"

    if ($LASTEXITCODE -ne 0) {
        throw "sqlcmd loi: $Query"
    }

    return (($out | Where-Object {
        $_ -and $_.Trim()
    }) | Select-Object -First 1).Trim()
}
