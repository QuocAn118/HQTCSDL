SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

SET NOCOUNT ON;
SET XACT_ABORT OFF;
DECLARE @DeviceId INT;
DECLARE @ZoneId INT;
DECLARE @At VARCHAR(30);
DECLARE @Json NVARCHAR(MAX);
DECLARE @NewAlertsJson NVARCHAR(MAX);
DECLARE @AlertCount INT;
DECLARE @HistoryCount INT;
DECLARE @ErrorNumber INT;
DECLARE @ZoneName NVARCHAR(100);

SELECT TOP 1
    @DeviceId = d.DeviceId,
    @ZoneId = d.ZoneId
FROM dbo.Devices d
WHERE d.Code = 'H1-F1-SENSOR';

IF @DeviceId IS NULL
    THROW 59998, 'Khong tim thay H1-F1-SENSOR.', 1;

SET @At = CONCAT(
    CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126),
    'Z'
);

-- CA1: app_backend ingest readings va tao threshold alert.
BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (
        SELECT 1
        FROM dbo.Alerts
        WHERE ZoneId = @ZoneId
          AND AlertType = 'THRESHOLD'
          AND MetricCode = 'TEMP'
          AND Status <> 'RESOLVED'
    )
        THROW 59998, 'ca1: tien dieu kien - da co threshold alert chua resolve.', 1;

    DECLARE @R1 TABLE (
        Received INT,
        Accepted INT,
        Duplicates INT,
        Rejected INT,
        AcceptedJson NVARCHAR(MAX),
        NewAlertsJson NVARCHAR(MAX),
        ResolvedAlertIdsJson NVARCHAR(MAX)
    );

    SET @Json = CONCAT(
        '[{"device":"H1-F1-SENSOR","metric":"TEMP","value":35.0,"at":"',
        @At,
        '"}]'
    );

    EXECUTE AS USER = 'app_backend';

    INSERT INTO @R1
    EXEC dbo.sp_IngestReadings @Json = @Json;

    REVERT;

    SELECT @NewAlertsJson = NewAlertsJson FROM @R1;

    SELECT @AlertCount = COUNT(*)
    FROM OPENJSON(@NewAlertsJson);

    IF @AlertCount <> 1
        THROW 59999, 'ca1: khong tao dung 1 alert moi.', 1;

    SELECT @HistoryCount = COUNT(*)
    FROM dbo.AlertHistory h
    JOIN OPENJSON(@NewAlertsJson)
        WITH (AlertId INT '$.AlertId') j
        ON j.AlertId = h.AlertId;

    IF @HistoryCount <> 1
        THROW 59999, 'ca1: AlertHistory khong ghi nhan alert moi.', 1;

    ROLLBACK TRANSACTION;
    PRINT 'PASS: ca1-ingest-vuot-nguong';
END TRY
BEGIN CATCH
    IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
        REVERT;

    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;

-- CA2: app_backend cap nhat Devices va trigger tao DEVICE_OFFLINE alert.
IF OBJECT_ID(N'dbo.trg_Devices_Status', N'TR') IS NOT NULL
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (
            SELECT 1
            FROM dbo.Alerts
            WHERE DeviceId = @DeviceId
              AND AlertType = 'DEVICE_OFFLINE'
              AND Status <> 'RESOLVED'
        )
            THROW 59998, 'ca2: tien dieu kien - device da co offline alert chua resolve.', 1;

        -- Dua device ve ONLINE truoc khi kiem tra trigger.
        UPDATE dbo.Devices
        SET Status = 'ONLINE'
        WHERE DeviceId = @DeviceId
          AND Status <> 'ONLINE';

        DECLARE @R2 TABLE (
            Received INT,
            Accepted INT,
            Duplicates INT,
            Rejected INT,
            AcceptedJson NVARCHAR(MAX),
            NewAlertsJson NVARCHAR(MAX),
            ResolvedAlertIdsJson NVARCHAR(MAX)
        );

        SET @Json = CONCAT(
            '[{"device":"H1-F1-SENSOR","metric":"TEMP","value":28.0,"at":"',
            @At,
            '"}]'
        );

        EXECUTE AS USER = 'app_backend';

        INSERT INTO @R2
        EXEC dbo.sp_IngestReadings @Json = @Json;

        UPDATE dbo.Devices
        SET Status = 'OFFLINE'
        WHERE DeviceId = @DeviceId;

        REVERT;

        SELECT @AlertCount = COUNT(*)
        FROM dbo.Alerts
        WHERE DeviceId = @DeviceId
          AND AlertType = 'DEVICE_OFFLINE'
          AND Status <> 'RESOLVED';

        IF @AlertCount <> 1
            THROW 59999, 'ca2: trigger khong tao dung 1 DEVICE_OFFLINE alert.', 1;

        ROLLBACK TRANSACTION;
        PRINT 'PASS: ca2-trigger-devices';
    END TRY
    BEGIN CATCH
        IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
            REVERT;

        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;
