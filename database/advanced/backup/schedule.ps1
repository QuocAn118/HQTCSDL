
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Install', 'Remove')]
    [string]$Action,

    [string]$Database = 'SwiftletCare'
)

$ErrorActionPreference = 'Stop'

if ($Database -notmatch '^[A-Za-z0-9_]+$') {
    throw "Database name khong hop le: $Database"
}

$BackupScript = Join-Path $PSScriptRoot 'backup.ps1'

if (-not (Test-Path -LiteralPath $BackupScript -PathType Leaf)) {
    throw "Khong tim thay backup.ps1: $BackupScript"
}

$BackupScript = (Resolve-Path -LiteralPath $BackupScript).Path

$Tasks = @(
    @{
        Name     = 'SwiftletCare-Full'
        Schedule = @('/SC', 'DAILY', '/ST', '02:00')
        Type     = 'Full'
    },
    @{
        Name     = 'SwiftletCare-Log'
        Schedule = @('/SC', 'MINUTE', '/MO', '15')
        Type     = 'Log'
    }
)

function Invoke-Schtasks {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & schtasks.exe @Arguments

    $Code = $LASTEXITCODE

    if ($Code -ne 0) {
        throw "schtasks that bai, exit code: $Code"
    }
}

if ($Action -eq 'Install') {
    foreach ($Task in $Tasks) {
        $TaskCommand = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' +
            $BackupScript +
            '" -Database ' + $Database +
            ' -Type ' + $Task.Type

        Write-Host "Installing task: $($Task.Name)"

        $Arguments = @(
            '/Create',
            '/TN', $Task.Name
        ) + $Task.Schedule + @(
            '/TR', $TaskCommand,
            '/F'
        )

        Invoke-Schtasks -Arguments $Arguments
    }

    Write-Host 'SCHEDULE INSTALL PASS'
}
else {
    foreach ($Task in $Tasks) {
        Write-Host "Removing task: $($Task.Name)"

        & schtasks.exe /Query /TN $Task.Name *> $null
        $QueryCode = $LASTEXITCODE

        if ($QueryCode -eq 0) {
            Invoke-Schtasks -Arguments @(
                '/Delete',
                '/TN', $Task.Name,
                '/F'
            )
        }
        else {
            Write-Host "Task chua ton tai, bo qua: $($Task.Name)"
        }
    }

    Write-Host 'SCHEDULE REMOVE PASS'
}
