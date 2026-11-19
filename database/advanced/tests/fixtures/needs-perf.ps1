param(
    [Parameter(Mandatory = $true)]
    [string]$Database
)

. (Join-Path $PSScriptRoot '..\..\lib.ps1')

Assert-DbSuffix $Database '_Perf'

exit 0