END
ELSE
    PRINT 'SKIP: ca2-trigger-devices - trigger khong ton tai';

-- CA3: ca hai user doc duoc vw_OpenAlerts.
BEGIN TRY
    BEGIN TRANSACTION;
    EXECUTE AS USER = 'app_backend';
    SELECT TOP 1 * FROM dbo.vw_OpenAlerts;
    REVERT;
    ROLLBACK TRANSACTION;
    PRINT 'PASS: ca3-doc-view-app_backend';
END TRY
BEGIN CATCH
    IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
        REVERT;
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

BEGIN TRY
    BEGIN TRANSACTION;
    EXECUTE AS USER = 'app_report';
    SELECT TOP 1 * FROM dbo.vw_OpenAlerts;
    REVERT;
    ROLLBACK TRANSACTION;
    PRINT 'PASS: ca3-doc-view-app_report';
END TRY
BEGIN CATCH
    IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
        REVERT;
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- CA4: app_backend doc Users duoc, app_report bi tu choi.
BEGIN TRY
    BEGIN TRANSACTION;
    EXECUTE AS USER = 'app_backend';
    SELECT TOP 1 UserId FROM dbo.Users;    
    REVERT;
    ROLLBACK TRANSACTION;
    PRINT 'PASS: ca4-doc-bang-app_backend';
END TRY
BEGIN CATCH
    IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
        REVERT;
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

BEGIN TRY
    BEGIN TRANSACTION;
    EXECUTE AS USER = 'app_report';
    SELECT TOP 1 UserId FROM dbo.Users;
    REVERT;
    THROW 59999, 'ca4: app_report doc duoc Users, trai voi thiet ke.', 1;
END TRY
BEGIN CATCH
    IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
        REVERT;

    SET @ErrorNumber = ERROR_NUMBER();

    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;

    IF @ErrorNumber <> 229
        THROW 59999, 'ca4: app_report khong bi tu choi voi loi 229 nhu mong doi.', 1;

    PRINT 'PASS: ca4-doc-bang-app_report-bi-tu-choi';
END CATCH;

-- CA5: app_report khong duoc EXECUTE sp_GetReadingHistory.
BEGIN TRY
    BEGIN TRANSACTION;
    EXECUTE AS USER = 'app_report';

    EXEC dbo.sp_GetReadingHistory
        @ZoneId = @ZoneId,
        @MetricCode = 'TEMP',
        @FromUtc = '2026-01-01',
        @ToUtc = '2027-01-01',
        @BucketMinutes = 60;

    REVERT;
    THROW 59999, 'ca5: app_report EXECUTE duoc stored procedure.', 1;
END TRY
BEGIN CATCH
    IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
        REVERT;

    SET @ErrorNumber = ERROR_NUMBER();

    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;

    IF @ErrorNumber <> 229
        THROW 59999, 'ca5: khong nhan duoc loi permission 229.', 1;

    PRINT 'PASS: ca5-exec-bi-tu-choi';
END CATCH;

