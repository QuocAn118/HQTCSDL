$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '..\scripts\lib.ps1')

function Assert-DbSuffix {
    param(
        [string]$Database,
        [string]$Suffix
    )

    if ($Database -notmatch '^[A-Za-z0-9_]+$') {
        Write-Host "Database name khong hop le: $Database"
        exit 3
    }

    if (-not $Database.EndsWith($Suffix, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Host "Database phai ket thuc bang $Suffix"
        exit 2
    }
}

function Invoke-SqlWin {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Database,

        [string]$File,
        [string]$Query,
        [string]$OutFile
    )

    if (-not $File -and -not $Query) {
        throw 'Phai cung cap File hoac Query.'
    }

    $sqlArgs = @(
        '-S', 'localhost,1433',
        '-E', '-b', '-I', '-C', '-f', '65001',
        '-d', $Database
    )

    if ($File) {
        $sqlArgs += @('-i', $File)
    }
    else {
        $sqlArgs += @('-Q', $Query)
    }

    if ($OutFile) {
        $sqlArgs += @('-o', $OutFile)
    }

    & sqlcmd @sqlArgs

    if ($LASTEXITCODE -ne 0) {
        throw "sqlcmd loi (ma $LASTEXITCODE)"
    }
}

function Invoke-SqlAs {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Login,

        [Parameter(Mandatory = $true)]
        [string]$Password,

        [Parameter(Mandatory = $true)]
        [string]$Database,

        [Parameter(Mandatory = $true)]
        [string]$Query
    )

    $previousPassword = $env:SQLCMDPASSWORD

    try {
        $env:SQLCMDPASSWORD = $Password

        & sqlcmd `
            -S 'localhost,1433' `
            -U $Login `
            -d $Database `
            -b -I -C `
            -Q $Query

        return $LASTEXITCODE
    }
    finally {
        if ($null -eq $previousPassword) {
            Remove-Item Env:\SQLCMDPASSWORD -ErrorAction SilentlyContinue
        }
        else {
            $env:SQLCMDPASSWORD = $previousPassword
        }
    }
}
