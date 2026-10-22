
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE #da (
    NewAlertsJson NVARCHAR(MAX)
);

CREATE TABLE #ing (
    Received INT,
    Accepted INT,
    Duplicates INT,
    Rejected INT,
    AcceptedJson NVARCHAR(MAX),
    NewAlertsJson NVARCHAR(MAX),
    ResolvedAlertIdsJson NVARCHAR(MAX)
);
GO

PRINT N'offline: phat hien 6 cam bien mat ket noi';

BEGIN TRY
    BEGIN TRAN;

    -- 35 phut sau lan ghi nhan cuoi
    INSERT #da
    EXEC dbo.sp_DetectAnomalies
        @NowUtc = '2026-10-12T13:30:00';

    IF (
        SELECT COUNT(*)
        FROM dbo.Devices
        WHERE DeviceType = 'SENSOR'
          AND Status = 'OFFLINE'
    ) <> 6
        THROW 59999, N'offline: 6 cam bien phai OFFLINE', 1;

    IF (
        SELECT COUNT(*)
        FROM dbo.Alerts
        WHERE AlertType = 'DEVICE_OFFLINE'
          AND Status = 'NEW'
          AND Severity = 'WARNING'
          AND ZoneId IS NOT NULL
          AND DeviceId IS NOT NULL
    ) <> 6
        THROW 59999, N'offline: phai co 6 canh bao WARNING', 1;

    IF (
        SELECT COUNT(*)
        FROM OPENJSON((SELECT NewAlertsJson FROM #da))
        WHERE JSON_VALUE(value, '$.AlertType') = 'DEVICE_OFFLINE'
    ) <> 6
        THROW 59999, N'offline: JSON phai co 6 canh bao', 1;

    IF EXISTS (
        SELECT 1
        FROM dbo.Devices
        WHERE DeviceType <> 'SENSOR'
          AND Status = 'ONLINE'
    )
        THROW 59999, N'offline: khong duoc tac dong thiet bi khac', 1;

    DELETE #da;

    -- Chay lan hai khong duoc tao canh bao trung
    INSERT #da
    EXEC dbo.sp_DetectAnomalies
        @NowUtc = '2026-10-12T13:31:00';

    IF (
        SELECT COUNT(*)
        FROM dbo.Alerts
        WHERE AlertType = 'DEVICE_OFFLINE'
    ) <> 6
        THROW 59999, N'offline: khong duoc tao canh bao trung', 1;

    -- Cam bien gui du lieu tro lai
    DECLARE @j NVARCHAR(MAX) = CONCAT(
        N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":28,"at":"',
        CONVERT(
            CHAR(19),
            CAST(SYSUTCDATETIME() AS DATETIME2(0)),
            126
        ),
        N'Z"}]'
    );

    INSERT #ing
    EXEC dbo.sp_IngestReadings @j;

    -- Canh bao mat ket noi phai tu dong dong
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Alerts a
        JOIN dbo.Devices d ON d.DeviceId = a.DeviceId
        WHERE d.Code = 'H1-F1-SENSOR'
          AND a.AlertType = 'DEVICE_OFFLINE'
          AND a.Status = 'RESOLVED'
          AND a.ResolvedBy IS NULL
    )
        THROW 59999, N'offline: phai tu dong dong canh bao', 1;

    -- Lich su dong canh bao phai duoc ghi nhan
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.AlertHistory h
        JOIN dbo.Alerts a ON a.AlertId = h.AlertId
        JOIN dbo.Devices d ON d.DeviceId = a.DeviceId
        WHERE d.Code = 'H1-F1-SENSOR'
          AND a.AlertType = 'DEVICE_OFFLINE'
          AND h.NewStatus = 'RESOLVED'
          AND h.UserId IS NULL
    )
        THROW 59999, N'offline: thieu lich su dong canh bao', 1;

    -- Client phai nhan duoc ID canh bao vua dong
    IF (
        SELECT COUNT(*)
        FROM OPENJSON((SELECT ResolvedAlertIdsJson FROM #ing))
    ) <> 1
        THROW 59999, N'offline: phai tra ve 1 AlertId', 1;

    IF (
        SELECT CAST(
            JSON_VALUE(ResolvedAlertIdsJson, '$[0].AlertId')
            AS INT
        )
        FROM #ing
    ) <> (
        SELECT a.AlertId
        FROM dbo.Alerts a
        JOIN dbo.Devices d ON d.DeviceId = a.DeviceId
        WHERE d.Code = 'H1-F1-SENSOR'
          AND a.AlertType = 'DEVICE_OFFLINE'
    )
        THROW 59999, N'offline: AlertId khong khop', 1;

    ROLLBACK;

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'offline: kiem tra trigger nhieu thiet bi';

BEGIN TRY
    BEGIN TRAN;

    -- Cap nhat dong thoi 2 thiet bi
    UPDATE dbo.Devices
    SET Status = 'OFFLINE'
    WHERE Code IN ('H1-F1-SENSOR', 'H1-F2-SENSOR');

    IF (
        SELECT COUNT(*)
        FROM dbo.Alerts
        WHERE AlertType = 'DEVICE_OFFLINE'
    ) <> 2
        THROW 59999, N'offline: phai tao 2 canh bao', 1;

    -- ERROR phai tao canh bao CRITICAL
    UPDATE dbo.Devices
    SET Status = 'ERROR'
    WHERE Code = 'H2-F1-SENSOR';

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Alerts a
        JOIN dbo.Devices d ON d.DeviceId = a.DeviceId
        WHERE d.Code = 'H2-F1-SENSOR'
          AND a.AlertType = 'DEVICE_OFFLINE'
          AND a.Severity = 'CRITICAL'
    )
        THROW 59999, N'offline: ERROR phai la CRITICAL', 1;

    -- Chi doi ten thiet bi thi khong tao canh bao
    UPDATE dbo.Devices
    SET Name = N'Doi ten'
    WHERE Code = 'H2-F0-SENSOR';

    IF (
        SELECT COUNT(*)
        FROM dbo.Alerts
        WHERE AlertType = 'DEVICE_OFFLINE'
    ) <> 3
        THROW 59999, N'offline: doi ten khong duoc tao canh bao', 1;

    ROLLBACK;

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'trg_Devices_Status: PASS';
GO
