
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

-- 14 truong bat buoc trong JSON canh bao
CREATE TABLE #keys (
    k NVARCHAR(50) PRIMARY KEY
);

INSERT #keys (k) VALUES
    (N'AlertId'),
    (N'HouseId'),
    (N'ZoneId'),
    (N'DeviceId'),
    (N'AlertType'),
    (N'Severity'),
    (N'MetricCode'),
    (N'Value'),
    (N'DetectedClass'),
    (N'Confidence'),
    (N'HasSnapshot'),
    (N'Message'),
    (N'Status'),
    (N'CreatedAt');

CREATE TABLE #ing (
    Received INT,
    Accepted INT,
    Duplicates INT,
    Rejected INT,
    AcceptedJson NVARCHAR(MAX),
    NewAlertsJson NVARCHAR(MAX),
    ResolvedAlertIdsJson NVARCHAR(MAX)
);

CREATE TABLE #pr (
    Created BIT,
    AlertId INT,
    SkipReason VARCHAR(20),
    AlertJson NVARCHAR(MAX)
);

CREATE TABLE #da (
    NewAlertsJson NVARCHAR(MAX)
);
GO

PRINT N'json: kiem tra sp_IngestReadings';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @s NVARCHAR(30) = CONCAT(
        CONVERT(
            CHAR(19),
            CAST(SYSUTCDATETIME() AS DATETIME2(0)),
            126
        ),
        'Z'
    );

    DECLARE @j NVARCHAR(MAX) = CONCAT(
        N'[',
        N'{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"',
        @s,
        N'"},',
        N'{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"',
        @s,
        N'"},',
        N'{"device":"KHONG-CO","metric":"TEMP","value":31,"at":"',
        @s,
        N'"}]'
    );

    INSERT #ing
    EXEC dbo.sp_IngestReadings @j;

    -- Chi 1 ban ghi duoc chap nhan
    IF (
        SELECT COUNT(*)
        FROM OPENJSON(
            (SELECT AcceptedJson FROM #ing)
        )
    ) <> 1
        THROW 59999, N'AcceptedJson phai co 1 phan tu', 1;

    -- Thoi gian phai co ky tu Z
    IF EXISTS (
        SELECT 1
        FROM OPENJSON(
            (SELECT AcceptedJson FROM #ing)
        )
        WITH (RecordedAt NVARCHAR(40))
        WHERE RecordedAt NOT LIKE N'%Z'
    )
        THROW 59999, N'RecordedAt phai co Z', 1;

    DECLARE @alert NVARCHAR(MAX) = (
        SELECT JSON_QUERY(NewAlertsJson, '$[0]')
        FROM #ing
    );

    IF (SELECT COUNT(*) FROM OPENJSON(@alert)) <> 14
        THROW 59999, N'Canh bao phai co 14 khoa', 1;

    IF EXISTS (
    SELECT k COLLATE Latin1_General_BIN2 FROM #keys
    EXCEPT
    SELECT [key] FROM OPENJSON(@alert)
)
    THROW 59999, N'Thieu truong JSON canh bao', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM OPENJSON(@alert)
        WHERE [key] = N'DetectedClass'
          AND [type] = 0
    )
        THROW 59999, N'DetectedClass phai la null', 1;

    IF JSON_VALUE(@alert, '$.CreatedAt') NOT LIKE N'%Z'
        THROW 59999, N'CreatedAt phai co Z', 1;

    ROLLBACK;

    PRINT N'json: sp_IngestReadings PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'json: kiem tra sp_CreatePredatorAlert';

BEGIN TRY
    BEGIN TRAN;

    INSERT #pr
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"H2-F0-CAMERA","class":"rat","confidence":0.8,"snapshot":"snapshots/x.jpg","at":"2026-09-01T10:00:00Z"}';

    DECLARE @a NVARCHAR(MAX) = (
        SELECT AlertJson FROM #pr
    );

    IF (SELECT COUNT(*) FROM OPENJSON(@a)) <> 14
        THROW 59999, N'AlertJson phai co 14 khoa', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM OPENJSON(@a)
        WHERE [key] = N'MetricCode'
          AND [type] = 0
    )
        THROW 59999, N'MetricCode phai la null', 1;

    DELETE FROM #pr;

    -- Gui lai trong cooldown: khong tao canh bao moi
    INSERT #pr
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"H2-F0-CAMERA","class":"rat","confidence":0.8,"snapshot":"snapshots/y.jpg","at":"2026-09-01T10:01:00Z"}';

    IF (SELECT AlertJson FROM #pr) IS NOT NULL
        THROW 59999, N'AlertJson phai NULL khi Created = 0', 1;

    ROLLBACK;

    PRINT N'json: sp_CreatePredatorAlert PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'json: kiem tra sp_DetectAnomalies';

BEGIN TRY
    BEGIN TRAN;

    INSERT #da
    EXEC dbo.sp_DetectAnomalies
        @NowUtc = '2026-10-12T13:30:00';

    DECLARE @drop NVARCHAR(MAX) = (
        SELECT TOP (1) value
        FROM OPENJSON(
            (SELECT NewAlertsJson FROM #da)
        )
        WHERE JSON_VALUE(value, '$.AlertType') = 'POPULATION_DROP'
    );

    IF @drop IS NULL
        THROW 59999, N'Thieu POPULATION_DROP tu du lieu mau', 1;

    IF (SELECT COUNT(*) FROM OPENJSON(@drop)) <> 14
        THROW 59999, N'POPULATION_DROP phai co 14 khoa', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM OPENJSON(@drop)
        WHERE [key] = N'ZoneId'
          AND [type] = 0
    )
        THROW 59999, N'ZoneId phai la null', 1;

    ROLLBACK;

    PRINT N'json: sp_DetectAnomalies PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'sp_json-columns: PASS';
GO