-- CA6: ca hai user khong duoc DELETE Alerts.
BEGIN TRY
    BEGIN TRANSACTION;
    EXECUTE AS USER = 'app_backend';
    DELETE FROM dbo.Alerts WHERE 1 = 0;
    REVERT;
    THROW 59999, 'ca6: app_backend DELETE duoc Alerts.', 1;
END TRY
BEGIN CATCH
    IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
        REVERT;
    SET @ErrorNumber = ERROR_NUMBER();
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    IF @ErrorNumber <> 229
        THROW 59999, 'ca6: app_backend khong bi tu choi DELETE voi loi 229.', 1;
    PRINT 'PASS: ca6-delete-app_backend-bi-tu-choi';
END CATCH;

BEGIN TRY
    BEGIN TRANSACTION;
    EXECUTE AS USER = 'app_report';
    DELETE FROM dbo.Alerts WHERE 1 = 0;
    REVERT;
    THROW 59999, 'ca6: app_report DELETE duoc Alerts.', 1;
END TRY
BEGIN CATCH
    IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
        REVERT;
    SET @ErrorNumber = ERROR_NUMBER();
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    IF @ErrorNumber <> 229
        THROW 59999, 'ca6: app_report khong bi tu choi DELETE voi loi 229.', 1;
    PRINT 'PASS: ca6-delete-app_report-bi-tu-choi';
END CATCH;

-- CA7: ca hai user khong duoc DROP TABLE.
BEGIN TRY
    BEGIN TRANSACTION;
    EXECUTE AS USER = 'app_backend';
    DROP TABLE dbo.SensorReadings;
    REVERT;
    THROW 59999, 'ca7: app_backend DROP TABLE duoc.', 1;
END TRY
BEGIN CATCH
    IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
        REVERT;
    SET @ErrorNumber = ERROR_NUMBER();
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    IF @ErrorNumber <> 3701
        THROW 59999, 'ca7: app_backend khong nhan loi 3701 nhu mong doi.', 1;
    PRINT 'PASS: ca7-drop-app_backend-bi-tu-choi';
END CATCH;

BEGIN TRY
    BEGIN TRANSACTION;
    EXECUTE AS USER = 'app_report';
    DROP TABLE dbo.SensorReadings;
    REVERT;
    THROW 59999, 'ca7: app_report DROP TABLE duoc.', 1;
END TRY
BEGIN CATCH
    IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
        REVERT;
    SET @ErrorNumber = ERROR_NUMBER();
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    IF @ErrorNumber <> 3701
        THROW 59999, 'ca7: app_report khong nhan loi 3701 nhu mong doi.', 1;
    PRINT 'PASS: ca7-drop-app_report-bi-tu-choi';
END CATCH;

-- CA8: ca hai user khong duoc CREATE TABLE.
BEGIN TRY
    BEGIN TRANSACTION;
    EXECUTE AS USER = 'app_backend';

    CREATE TABLE dbo.x_probe (a INT);

    REVERT;
    THROW 59999, 'ca8: app_backend CREATE TABLE duoc.', 1;
END TRY
BEGIN CATCH
    SET @ErrorNumber = ERROR_NUMBER();

    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
        REVERT;

    IF @ErrorNumber <> 262
        THROW 59999, 'ca8: app_backend khong nhan loi 262 nhu mong doi.', 1;

    PRINT 'PASS: ca8-create-app_backend-bi-tu-choi';
END CATCH;

BEGIN TRY
    BEGIN TRANSACTION;
    EXECUTE AS USER = 'app_report';

    CREATE TABLE dbo.x_probe (a INT);

    REVERT;
    THROW 59999, 'ca8: app_report CREATE TABLE duoc.', 1;
END TRY
BEGIN CATCH
    SET @ErrorNumber = ERROR_NUMBER();

    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    IF USER_NAME() = 'app_backend' OR USER_NAME() = 'app_report'
        REVERT;

    IF @ErrorNumber <> 262
        THROW 59999, 'ca8: app_report khong nhan loi 262 nhu mong doi.', 1;

    PRINT 'PASS: ca8-create-app_report-bi-tu-choi';
END CATCH;