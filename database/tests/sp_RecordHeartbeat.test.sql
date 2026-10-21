
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE #r (
    Accepted INT,
    Rejected INT,
    ResolvedAlertIdsJson NVARCHAR(MAX)
);
GO

PRINT N'heartbeat: cap nhat LastSeenAt va trang thai ONLINE';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @t DATETIME2(0) =
        CAST(SYSUTCDATETIME() AS DATETIME2(0));

    DECLARE @j NVARCHAR(MAX) = CONCAT(
        N'[{"device":"H1-F1-FAN","at":"',
        CONVERT(CHAR(19), @t, 126),
        N'Z"}]'
    );

    INSERT #r
    EXEC dbo.sp_RecordHeartbeat @j;

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE Accepted = 1
          AND Rejected = 0
          AND ResolvedAlertIdsJson = N'[]'
    )
        THROW 59999, N'heartbeat: dem sai hoac JSON sai', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Devices
        WHERE Code = 'H1-F1-FAN'
          AND Status = 'ONLINE'
          AND LastSeenAt = @t
    )
        THROW 59999, N'heartbeat: phai ONLINE va cap nhat LastSeenAt', 1;

    DELETE #r;

    -- Thoi gian cu hon khong duoc ghi de thoi gian moi
    SET @j = CONCAT(
        N'[{"device":"H1-F1-FAN","at":"',
        CONVERT(CHAR(19), DATEADD(MINUTE, -3, @t), 126),
        N'Z"}]'
    );

    INSERT #r
    EXEC dbo.sp_RecordHeartbeat @j;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Devices
        WHERE Code = 'H1-F1-FAN'
          AND LastSeenAt = @t
    )
        THROW 59999, N'heartbeat: khong duoc ghi de thoi gian moi', 1;

    DELETE #r;

    -- Kiem tra 3 du lieu khong hop le
    UPDATE dbo.Devices
    SET IsActive = 0
    WHERE Code = 'H1-F2-FAN';

    SET @j = CONCAT(
        N'[{"device":"KHONG-CO","at":"',
        CONVERT(CHAR(19), @t, 126),
        N'Z"},',
        N'{"device":"H1-F2-FAN","at":"',
        CONVERT(CHAR(19), @t, 126),
        N'Z"},',
        N'{"device":"H1-F3-FAN","at":"',
        CONVERT(CHAR(19), @t, 126),
        N'"}]'
    );

    INSERT #r
    EXEC dbo.sp_RecordHeartbeat @j;

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE Accepted = 0
          AND Rejected = 3
    )
        THROW 59999, N'heartbeat: phai tu choi 3 phan tu sai', 1;

    ROLLBACK;

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'heartbeat: kiem tra tu dong dong DEVICE_OFFLINE';

BEGIN TRY
    BEGIN TRAN;

    UPDATE dbo.Devices
    SET Status = 'ONLINE'
    WHERE Code = 'H1-F1-FAN';

    UPDATE dbo.Devices
    SET Status = 'OFFLINE'
    WHERE Code = 'H1-F1-FAN';

    DECLARE @off INT = (
        SELECT a.AlertId
        FROM dbo.Alerts a
        JOIN dbo.Devices d ON d.DeviceId = a.DeviceId
        WHERE d.Code = 'H1-F1-FAN'
          AND a.AlertType = 'DEVICE_OFFLINE'
          AND a.Status = 'NEW'
    );

    IF @off IS NULL
        THROW 59999, N'heartbeat: trigger phai tao DEVICE_OFFLINE', 1;

    DECLARE @j NVARCHAR(MAX) = CONCAT(
        N'[{"device":"H1-F1-FAN","at":"',
        CONVERT(
            CHAR(19),
            CAST(SYSUTCDATETIME() AS DATETIME2(0)),
            126
        ),
        N'Z"}]'
    );

    INSERT #r
    EXEC dbo.sp_RecordHeartbeat @j;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Alerts
        WHERE AlertId = @off
          AND Status = 'RESOLVED'
          AND ResolvedBy IS NULL
    )
        THROW 59999, N'heartbeat: canh bao phai tu dong dong', 1;

    IF (
        SELECT COUNT(*)
        FROM OPENJSON((SELECT ResolvedAlertIdsJson FROM #r))
    ) <> 1
        THROW 59999, N'heartbeat: phai tra ve 1 AlertId', 1;

    IF (
        SELECT CAST(
            JSON_VALUE(ResolvedAlertIdsJson, '$[0].AlertId')
            AS INT
        )
        FROM #r
    ) <> @off
        THROW 59999, N'heartbeat: AlertId khong khop', 1;

    DELETE #r;

    -- Gui lai heartbeat: khong duoc dong trung
    INSERT #r
    EXEC dbo.sp_RecordHeartbeat @j;

    IF (SELECT ResolvedAlertIdsJson FROM #r) <> N'[]'
        THROW 59999, N'heartbeat: khong duoc dong lap lai', 1;

    ROLLBACK;

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'heartbeat: kiem tra JSON khong hop le';

BEGIN TRY
    BEGIN TRAN;

    EXEC dbo.sp_RecordHeartbeat
        N'{"device":"H1-F1-FAN"}';

    THROW 59999, N'Mong doi loi 50030', 1;

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50030 THROW;
END CATCH
GO

PRINT N'sp_RecordHeartbeat: PASS';
GO
