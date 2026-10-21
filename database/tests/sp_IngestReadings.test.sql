
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE #r (
    Received INT,
    Accepted INT,
    Duplicates INT,
    Rejected INT,
    AcceptedJson NVARCHAR(MAX),
    NewAlertsJson NVARCHAR(MAX),
    ResolvedAlertIdsJson NVARCHAR(MAX)
);
GO

PRINT N'ingest: hop le 1 so do';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @t DATETIME2(0) =
        CAST(SYSUTCDATETIME() AS DATETIME2(0));

    DECLARE @j NVARCHAR(MAX) = CONCAT(
        N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":28.5,"at":"',
        CONVERT(CHAR(19), @t, 126),
        N'Z"}]'
    );

    INSERT #r
    EXEC dbo.sp_IngestReadings @Json = @j;

    IF (SELECT Received FROM #r) <> 1
       OR (SELECT Accepted FROM #r) <> 1
       OR (SELECT Rejected FROM #r) <> 0
        THROW 59999, N'ingest hop le: dem sai', 1;

    ROLLBACK;
    PRINT N'sp_IngestReadings: PASS';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH;
GO


PRINT N'ingest: JSON khong hop le -> 50030';

BEGIN TRY
    BEGIN TRAN;

    EXEC dbo.sp_IngestReadings
        @Json = N'khong phai json';

    THROW 59999, N'Mong doi loi 50030', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;

    IF ERROR_NUMBER() <> 50030
        THROW;
END CATCH;
GO

PRINT N'ingest: JSON object thay vi array -> 50030';

BEGIN TRY
    BEGIN TRAN;

    EXEC dbo.sp_IngestReadings
        @Json = N'{"device":"H1-F1-SENSOR"}';

    THROW 59999, N'Mong doi loi 50030', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;

    IF ERROR_NUMBER() <> 50030
        THROW;
END CATCH;
GO

PRINT N'ingest: StaleMinutes = 0 -> 50042';

BEGIN TRY
    BEGIN TRAN;

    EXEC dbo.sp_IngestReadings
        @Json = N'[]',
        @StaleMinutes = 0;

    THROW 59999, N'Mong doi loi 50042', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;

    IF ERROR_NUMBER() <> 50042
        THROW;
END CATCH;
GO


PRINT N'ingest: du lieu trung trong cung mot lo';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @t2 DATETIME2(0) =
        CAST(SYSUTCDATETIME() AS DATETIME2(0));

    DECLARE @j2 NVARCHAR(MAX) = CONCAT(
        N'[',
        N'{"device":"H1-F1-SENSOR","metric":"TEMP","value":28,"at":"',
        CONVERT(CHAR(19), @t2, 126),
        N'Z"},',
        N'{"device":"H1-F1-SENSOR","metric":"TEMP","value":29,"at":"',
        CONVERT(CHAR(19), @t2, 126),
        N'Z"}]'
    );

    CREATE TABLE #duplicateResult (
        Received INT,
        Accepted INT,
        Duplicates INT,
        Rejected INT,
        AcceptedJson NVARCHAR(MAX),
        NewAlertsJson NVARCHAR(MAX),
        ResolvedAlertIdsJson NVARCHAR(MAX)
    );

    INSERT #duplicateResult
    EXEC dbo.sp_IngestReadings @Json = @j2;

    IF NOT EXISTS (
        SELECT 1
        FROM #duplicateResult
        WHERE Received = 2
          AND Accepted = 1
          AND Duplicates = 1
          AND Rejected = 0
    )
        THROW 59999, N'ingest: dem du lieu trung sai', 1;

    ROLLBACK;

    PRINT N'ingest: duplicate PASS';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
GO


PRINT N'ingest: canh bao vuot nguong va hysteresis';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @zone INT = (
        SELECT z.ZoneId
        FROM dbo.Zones z
        JOIN dbo.Houses h ON h.HouseId = z.HouseId
        WHERE h.Name = N'H1' AND z.Name = N'F1'
    );

    DECLARE @base DATETIME2(0) =
        CAST(SYSUTCDATETIME() AS DATETIME2(0));

    DECLARE @json NVARCHAR(MAX);
    DECLARE @value DECIMAL(9,2);
    DECLARE @step INT = 0;

    CREATE TABLE #hResult (
        Received INT,
        Accepted INT,
        Duplicates INT,
        Rejected INT,
        AcceptedJson NVARCHAR(MAX),
        NewAlertsJson NVARCHAR(MAX),
        ResolvedAlertIdsJson NVARCHAR(MAX)
    );

    -- 31 > MaxValue 30: mo canh bao
    SET @value = 31;

    SET @json = CONCAT(
        N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":',
        @value,
        N',"at":"', CONVERT(CHAR(19), @base, 126), N'Z"}]'
    );

    INSERT #hResult
    EXEC dbo.sp_IngestReadings @Json = @json;

    IF NOT EXISTS (
        SELECT 1 FROM #hResult
        WHERE Accepted = 1
          AND ISJSON(NewAlertsJson) = 1
          AND EXISTS (
              SELECT 1 FROM OPENJSON(NewAlertsJson)
          )
    )
        THROW 59999, N'Khong tao canh bao vuot nguong', 1;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.Alerts
        WHERE ZoneId = @zone
          AND MetricCode = 'TEMP'
          AND AlertType = 'THRESHOLD'
          AND Status <> 'RESOLVED'
    )
        THROW 59999, N'Canh bao chua duoc mo', 1;

    DELETE FROM #hResult;

    -- 29.8: van chua du nguong hysteresis de dong
    SET @value = 29.8;
    SET @step = 1;

    SET @json = CONCAT(
        N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":',
        @value,
        N',"at":"',
        CONVERT(CHAR(19), DATEADD(SECOND, @step, @base), 126),
        N'Z"}]'
    );

    INSERT #hResult
    EXEC dbo.sp_IngestReadings @Json = @json;

    IF EXISTS (
        SELECT 1 FROM dbo.Alerts
        WHERE ZoneId = @zone
          AND MetricCode = 'TEMP'
          AND AlertType = 'THRESHOLD'
          AND Status = 'RESOLVED'
    )
        THROW 59999, N'Hysteresis: dong canh bao qua som', 1;

    DELETE FROM #hResult;

    -- 29: du dieu kien dong canh bao
    SET @value = 29;
    SET @step = 2;

    SET @json = CONCAT(
        N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":',
        @value,
        N',"at":"',
        CONVERT(CHAR(19), DATEADD(SECOND, @step, @base), 126),
        N'Z"}]'
    );

    INSERT #hResult
    EXEC dbo.sp_IngestReadings @Json = @json;

    IF NOT EXISTS (
        SELECT 1 FROM #hResult
        WHERE ISJSON(ResolvedAlertIdsJson) = 1
          AND EXISTS (
              SELECT 1 FROM OPENJSON(ResolvedAlertIdsJson)
          )
    )
        THROW 59999, N'Hysteresis: khong dong canh bao', 1;

    ROLLBACK;

    PRINT N'ingest: hysteresis PASS';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
GO
