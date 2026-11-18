
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Target,

    [Parameter(Mandatory = $true)]
    [string]$Full,

    [string]$Diff,

    [Parameter(Mandatory = $true)]
    [string]$Log,

    [Parameter(Mandatory = $true)]
    [string]$StopAtLocal
)

$ErrorActionPreference = 'Stop'

$AdvancedRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $AdvancedRoot 'lib.ps1')

# 1. Validate target before accessing files or SQL Server

Assert-DbSuffix -Database $Target -Suffix '_Restore'

if (-not (Test-Path -LiteralPath $Full -PathType Leaf)) {
    throw "Khong tim thay full backup: $Full"
}

if (-not [string]::IsNullOrWhiteSpace($Diff)) {
    if (-not (Test-Path -LiteralPath $Diff -PathType Leaf)) {
        throw "Khong tim thay differential backup: $Diff"
    }
}

if (-not (Test-Path -LiteralPath $Log -PathType Leaf)) {
    throw "Khong tim thay log backup: $Log"
}

# 2. Validate STOPAT format

$parsedTime = [datetime]::MinValue

$validTime = [datetime]::TryParseExact(
    $StopAtLocal,
    'yyyy-MM-ddTHH:mm:ss.fff',
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.DateTimeStyles]::None,
    [ref]$parsedTime
)

if (-not $validTime) {
    throw 'StopAtLocal phai co dinh dang yyyy-MM-ddTHH:mm:ss.fff'
}
# 3. Helpers

function Escape-SqlLiteral {
    param([string]$Value)
    return $Value.Replace("'", "''")
}

function Invoke-RestoreSql {
    param([string]$Query)

    Invoke-SqlWin -Database 'master' -Query $Query
}

# 4. Resolve backup paths

$fullPath = (Resolve-Path -LiteralPath $Full).Path
$logPath = (Resolve-Path -LiteralPath $Log).Path

$fullSql = Escape-SqlLiteral $fullPath
$logSql = Escape-SqlLiteral $logPath

$restoreDir = Split-Path -Parent $fullPath

$targetData = Join-Path $restoreDir "$Target.mdf"
$targetLog = Join-Path $restoreDir "${Target}_log.ldf"

$targetDataSql = Escape-SqlLiteral $targetData
$targetLogSql = Escape-SqlLiteral $targetLog

# 5. Read RESTORE FILELISTONLY

Write-Host '[RESTORE] Doc RESTORE FILELISTONLY...'

$fileListQuery = @"
SET NOCOUNT ON;

RESTORE FILELISTONLY
FROM DISK = N'$fullSql';
"@

$fileListArgs = @(
    '-S', 'tcp:127.0.0.1,1433',
    '-E',
    '-b',
    '-I',
    '-C',
    '-f', '65001',
    '-d', 'master',
    '-h', '-1',
    '-W',
    '-s', '|',
    '-w', '65535',
    '-Q', $fileListQuery
)

$fileListOutput = @(& sqlcmd @fileListArgs 2>&1)

if ($LASTEXITCODE -ne 0) {
    throw "RESTORE FILELISTONLY that bai: $($fileListOutput -join "`n")"
}

$dataLogical = $null
$logLogical = $null

foreach ($line in $fileListOutput) {
    $columns = ([string]$line).Split('|')

    if ($columns.Count -lt 3) {
        continue
    }

    $logicalName = $columns[0].Trim()
    $fileType = $columns[2].Trim()

    if ($fileType -eq 'D' -and -not $dataLogical) {
        $dataLogical = $logicalName
    }

    if ($fileType -eq 'L' -and -not $logLogical) {
        $logLogical = $logicalName
    }
}

if (-not $dataLogical -or -not $logLogical) {
    throw "Khong doc duoc logical data/log file: $($fileListOutput -join "`n")"
}

Write-Host "Logical data: $dataLogical"
Write-Host "Logical log : $logLogical"

$dataLogicalSql = Escape-SqlLiteral $dataLogical
$logLogicalSql = Escape-SqlLiteral $logLogical

# 6. Prepare target database if it already exists

Write-Host '[RESTORE] Kiem tra database dich...'

$prepareQuery = @"
IF DB_ID(N'$Target') IS NOT NULL
BEGIN
    ALTER DATABASE [$Target]
    SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
END;
"@

Invoke-RestoreSql -Query $prepareQuery

# 7. Restore FULL backup

Write-Host '[RESTORE] Restore FULL backup...'

$restoreFullQuery = @"
RESTORE DATABASE [$Target]
FROM DISK = N'$fullSql'
WITH
    MOVE N'$dataLogicalSql' TO N'$targetDataSql',
    MOVE N'$logLogicalSql' TO N'$targetLogSql',
    NORECOVERY,
    REPLACE,
    CHECKSUM,
    STATS = 10;
"@

Invoke-RestoreSql -Query $restoreFullQuery

# 8. Restore DIFFERENTIAL backup if supplied

if (-not [string]::IsNullOrWhiteSpace($Diff)) {
    $diffPath = (Resolve-Path -LiteralPath $Diff).Path
    $diffSql = Escape-SqlLiteral $diffPath

    Write-Host '[RESTORE] Restore DIFFERENTIAL backup...'

    $restoreDiffQuery = @"
RESTORE DATABASE [$Target]
FROM DISK = N'$diffSql'
WITH NORECOVERY, CHECKSUM, STATS = 10;
"@

    Invoke-RestoreSql -Query $restoreDiffQuery
}

# 9. Restore LOG backup to STOPAT

Write-Host "[RESTORE] Restore LOG den STOPAT $StopAtLocal ..."

$restoreLogQuery = @"
RESTORE LOG [$Target]
FROM DISK = N'$logSql'
WITH
    STOPAT = '$StopAtLocal',
    RECOVERY,
    CHECKSUM,
    STATS = 10;
"@

Invoke-RestoreSql -Query $restoreLogQuery

Write-Host ''
Write-Host '===================================='
Write-Host 'RESTORE PITR PASS'
Write-Host "Target : $Target"
Write-Host "STOPAT : $StopAtLocal"
Write-Host '===================================='
