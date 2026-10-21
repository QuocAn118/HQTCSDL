
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

PRINT N'alert status: NEW -> ACK -> RESOLVED';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @j NVARCHAR(MAX) = CONCAT(
        N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"',
        CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126),
        N'Z"}]'
    );

    INSERT #ing
    EXEC dbo.sp_IngestReadings @Json = @j;

    DECLARE @a INT = (
        SELECT CAST(JSON_VALUE(NewAlertsJson, '$[0].AlertId') AS INT)
        FROM #ing
    );

    DECLARE @u INT = (
        SELECT UserId
        FROM dbo.Users
        WHERE Username = 'owner1'
    );

    IF @a IS NULL
        THROW 59999, N'Khong tao duoc canh bao de kiem thu', 1;

    INSERT #r
    EXEC dbo.sp_UpdateAlertStatus
        @AlertId = @a,
        @Status = 'ACK',
        @UserId = @u,
        @Note = N'Da kiem tra';

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE AlertId = @a
          AND Status = 'ACK'
          AND ResolvedAt IS NULL
          AND ResolvedBy IS NULL
          AND HouseId IS NOT NULL
    )
        THROW 59999, N'ACK: ket qua sai', 1;

    DELETE FROM #r;

    INSERT #r
    EXEC dbo.sp_UpdateAlertStatus
        @AlertId = @a,
        @Status = 'RESOLVED',
        @UserId = @u;

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE AlertId = @a
          AND Status = 'RESOLVED'
          AND ResolvedAt IS NOT NULL
          AND ResolvedBy = @u
    )
        THROW 59999, N'RESOLVED: ket qua sai', 1;

    ROLLBACK;

    PRINT N'sp_UpdateAlertStatus: PASS';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
GO
