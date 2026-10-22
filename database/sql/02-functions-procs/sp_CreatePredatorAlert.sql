
CREATE OR ALTER PROCEDURE dbo.sp_CreatePredatorAlert
    @Json NVARCHAR(MAX),
    @MinConfidence DECIMAL(4, 3) = 0.5,
    @CooldownMinutes INT = 5
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Json IS NULL OR ISJSON(@Json) = 0
       OR LEFT(LTRIM(REPLACE(REPLACE(REPLACE(
           @Json, NCHAR(13), N''), NCHAR(10), N''), NCHAR(9), N'')), 1) <> N'{'
        THROW 50030, N'JSON phai la mot object hop le.', 1;

    IF @MinConfidence IS NULL
       OR @MinConfidence < 0
       OR @MinConfidence > 1
       OR @CooldownMinutes IS NULL
       OR @CooldownMinutes < 0
        THROW 50042, N'Tham so khong hop le.', 1;

    DECLARE
        @CameraCode NVARCHAR(200) = JSON_VALUE(@Json, '$.camera'),
        @Class NVARCHAR(50) = JSON_VALUE(@Json, '$.class'),
        @ConfText NVARCHAR(50) = JSON_VALUE(@Json, '$.confidence'),
        @Snapshot NVARCHAR(400) = JSON_VALUE(@Json, '$.snapshot'),
        @AtText NVARCHAR(100) = JSON_VALUE(@Json, '$.at');

    DECLARE @Conf DECIMAL(4, 3) =
        TRY_CONVERT(DECIMAL(4, 3), @ConfText);

    DECLARE @At3 DATETIME2(3) =
        CASE
            WHEN @AtText LIKE N'%Z'
            THEN TRY_CONVERT(DATETIME2(3), @AtText, 127)
        END;

    DECLARE @At DATETIME2(0) =
        CAST(
            DATEADD(
                MILLISECOND,
                -DATEPART(MILLISECOND, @At3),
                @At3
            ) AS DATETIME2(0)
        );

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

    IF @Class IS NULL
       OR @Class NOT IN (N'rat', N'snake', N'owl')
        THROW 50013, N'Loai thien dich khong hop le.', 1;

    DECLARE
        @CameraId INT,
        @ZoneId INT,
        @HouseId INT;

    SELECT
        @CameraId = d.DeviceId,
        @ZoneId = d.ZoneId,
        @HouseId = z.HouseId
    FROM dbo.Devices d
    JOIN dbo.Zones z
        ON z.ZoneId = d.ZoneId
    WHERE d.Code = @CameraCode
      AND d.DeviceType = 'CAMERA'
      AND d.IsActive = 1;

    IF @CameraId IS NULL
        THROW 50010, N'Camera khong hop le.', 1;

    IF @Conf IS NULL
       OR @Conf < 0
       OR @Conf > 1
       OR @Snapshot IS NULL
       OR LEN(@Snapshot) = 0
       OR LEN(@Snapshot) > 260
       OR @At IS NULL
       OR @At > DATEADD(MINUTE, 5, @Now)
        THROW 50042, N'Du lieu phat hien khong hop le.', 1;

    IF @Conf < @MinConfidence
    BEGIN
        SELECT
            Created = CAST(0 AS BIT),
            AlertId = CAST(NULL AS INT),
            SkipReason = 'LOW_CONFIDENCE',
            AlertJson = CAST(NULL AS NVARCHAR(MAX));
        RETURN;
    END;

    EXEC sys.sp_set_session_context
        @key = N'UserId',
        @value = NULL;

    EXEC sys.sp_set_session_context
        @key = N'Note',
        @value = NULL;

    DECLARE @New TABLE (AlertId INT NOT NULL);
    DECLARE @AlertId INT;

    BEGIN TRAN;

    IF EXISTS (
        SELECT 1
        FROM dbo.Alerts WITH (UPDLOCK, HOLDLOCK)
        WHERE DeviceId = @CameraId
          AND AlertType = 'PREDATOR'
          AND DetectedClass = @Class
          AND CreatedAt > DATEADD(MINUTE, -@CooldownMinutes, @At)
          AND CreatedAt < DATEADD(MINUTE, @CooldownMinutes, @At)
    )
    BEGIN
        COMMIT;

        SELECT
            Created = CAST(0 AS BIT),
            AlertId = CAST(NULL AS INT),
            SkipReason = 'COOLDOWN',
            AlertJson = CAST(NULL AS NVARCHAR(MAX));
        RETURN;
    END;

    INSERT dbo.Alerts (
        HouseId,
        ZoneId,
        DeviceId,
        AlertType,
        Severity,
        DetectedClass,
        Confidence,
        SnapshotPath,
        Message,
        CreatedAt
    )
    OUTPUT inserted.AlertId INTO @New (AlertId)
    VALUES (
        @HouseId,
        @ZoneId,
        @CameraId,
        'PREDATOR',
        'CRITICAL',
        @Class,
        @Conf,
        @Snapshot,
        CONCAT(
            N'Phát hiện ',
            CASE @Class
                WHEN N'rat' THEN N'chuột'
                WHEN N'snake' THEN N'rắn'
                ELSE N'cú'
            END,
            N' tại ',
            @CameraCode,
            N' (độ tin cậy ',
            CAST(@Conf * 100 AS DECIMAL(5, 1)),
            N'%)'
        ),
        @At
    );

    SELECT @AlertId = AlertId FROM @New;

    COMMIT;

    SELECT
        Created = CAST(1 AS BIT),
        AlertId = @AlertId,
        SkipReason = CAST(NULL AS VARCHAR(20)),
        AlertJson = (
            SELECT v.*
            FROM dbo.vw_AlertJson v
            WHERE v.AlertId = @AlertId
            FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER
        );
END
GO
