
[CmdletBinding()]
param(
    [string]$Source = 'SwiftletCare_Bk_Dev',
    [string]$Target = 'SwiftletCare_Restore',
    [string]$Dir = 'C:\SwiftletBackup',
    [switch]$ResetSourceAfter
)

$ErrorActionPreference = 'Stop'

$AdvancedRoot = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $AdvancedRoot)

. (Join-Path $AdvancedRoot 'lib.ps1')

$RestoreScript = Join-Path $PSScriptRoot 'restore-pitr.ps1'
$DeployScript = Join-Path $RepoRoot 'database\scripts\deploy.ps1'


# 1. Validate configuration

Assert-DbSuffix -Database $Source -Suffix '_Bk_Dev'
Assert-DbSuffix -Database $Target -Suffix '_Restore'

if ($Source -eq $Target) {
    throw 'Source va Target phai la hai database khac nhau.'
}

if (-not (Test-Path -LiteralPath $RestoreScript -PathType Leaf)) {
    throw "Khong tim thay restore-pitr.ps1: $RestoreScript"
}

if ($ResetSourceAfter -and
    -not (Test-Path -LiteralPath $DeployScript -PathType Leaf)) {
    throw "Khong tim thay deploy.ps1: $DeployScript"
}

if (-not (Test-Path -LiteralPath $Dir -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
}

$Full = Join-Path $Dir 'Bk_full.bak'
$Diff = Join-Path $Dir 'Bk_diff.bak'
$Log = Join-Path $Dir 'Bk_log1.trn'


# 2. SQL helpers

function Invoke-SourceSql {
    param([string]$Query)

    Invoke-SqlWin -Database $Source -Query $Query
}

function Invoke-MasterSql {
    param([string]$Query)

    Invoke-SqlWin -Database 'master' -Query $Query
}

function Invoke-SqlScalar {
    param(
        [string]$Database,
        [string]$Query
    )

    $output = @(
        & sqlcmd -S 'tcp:127.0.0.1,1433' -E -b -I -C `
            -W -h -1 -w 65535 -d $Database -Q $Query
    )

    if ($LASTEXITCODE -ne 0) {
        throw "Truy van SQL that bai: $($output -join "`n")"
    }

    return @(
        $output |
        ForEach-Object { ([string]$_).Trim() } |
        Where-Object { $_ -ne '' }
    )
}

function ConvertTo-ScalarInt {
    param(
        [object]$Value,
        [string]$Description
    )

    $text = (@($Value) -join '').Trim()

    $number = 0

    $valid = [int]::TryParse(
        $text,
        [Globalization.NumberStyles]::Integer,
        [Globalization.CultureInfo]::InvariantCulture,
        [ref]$number
    )

    if (-not $valid) {
        throw "Khong doc duoc gia tri so $Description`: [$text]"
    }

    return $number
}

function Add-Readings {
    param(
        [int]$MinutesAgo,
        [string]$Value
    )

    $query = @"
SET NOCOUNT ON;

DECLARE @DeviceId int =
(
    SELECT DeviceId
    FROM dbo.Devices
    WHERE Code = 'H1-F1-SENSOR'
);

IF @DeviceId IS NULL
    THROW 51000, 'Khong tim thay H1-F1-SENSOR', 1;

DECLARE @i int = 0;

WHILE @i < 10
BEGIN
    INSERT INTO dbo.SensorReadings
        (DeviceId, MetricCode, Value, RecordedAt)
    VALUES
        (
            @DeviceId,
            'TEMP',
            $Value,
            DATEADD(MINUTE, -$MinutesAgo + @i, SYSUTCDATETIME())
        );

    SET @i += 1;
END;
"@

    Invoke-SourceSql -Query $query
}

# Lấy ReadingId lớn nhất của H1-F1-SENSOR.
# Dùng để phân biệt readings của lần chạy hiện tại.

function Get-LastReadingId {
    $output = Invoke-SqlScalar -Database $Source -Query @"
SET NOCOUNT ON;

SELECT ISNULL(MAX(r.ReadingId), 0)
FROM dbo.SensorReadings r
INNER JOIN dbo.Devices d
    ON d.DeviceId = r.DeviceId
WHERE d.Code = 'H1-F1-SENSOR'
  AND r.MetricCode = 'TEMP';
"@

    $text = (@($output) -join '').Trim()

    $readingId = 0L

    $valid = [long]::TryParse(
        $text,
        [Globalization.NumberStyles]::Integer,
        [Globalization.CultureInfo]::InvariantCulture,
        [ref]$readingId
    )

    if (-not $valid) {
        throw "Khong doc duoc ReadingId: [$text]"
    }

    return $readingId
}


# 3. Check source database and original data

Write-Host "`n[1/9] Kiem tra source database..."

$sourceCheck = Invoke-SqlScalar -Database 'master' -Query @"
SET NOCOUNT ON;

SELECT COUNT(*)
FROM sys.databases
WHERE name = N'$Source'
  AND state_desc = 'ONLINE';
"@

if ((ConvertTo-ScalarInt $sourceCheck 'Source database') -ne 1) {
    throw "Source database $Source khong ton tai hoac khong ONLINE."
}

$deviceCheck = Invoke-SqlScalar -Database $Source -Query @"
SET NOCOUNT ON;

SELECT COUNT(*)
FROM dbo.Devices
WHERE Code = 'H1-F1-SENSOR';
"@

if ((ConvertTo-ScalarInt $deviceCheck 'Device count') -ne 1) {
    throw 'H1-F1-SENSOR khong ton tai duy nhat trong source.'
}

$zoneOutput = Invoke-SqlScalar -Database $Source -Query @"
SET NOCOUNT ON;

SELECT ZoneId
FROM dbo.Devices
WHERE Code = 'H1-F1-SENSOR';
"@

if ($zoneOutput.Count -ne 1) {
    throw 'Khong doc duoc ZoneId cua H1-F1-SENSOR.'
}

$ZoneId = ConvertTo-ScalarInt $zoneOutput 'ZoneId'

$thresholdCheck = Invoke-SqlScalar -Database $Source -Query @"
SET NOCOUNT ON;

SELECT COUNT(*)
FROM dbo.Thresholds
WHERE ZoneId = $ZoneId;
"@

$thresholdCount = ConvertTo-ScalarInt $thresholdCheck 'ThresholdCount'

if ($thresholdCount -ne 4) {
    throw "Source phai co dung 4 Thresholds truoc khi demo. Hien tai: $thresholdCount. Khong tao backup."
}

Write-Host "Source: $Source"
Write-Host "Target: $Target"
Write-Host "Zone H1-F1: $ZoneId"
Write-Host "Thresholds ban dau: $thresholdCount"


# 4. Save original Thresholds for rollback

Write-Host '[SAFETY] Sao luu Thresholds ban dau...'

$thresholdSnapshotOutput = Invoke-SqlScalar -Database $Source -Query @"
SET NOCOUNT ON;

SELECT (
    SELECT
        ZoneId,
        MetricCode,
        MinValue,
        MaxValue,
        TargetValue,
        UpdatedBy,
        UpdatedAt
    FROM dbo.Thresholds
    WHERE ZoneId = $ZoneId
    FOR JSON PATH, INCLUDE_NULL_VALUES
);
"@

$thresholdSnapshot = $thresholdSnapshotOutput -join ''

if ([string]::IsNullOrWhiteSpace($thresholdSnapshot)) {
    throw 'Khong the sao luu Thresholds ban dau.'
}

$thresholdSnapshotSql = $thresholdSnapshot.Replace("'", "''")

$incidentApplied = $false

Write-Host '[SAFETY] Da luu snapshot Thresholds.'


# 5. Main PITR workflow with rollback protection

try {

    # 5.1 Switch recovery model to FULL

    Write-Host "`n[2/9] Chuyen recovery model sang FULL..."

    Invoke-MasterSql -Query "ALTER DATABASE [$Source] SET RECOVERY FULL;"

    # 5.2 Full backup

    Write-Host "`n[3/9] Tao FULL backup..."

    $fullSql = $Full.Replace("'", "''")

    Invoke-MasterSql -Query @"
BACKUP DATABASE [$Source]
TO DISK = N'$fullSql'
WITH INIT, CHECKSUM, STATS = 10;
"@

    # 5.3 Group 1 readings and differential backup

    Write-Host "`n[4/9] Them nhom readings 1 va tao DIFFERENTIAL backup..."

    $Group1StartId = Get-LastReadingId

    Add-Readings -MinutesAgo 20 -Value '28.37'

    $Group1EndId = Get-LastReadingId

    if (($Group1EndId - $Group1StartId) -ne 10) {
        throw 'Group 1 khong tao du 10 readings.'
    }

    Write-Host "Group 1 ReadingId: $($Group1StartId + 1) - $Group1EndId"

    $diffSql = $Diff.Replace("'", "''")

    Invoke-MasterSql -Query @"
BACKUP DATABASE [$Source]
TO DISK = N'$diffSql'
WITH DIFFERENTIAL, INIT, CHECKSUM, STATS = 10;
"@

    # 5.4 Group 2 readings

    Write-Host "`n[5/9] Them nhom readings 2..."

    $Group2StartId = $Group1EndId

    Add-Readings -MinutesAgo 10 -Value '28.63'

    $Group2EndId = Get-LastReadingId

    if (($Group2EndId - $Group2StartId) -ne 10) {
        throw 'Group 2 khong tao du 10 readings.'
    }

    Write-Host "Group 2 ReadingId: $($Group2StartId + 1) - $Group2EndId"

    # 5.5 Capture PITR time with millisecond precision.
    # Add one second after Group 2 has committed.
    # The incident happens two seconds after this capture.

    Write-Host "`n[6/9] Ghi moc thoi gian PITR..."

    $timeOutput = Invoke-SqlScalar -Database $Source -Query @"
SET NOCOUNT ON;

DECLARE @T datetime2(3) = SYSUTCDATETIME();

DECLARE @TStop datetime2(3) =
    DATEADD(SECOND, 1, @T);

DECLARE @TLocal datetime2(3) =
    DATEADD(
        MINUTE,
        DATEDIFF(MINUTE, SYSUTCDATETIME(), SYSDATETIME()),
        @TStop
    );

SELECT
    CONVERT(varchar(23), @T, 126) + '|' +
    CONVERT(varchar(23), @TStop, 126) + '|' +
    CONVERT(varchar(23), @TLocal, 126);
"@

    $timeLine = @(
        $timeOutput |
        Where-Object {
            $_ -match '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\|'
        }
    ) | Select-Object -Last 1

    if (-not $timeLine) {
        throw "Khong doc duoc moc thoi gian PITR: $($timeOutput -join "`n")"
    }

    $timeParts = $timeLine -split '\|'

    if ($timeParts.Count -ne 3) {
        throw "Du lieu thoi gian PITR khong hop le: $timeLine"
    }

    $TLocal = $timeParts[2].Trim()

    Write-Host "T UTC       : $($timeParts[0])"
    Write-Host "T STOP UTC  : $($timeParts[1])"
    Write-Host "T STOP Local: $TLocal"

    # Ensure the incident happens after STOPAT.

    Start-Sleep -Seconds 2

    # 5.6 Simulate incident: delete Thresholds

    Write-Host "`n[7/9] Mo phong su co xoa Thresholds..."

    Invoke-SourceSql -Query @"
DELETE FROM dbo.Thresholds
WHERE ZoneId = $ZoneId;
"@

    $incidentApplied = $true

    # Confirm source incident

    $deletedCount = Invoke-SqlScalar -Database $Source -Query @"
SET NOCOUNT ON;

SELECT COUNT(*)
FROM dbo.Thresholds
WHERE ZoneId = $ZoneId;
"@

    if ((ConvertTo-ScalarInt $deletedCount 'Deleted ThresholdCount') -ne 0) {
        throw 'Khong xac nhan duoc su co xoa Thresholds.'
    }

    # 5.7 Transaction log backup

    Write-Host "`n[8/9] Tao LOG backup..."

    $logSql = $Log.Replace("'", "''")

    Invoke-MasterSql -Query @"
BACKUP LOG [$Source]
TO DISK = N'$logSql'
WITH INIT, CHECKSUM, STATS = 10;
"@

    # 5.8 Verify backup files

    Write-Host "`n[9/9] Verify cac backup..."

    Invoke-MasterSql -Query "RESTORE VERIFYONLY FROM DISK = N'$fullSql' WITH CHECKSUM;"
    Invoke-MasterSql -Query "RESTORE VERIFYONLY FROM DISK = N'$diffSql' WITH CHECKSUM;"
    Invoke-MasterSql -Query "RESTORE VERIFYONLY FROM DISK = N'$logSql' WITH CHECKSUM;"

    # 5.9 Restore to STOPAT

    Write-Host "`n[RESTORE] Goi restore-pitr.ps1..."

    $restoreArgs = @{
        Target      = $Target
        Full        = $Full
        Diff        = $Diff
        Log         = $Log
        StopAtLocal = $TLocal
    }

    & $RestoreScript @restoreArgs

    # 5.10 Verify restored database

    Write-Host "`n[VERIFY] Kiem tra ket qua PITR..."

    $checkQuery = @"
SET NOCOUNT ON;

SELECT
    'RESTORE' AS DatabaseName,
    (SELECT COUNT(*)
     FROM [$Target].dbo.Thresholds
     WHERE ZoneId = $ZoneId) AS ThresholdCount,
    (SELECT COUNT(*)
     FROM [$Target].dbo.SensorReadings r
     INNER JOIN [$Target].dbo.Devices d
         ON d.DeviceId = r.DeviceId
     WHERE d.Code = 'H1-F1-SENSOR'
       AND r.MetricCode = 'TEMP'
       AND r.ReadingId > $Group1StartId
       AND r.ReadingId <= $Group2EndId
    ) AS ReadingCount

UNION ALL

SELECT
    'SOURCE',
    (SELECT COUNT(*)
     FROM [$Source].dbo.Thresholds
     WHERE ZoneId = $ZoneId),
    (SELECT COUNT(*)
     FROM [$Source].dbo.SensorReadings r
     INNER JOIN [$Source].dbo.Devices d
         ON d.DeviceId = r.DeviceId
     WHERE d.Code = 'H1-F1-SENSOR'
       AND r.MetricCode = 'TEMP'
       AND r.ReadingId > $Group1StartId
       AND r.ReadingId <= $Group2EndId
    );
"@

    Invoke-MasterSql -Query $checkQuery

    $verifyQuery = @"
SET NOCOUNT ON;

IF (
    SELECT COUNT(*)
    FROM [$Target].dbo.Thresholds
    WHERE ZoneId = $ZoneId
) <> 4
    THROW 51001, 'PITR: Restore Thresholds khong bang 4.', 1;

IF (
    SELECT COUNT(*)
    FROM [$Source].dbo.Thresholds
    WHERE ZoneId = $ZoneId
) <> 0
    THROW 51002, 'PITR: Source van con Thresholds.', 1;

IF (
    SELECT COUNT(*)
    FROM [$Target].dbo.SensorReadings r
    INNER JOIN [$Target].dbo.Devices d
        ON d.DeviceId = r.DeviceId
    WHERE d.Code = 'H1-F1-SENSOR'
      AND r.MetricCode = 'TEMP'
      AND r.Value = 28.37
      AND r.ReadingId > $Group1StartId
      AND r.ReadingId <= $Group1EndId
) <> 10
    THROW 51003, 'PITR: Group 1 readings khong bang 10.', 1;

IF (
    SELECT COUNT(*)
    FROM [$Target].dbo.SensorReadings r
    INNER JOIN [$Target].dbo.Devices d
        ON d.DeviceId = r.DeviceId
    WHERE d.Code = 'H1-F1-SENSOR'
      AND r.MetricCode = 'TEMP'
      AND r.Value = 28.63
      AND r.ReadingId > $Group2StartId
      AND r.ReadingId <= $Group2EndId
) <> 10
    THROW 51004, 'PITR: Group 2 readings khong bang 10.', 1;

PRINT 'PITR CHECK PASS';
"@

    Invoke-MasterSql -Query $verifyQuery

}
catch {

    $originalError = $_

    if ($incidentApplied) {

        Write-Host ''
        Write-Host '[ROLLBACK] Khoi phuc Thresholds tren source...'

        $rollbackFile = Join-Path `
            $env:TEMP `
            ("swiftletcare-pitr-rollback-" + [guid]::NewGuid().ToString('N') + '.sql')

        try {

            $rollbackQuery = @"
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

INSERT INTO dbo.Thresholds
(
    ZoneId,
    MetricCode,
    MinValue,
    MaxValue,
    TargetValue,
    UpdatedBy,
    UpdatedAt
)
SELECT
    j.ZoneId,
    j.MetricCode,
    j.MinValue,
    j.MaxValue,
    j.TargetValue,
    j.UpdatedBy,
    j.UpdatedAt
FROM OPENJSON(N'$thresholdSnapshotSql')
WITH
(
    ZoneId int,
    MetricCode varchar(10),
    MinValue decimal(9,2),
    MaxValue decimal(9,2),
    TargetValue decimal(9,2),
    UpdatedBy int,
    UpdatedAt datetime2
) AS j
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.Thresholds t
    WHERE t.ZoneId = j.ZoneId
      AND t.MetricCode = j.MetricCode
);

IF (
    SELECT COUNT(*)
    FROM dbo.Thresholds
    WHERE ZoneId = $ZoneId
) <> 4
    THROW 51010, 'Rollback Thresholds khong du 4 dong.', 1;

COMMIT TRANSACTION;
"@

            [System.IO.File]::WriteAllText(
                $rollbackFile,
                $rollbackQuery,
                [System.Text.UTF8Encoding]::new($false)
            )

            Invoke-SqlWin -Database $Source -File $rollbackFile

            Write-Host '[ROLLBACK] Thresholds source da duoc khoi phuc.'

        }
        catch {

            Write-Host '[CRITICAL] KHONG THE KHOI PHUC THRESHOLDS!'
            throw
        }
        finally {

            if (Test-Path -LiteralPath $rollbackFile) {
                Remove-Item -LiteralPath $rollbackFile -Force
            }
        }
    }

    throw $originalError
}


# 6. Optional source reset

if ($ResetSourceAfter) {

    Write-Host "`n[RESET] Deploy lai source database..."

    & powershell.exe -NoProfile -ExecutionPolicy Bypass `
        -File $DeployScript `
        -Database $Source `
        -Reset

    if ($LASTEXITCODE -ne 0) {
        throw 'Reset source database that bai.'
    }
}


# 7. Final result

Write-Host "`n===================================="
Write-Host "PITR DEMO PASS"
Write-Host "Full : $Full"
Write-Host "Diff : $Diff"
Write-Host "Log  : $Log"
Write-Host "STOPAT local: $TLocal"
Write-Host "===================================="
