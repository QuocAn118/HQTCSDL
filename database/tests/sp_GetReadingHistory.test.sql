
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

DROP TABLE IF EXISTS #r;
CREATE TABLE #r (
    BucketUtc DATETIME2(0),
    AvgValue DECIMAL(9, 2),
    MinValue DECIMAL(9, 2),
    MaxValue DECIMAL(9, 2)
);
GO

PRINT N'history: gom theo gio, To loai tru';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @dev INT = (
        SELECT DeviceId
        FROM dbo.Devices
        WHERE Code = 'H1-F1-SENSOR'
    );

    DECLARE @zone INT = (
        SELECT ZoneId
        FROM dbo.Devices
        WHERE Code = 'H1-F1-SENSOR'
    );

    INSERT dbo.SensorReadings
        (DeviceId, MetricCode, Value, RecordedAt)
    VALUES
        (@dev, 'TEMP', 27, '2026-09-01T00:00:00'),
        (@dev, 'TEMP', 29, '2026-09-01T00:30:00'),
        (@dev, 'TEMP', 28, '2026-09-01T01:15:00'),
        (@dev, 'TEMP', 26, '2026-09-01T02:59:59'),
        (@dev, 'TEMP', 40, '2026-09-01T03:00:00');

    INSERT #r
    EXEC dbo.sp_GetReadingHistory
        @ZoneId = @zone,
        @MetricCode = 'TEMP',
        @FromUtc = '2026-09-01T00:00:00',
        @ToUtc = '2026-09-01T03:00:00',
        @BucketMinutes = 60;

    IF (SELECT COUNT(*) FROM #r) <> 3
        THROW 59999, N'Phai co 3 bucket', 1;

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE BucketUtc = '2026-09-01T00:00:00'
          AND AvgValue = 28
          AND MinValue = 27
          AND MaxValue = 29
    )
        THROW 59999, N'Bucket 00:00 sai', 1;

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE BucketUtc = '2026-09-01T02:00:00'
          AND AvgValue = 26
    )
        THROW 59999, N'Bucket 02:00 sai', 1;

    IF EXISTS (
        SELECT 1 FROM #r WHERE MaxValue = 40
    )
        THROW 59999, N'So do tai ToUtc phai bi loai', 1;

    ROLLBACK;

    PRINT N'history: hourly buckets PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
GO



PRINT N'history: khoang khong co du lieu';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @zone INT = (
        SELECT ZoneId
        FROM dbo.Devices
        WHERE Code = 'H1-F1-SENSOR'
    );

    DELETE FROM #r;

    INSERT #r
    EXEC dbo.sp_GetReadingHistory
        @zone,
        'TEMP',
        '2026-08-01T00:00:00',
        '2026-08-02T00:00:00',
        60;

    IF (SELECT COUNT(*) FROM #r) <> 0
        THROW 59999, N'Khoang rong phai tra 0 dong', 1;

    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'history: From >= To -> 50041';

BEGIN TRY
    EXEC dbo.sp_GetReadingHistory
        1, 'TEMP',
        '2026-09-02T00:00:00',
        '2026-09-01T00:00:00',
        60;

    THROW 59999, N'Mong doi loi 50041', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50041 THROW;
END CATCH
GO

PRINT N'history: BucketMinutes = 0 -> 50040';

BEGIN TRY
    EXEC dbo.sp_GetReadingHistory
        1, 'TEMP',
        '2026-09-01T00:00:00',
        '2026-09-02T00:00:00',
        0;

    THROW 59999, N'Mong doi loi 50040', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50040 THROW;
END CATCH
GO

PRINT N'history: qua 2000 bucket -> 50042';

BEGIN TRY
    EXEC dbo.sp_GetReadingHistory
        1, 'TEMP',
        '2026-01-01T00:00:00',
        '2026-12-31T00:00:00',
        1;

    THROW 59999, N'Mong doi loi 50042', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO

PRINT N'sp_GetReadingHistory: PASS';
GO
