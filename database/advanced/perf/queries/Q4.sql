SET NOCOUNT ON;

DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
DECLARE @Json NVARCHAR(MAX);
DECLARE @PayloadCount INT;

;WITH Slots AS (
    SELECT v.SecondsAgo
    FROM (VALUES
        (0), (1), (2), (3), (4), (5), (6), (7), (8), (9),
        (10), (11), (12), (13), (14), (15), (16), (17), (18), (19),
        (20), (21), (22), (23), (24), (25), (26), (27), (28), (29),
        (30), (31), (32), (33), (34), (35), (36), (37), (38), (39),
        (40), (41)
    ) v(SecondsAgo)
),
BaseRows AS (
    SELECT
        d.DeviceId,
        d.Code,
        m.MetricCode,
        s.SecondsAgo,
        BaseValue = CONVERT(DECIMAL(9,2),
            COALESCE(t.TargetValue,
                CASE m.MetricCode
                    WHEN 'TEMP'  THEN 28
                    WHEN 'HUMID' THEN 82
                    WHEN 'CO2'   THEN 700
                    WHEN 'LIGHT' THEN 3
                    ELSE (m.ValidMin + m.ValidMax) / 2
                END
            )
        ),
        MinAllowed = CASE
            WHEN t.MinValue IS NULL OR t.MinValue < m.ValidMin
                THEN m.ValidMin
            ELSE t.MinValue
        END,
        MaxAllowed = CASE
            WHEN t.MaxValue IS NULL OR t.MaxValue > m.ValidMax
                THEN m.ValidMax
            ELSE t.MaxValue
        END
    FROM dbo.Devices d
    CROSS JOIN dbo.Metrics m
    CROSS JOIN Slots s
    LEFT JOIN dbo.Thresholds t
        ON t.ZoneId = d.ZoneId
       AND t.MetricCode = m.MetricCode
    WHERE d.DeviceType = 'SENSOR'
      AND d.IsActive = 1
),
Numbered AS (
    SELECT
        Code,
        MetricCode,
        SecondsAgo,
        rn = ROW_NUMBER() OVER (
            ORDER BY DeviceId, MetricCode, SecondsAgo
        ),
        Value = CONVERT(DECIMAL(9,2),
            CASE
                WHEN BaseValue < MinAllowed THEN MinAllowed
                WHEN BaseValue > MaxAllowed THEN MaxAllowed
                ELSE BaseValue
            END
        )
    FROM BaseRows
)
SELECT @Json = (
    SELECT
        Code AS [device],
        MetricCode AS [metric],
        Value AS [value],
        CONCAT(
            CONVERT(VARCHAR(19),
                DATEADD(SECOND, -SecondsAgo, @Now), 126),
            'Z'
        ) AS [at]
    FROM Numbered
    WHERE rn <= 1000
    ORDER BY rn
    FOR JSON PATH
);

SELECT @PayloadCount = COUNT(*)
FROM OPENJSON(@Json);

IF @PayloadCount <> 1000
    THROW 51004, N'Payload Q4 khong co dung 1000 phan tu.', 1;

PRINT CONCAT('Q4 payload elements: ', @PayloadCount);

BEGIN TRY
    BEGIN TRANSACTION;

    EXEC dbo.sp_IngestReadings
        @Json = @Json;

    ROLLBACK TRANSACTION;
    PRINT 'Q4 transaction rolled back successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
