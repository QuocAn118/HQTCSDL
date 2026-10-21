DROP TABLE IF EXISTS #ing;
DROP TABLE IF EXISTS #r;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE #ing (
    Received INT,
    Accepted INT,
    Duplicates INT,
    Rejected INT,
    AcceptedJson NVARCHAR(MAX),
    NewAlertsJson NVARCHAR(MAX),
    ResolvedAlertIdsJson NVARCHAR(MAX)
);

CREATE TABLE #r (
    AlertId INT,
    HouseId INT,
    ZoneId INT,
    AlertType VARCHAR(20),
    Status VARCHAR(10),
    ResolvedAt DATETIME2(0),
    ResolvedBy INT
);
GO

PRINT N'trigger: kiem tra lich su NEW -> ACK';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @j NVARCHAR(MAX) = CONCAT(
        N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"',
        CONVERT(
            CHAR(19),
            CAST(SYSUTCDATETIME() AS DATETIME2(0)),
            126
        ),
        N'Z"}]'
    );

    INSERT #ing
    EXEC dbo.sp_IngestReadings @Json = @j;

    DECLARE @a INT = (
        SELECT CAST(
            JSON_VALUE(NewAlertsJson, '$[0].AlertId')
            AS INT
        )
        FROM #ing
    );

    IF @a IS NULL
        THROW 59999, N'Khong tao duoc canh bao', 1;

    -- Tao canh bao phai co 1 dong lich su
    IF (
        SELECT COUNT(*)
        FROM dbo.AlertHistory
        WHERE AlertId = @a
    ) <> 1
        THROW 59999, N'Thieu lich su NEW', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.AlertHistory
        WHERE AlertId = @a
          AND OldStatus IS NULL
          AND NewStatus = 'NEW'
          AND UserId IS NULL
    )
        THROW 59999, N'Lich su NEW khong dung', 1;

    DECLARE @u INT = (
        SELECT UserId
        FROM dbo.Users
        WHERE Username = 'owner1'
    );

    INSERT #r
    EXEC dbo.sp_UpdateAlertStatus
        @AlertId = @a,
        @Status = 'ACK',
        @UserId = @u,
        @Note = N'Đã kiểm tra cảnh báo';

    -- ACK phai tao them 1 dong lich su
    IF (
        SELECT COUNT(*)
        FROM dbo.AlertHistory
        WHERE AlertId = @a
    ) <> 2
        THROW 59999, N'Thieu lich su ACK', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.AlertHistory
        WHERE AlertId = @a
          AND OldStatus = 'NEW'
          AND NewStatus = 'ACK'
          AND UserId = @u
          AND Note = N'Đã kiểm tra cảnh báo'
    )
        THROW 59999, N'Lich su ACK khong dung', 1;

    -- Session context phai duoc xoa
    IF SESSION_CONTEXT(N'UserId') IS NOT NULL
       OR SESSION_CONTEXT(N'Note') IS NOT NULL
        THROW 59999, N'SESSION_CONTEXT chua duoc xoa', 1;

    -- Doi Message khong duoc tao them lich su
    UPDATE dbo.Alerts
    SET Message = N'Cập nhật nội dung'
    WHERE AlertId = @a;

    IF (
        SELECT COUNT(*)
        FROM dbo.AlertHistory
        WHERE AlertId = @a
    ) <> 2
        THROW 59999, N'Trigger ghi lich su du thua', 1;

    ROLLBACK;

    PRINT N'trg_Alerts_History: PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
GO


PRINT N'trigger: cap nhat nhieu canh bao cung luc';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @zone INT = (
        SELECT TOP (1) ZoneId
        FROM dbo.Zones
        ORDER BY ZoneId
    );

    DECLARE @house INT = (
        SELECT HouseId
        FROM dbo.Zones
        WHERE ZoneId = @zone
    );

    DECLARE @ids TABLE (AlertId INT);


    INSERT dbo.Alerts
    (HouseId, ZoneId, AlertType, Severity,
        MetricCode, Value, Message)
    OUTPUT inserted.AlertId INTO @ids
    VALUES
        (@house, @zone, 'THRESHOLD', 'WARNING',
        'TEMP', 31.00, N'Tnpm testest 1'),
        (@house, @zone, 'THRESHOLD', 'WARNING',
        'HUMID', 85.00, N'Test 2');


    DECLARE @before INT = (
        SELECT COUNT(*)
        FROM dbo.AlertHistory
        WHERE AlertId IN (SELECT AlertId FROM @ids)
    );

    IF @before <> 2
        THROW 59999, N'Thieu lich su tao canh bao', 1;

    UPDATE dbo.Alerts
    SET Status = 'ACK'
    WHERE AlertId IN (SELECT AlertId FROM @ids);

    IF (
        SELECT COUNT(*)
        FROM dbo.AlertHistory
        WHERE AlertId IN (SELECT AlertId FROM @ids)
    ) <> 4
        THROW 59999, N'Trigger khong xu ly du 2 canh bao', 1;

    ROLLBACK;

    PRINT N'trigger: multi-row PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
GO
