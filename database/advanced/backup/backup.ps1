
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Database,

    [Parameter(Mandatory = $true)]
    [ValidateSet('Full', 'Log')]
    [string]$Type,

    [string]$Dir = 'C:\SwiftletBackup'
)

$ErrorActionPreference = 'Stop'

# 1. Validate configuration

if ($Database -notmatch '^[A-Za-z0-9_]+$') {
    Write-Host "Database name khong hop le: $Database"
    exit 2
}

$AdvancedRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $AdvancedRoot 'lib.ps1')

if (-not (Test-Path -LiteralPath $Dir -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
}

$Timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$BackupType = $Type.ToUpperInvariant()

if ($Type -eq 'Full') {
    $Extension = 'bak'
}
else {
    $Extension = 'trn'
}

$BackupFile = Join-Path $Dir "${Database}_${BackupType}_${Timestamp}.${Extension}"
$LogFile = Join-Path $Dir 'backup.log'

# 2. Logging

function Write-BackupLog {
    param([string]$Message)

    $Line = '{0} | {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -LiteralPath $LogFile -Value $Line -Encoding UTF8
}

# 3. Read database status from SQL Server

function Get-DatabaseStatus {
    $SafeDatabase = $Database.Replace("'", "''")

    $Query = @"
SET NOCOUNT ON;

SELECT
    d.recovery_model_desc + '|' +
    d.state_desc + '|' +
    CASE WHEN EXISTS (
        SELECT 1
        FROM msdb.dbo.backupset b
        WHERE b.database_name = d.name
          AND b.type = 'D'
          AND b.backup_finish_date IS NOT NULL
    ) THEN '1' ELSE '0' END
FROM sys.databases d
WHERE d.name = N'$SafeDatabase';
"@

    $SqlArgs = @(
        '-S', 'tcp:127.0.0.1,1433',
        '-E', '-b', '-I', '-C',
        '-W', '-h', '-1',
        '-s', '|',
        '-d', 'master',
        '-Q', $Query
    )

    $Output = @(& sqlcmd @SqlArgs)

    if ($LASTEXITCODE -ne 0) {
        throw "Khong the kiem tra database $Database."
    }

    $Rows = @(
        $Output |
        ForEach-Object { ([string]$_).Trim() } |
        Where-Object { $_ -ne '' }
    )

    if ($Rows.Count -ne 1) {
        throw "Database khong ton tai hoac khong doc duoc thong tin: $Database"
    }

    $Parts = $Rows[0].Split('|')

    if ($Parts.Count -ne 3) {
        throw "Khong doc duoc trang thai database: $Database"
    }

    return @{
        RecoveryModel = $Parts[0]
        State         = $Parts[1]
        HasFullBackup = ($Parts[2] -eq '1')
    }
}

# 4. Validate LOG backup requirements

try {
    $Status = Get-DatabaseStatus

    if ($Status.State -ne 'ONLINE') {
        throw "Database $Database khong ONLINE: $($Status.State)"
    }

    if ($Type -eq 'Log') {
        if ($Status.RecoveryModel -ne 'FULL') {
            $Message = "LOG backup bi tu choi: $Database dang o $($Status.RecoveryModel), can FULL."
            Write-Host $Message
            Write-BackupLog "FAIL | $Message"
            exit 3
        }

        if (-not $Status.HasFullBackup) {
            $Message = "LOG backup bi tu choi: $Database chua co FULL backup thanh cong."
            Write-Host $Message
            Write-BackupLog "FAIL | $Message"
            exit 3
        }
    }

    # 5. Create backup with CHECKSUM

    $SafeDatabase = $Database.Replace(']', ']]')
    $SafePath = $BackupFile.Replace("'", "''")

    if ($Type -eq 'Full') {
        $BackupSql = @"
BACKUP DATABASE [$SafeDatabase]
TO DISK = N'$SafePath'
WITH CHECKSUM, STATS = 10;
"@
    }
    else {
        $BackupSql = @"
BACKUP LOG [$SafeDatabase]
TO DISK = N'$SafePath'
WITH CHECKSUM, STATS = 10;
"@
    }

    Write-Host "[$BackupType] Database: $Database"
    Write-Host "File: $BackupFile"

    Invoke-SqlWin -Database 'master' -Query $BackupSql

    # 6. Verify backup

    $VerifySql = @"
RESTORE VERIFYONLY
FROM DISK = N'$SafePath'
WITH CHECKSUM;
"@

    Write-Host '[VERIFY] RESTORE VERIFYONLY...'

    Invoke-SqlWin -Database 'master' -Query $VerifySql

    Write-Host 'BACKUP PASS'
    Write-Host "Database: $Database"
    Write-Host "Type    : $BackupType"
    Write-Host "File    : $BackupFile"

    Write-BackupLog "PASS | Database=$Database | Type=$BackupType | File=$BackupFile | VERIFYONLY=PASS"
}
catch {
    $Message = $_.Exception.Message

    Write-Host "BACKUP FAIL: $Message"
    Write-BackupLog "FAIL | Database=$Database | Type=$BackupType | Error=$Message"

    exit 1
}
