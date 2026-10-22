
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

PRINT N'views: vw_LatestReadings lay so do moi nhat';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @dev INT = (
        SELECT DeviceId
        FROM dbo.Devices
        WHERE Code = 'H2-F1-SENSOR'
    );

    DECLARE @t DATETIME2(0) =
        CAST(SYSUTCDATETIME() AS DATETIME2(0));

    INSERT dbo.SensorReadings
        (DeviceId, MetricCode, Value, RecordedAt)
    VALUES
        (@dev, 'TEMP', 27.1, DATEADD(MINUTE, -10, @t)),
        (@dev, 'TEMP', 28.9, @t);

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.vw_LatestReadings
        WHERE DeviceCode = 'H2-F1-SENSOR'
          AND MetricCode = 'TEMP'
          AND Value = 28.9
          AND RecordedAt = @t
          AND HouseName = N'H2'
    )
        THROW 59999, N'LatestReadings: sai so do moi nhat', 1;

    IF (
        SELECT COUNT(*)
        FROM dbo.vw_LatestReadings
        WHERE DeviceCode = 'H2-F1-SENSOR'
          AND MetricCode = 'TEMP'
    ) <> 1
        THROW 59999, N'LatestReadings: trung dong', 1;

    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'views: vw_OpenAlerts loc canh bao';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @h INT = (
        SELECT HouseId FROM dbo.Houses WHERE Name = N'H2'
    );

    DECLARE @z INT = (
        SELECT ZoneId FROM dbo.Zones
        WHERE HouseId = @h AND Name = N'F1'
    );

    INSERT dbo.Alerts
        (HouseId, ZoneId, AlertType, Severity,
         MetricCode, Value, Message)
    VALUES
        (@h, @z, 'THRESHOLD', 'WARNING',
         'TEMP', 31, N'Canh bao mo');

    DECLARE @open INT = SCOPE_IDENTITY();

    INSERT dbo.Alerts
        (HouseId, ZoneId, AlertType, Severity,
         MetricCode, Value, Message, Status, ResolvedAt)
    VALUES
        (@h, @z, 'THRESHOLD', 'WARNING',
         'HUMID', 70, N'Canh bao dong',
         'RESOLVED', SYSUTCDATETIME());

    DECLARE @closed INT = SCOPE_IDENTITY();

    IF NOT EXISTS (
        SELECT 1 FROM dbo.vw_OpenAlerts
        WHERE AlertId = @open
    )
        THROW 59999, N'OpenAlerts: thieu canh bao mo', 1;

    IF EXISTS (
        SELECT 1 FROM dbo.vw_OpenAlerts
        WHERE AlertId = @closed
    )
        THROW 59999, N'OpenAlerts: co canh bao da dong', 1;

    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'views: vw_DailyEnvStats theo ngay Viet Nam';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @dev INT = (
        SELECT DeviceId FROM dbo.Devices
        WHERE Code = 'H2-F1-SENSOR'
    );

    INSERT dbo.SensorReadings
        (DeviceId, MetricCode, Value, RecordedAt)
    VALUES
        (@dev, 'HUMID', 80, '2026-09-01T16:30:00'),
        (@dev, 'HUMID', 84, '2026-09-01T17:30:00');

    DECLARE @zone INT = (
        SELECT ZoneId FROM dbo.Devices
        WHERE DeviceId = @dev
    );

    IF NOT EXISTS (
        SELECT 1 FROM dbo.vw_DailyEnvStats
        WHERE ZoneId = @zone
          AND MetricCode = 'HUMID'
          AND DayVn = '2026-09-01'
          AND AvgValue = 80
          AND Samples = 1
    )
        THROW 59999, N'DailyEnvStats: ngay 01/09 sai', 1;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.vw_DailyEnvStats
        WHERE ZoneId = @zone
          AND MetricCode = 'HUMID'
          AND DayVn = '2026-09-02'
          AND AvgValue = 84
          AND Samples = 1
    )
        THROW 59999, N'DailyEnvStats: ngay 02/09 sai', 1;

    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'views: PASS';
GO
