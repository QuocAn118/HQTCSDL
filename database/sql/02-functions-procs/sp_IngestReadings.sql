
CREATE OR ALTER PROCEDURE dbo.sp_IngestReadings
    @Json NVARCHAR(MAX),
    @StaleMinutes INT = 2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Json IS NULL OR ISJSON(@Json) = 0
       OR LEFT(LTRIM(REPLACE(REPLACE(REPLACE(
           @Json, NCHAR(13), N''), NCHAR(10), N''), NCHAR(9), N'')), 1) <> N'['
        THROW 50030, N'Chuoi JSON khong hop le (can mot mang).', 1;

    IF @StaleMinutes IS NULL OR @StaleMinutes <= 0
        THROW 50042, N'@StaleMinutes phai lon hon 0.', 1;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @StaleBefore DATETIME2(0) =
        DATEADD(MINUTE, -@StaleMinutes, @Now);

    CREATE TABLE #In (
        Ord INT NOT NULL,
        DeviceCode NVARCHAR(200) NULL,
        MetricCode NVARCHAR(50) NULL,
        ValueText NVARCHAR(100) NULL,
        AtText NVARCHAR(100) NULL,
        Value DECIMAL(9, 2) NULL,
        RecordedAt DATETIME2(0) NULL,
        DeviceId INT NULL,
        ZoneId INT NULL,
        HouseId INT NULL,
        Status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
    );

    INSERT #In (Ord, DeviceCode, MetricCode, ValueText, AtText)
    SELECT CAST(j.[key] AS INT), x.device, x.metric, x.value, x.at
    FROM OPENJSON(@Json) j
    OUTER APPLY (
        SELECT *
        FROM OPENJSON(
            CASE WHEN j.[type] = 5 THEN j.[value] END
        )
        WITH (
            device NVARCHAR(200) '$.device',
            metric NVARCHAR(50) '$.metric',
            value NVARCHAR(100) '$.value',
            at NVARCHAR(100) '$.at'
        )
    ) x;

    UPDATE #In
    SET Value = TRY_CONVERT(DECIMAL(9, 2), ValueText),
        RecordedAt = CASE
            WHEN AtText LIKE N'%Z' THEN
                CAST(
                    DATEADD(
                        MILLISECOND,
                        -DATEPART(
                            MILLISECOND,
                            TRY_CONVERT(DATETIME2(3), AtText, 127)
                        ),
                        TRY_CONVERT(DATETIME2(3), AtText, 127)
                    ) AS DATETIME2(0)
                )
        END;

    UPDATE i
    SET DeviceId = d.DeviceId,
        ZoneId = d.ZoneId,
        HouseId = z.HouseId
    FROM #In i
    JOIN dbo.Devices d
        ON d.Code = i.DeviceCode
       AND d.DeviceType = 'SENSOR'
       AND d.IsActive = 1
    JOIN dbo.Zones z ON z.ZoneId = d.ZoneId;

    UPDATE i
    SET Status = 'REJECTED'
    FROM #In i
    LEFT JOIN dbo.Metrics m ON m.MetricCode = i.MetricCode
    WHERE i.DeviceId IS NULL
       OR m.MetricCode IS NULL
       OR i.Value IS NULL
       OR i.RecordedAt IS NULL
       OR i.Value < m.ValidMin
       OR i.Value > m.ValidMax
       OR i.RecordedAt > DATEADD(MINUTE, 5, @Now);

    WITH d AS (
        SELECT Status,
               rn = ROW_NUMBER() OVER (
                   PARTITION BY DeviceId, MetricCode, RecordedAt
                   ORDER BY Ord
               )
        FROM #In
        WHERE Status = 'PENDING'
    )
    UPDATE d SET Status = 'DUPLICATE' WHERE rn > 1;

    CREATE TABLE #Eval (
        ZoneId INT NOT NULL,
        HouseId INT NOT NULL,
        MetricCode VARCHAR(10) NOT NULL,
        Value DECIMAL(9, 2) NOT NULL,
        MinValue DECIMAL(9, 2) NULL,
        MaxValue DECIMAL(9, 2) NULL,
        H DECIMAL(9, 2) NOT NULL,
        OpenAlertId INT NULL,
        Action VARCHAR(10) NULL,
        Severity VARCHAR(10) NULL
    );

    DECLARE @New TABLE (AlertId INT NOT NULL);
    DECLARE @Resolved TABLE (AlertId INT NOT NULL);

    EXEC sys.sp_set_session_context
        @key = N'UserId', @value = NULL;
    EXEC sys.sp_set_session_context
        @key = N'Note', @value = NULL;

    BEGIN TRAN;

    UPDATE i
    SET Status = 'DUPLICATE'
    FROM #In i
    WHERE i.Status = 'PENDING'
      AND EXISTS (
          SELECT 1
          FROM dbo.SensorReadings s WITH (UPDLOCK, HOLDLOCK)
          WHERE s.DeviceId = i.DeviceId
            AND s.MetricCode = i.MetricCode
            AND s.RecordedAt = i.RecordedAt
      );

    INSERT dbo.SensorReadings
        (DeviceId, MetricCode, Value, RecordedAt)
    SELECT DeviceId, MetricCode, Value, RecordedAt
    FROM #In
    WHERE Status = 'PENDING';

    UPDATE #In
    SET Status = 'ACCEPTED'
    WHERE Status = 'PENDING';

    UPDATE d
    SET LastSeenAt = CASE
        WHEN d.LastSeenAt IS NULL OR a.MaxAt > d.LastSeenAt
            THEN a.MaxAt
        ELSE d.LastSeenAt
    END
    FROM dbo.Devices d
    JOIN (
        SELECT DeviceId, MaxAt = MAX(RecordedAt)
        FROM #In
        WHERE Status = 'ACCEPTED'
        GROUP BY DeviceId
    ) a ON a.DeviceId = d.DeviceId;

    UPDATE d
    SET Status = 'ONLINE'
    FROM dbo.Devices d
    WHERE d.Status <> 'ONLINE'
      AND d.DeviceId IN (
          SELECT DeviceId FROM #In WHERE Status = 'ACCEPTED'
      );

    INSERT #Eval
        (ZoneId, HouseId, MetricCode, Value, MinValue, MaxValue, H)
    SELECT x.ZoneId, x.HouseId, x.MetricCode, x.Value,
           t.MinValue, t.MaxValue,
           CASE
               WHEN t.MinValue IS NOT NULL
                AND t.MaxValue IS NOT NULL
                AND (t.MaxValue - t.MinValue) / 4 < m.Hysteresis
               THEN (t.MaxValue - t.MinValue) / 4
               ELSE m.Hysteresis
           END
    FROM (
        SELECT ZoneId, HouseId, MetricCode, Value,
               rn = ROW_NUMBER() OVER (
                   PARTITION BY ZoneId, MetricCode
                   ORDER BY RecordedAt DESC, Ord DESC
               )
        FROM #In
        WHERE Status = 'ACCEPTED'
          AND RecordedAt >= @StaleBefore
    ) x
    JOIN dbo.Thresholds t
        ON t.ZoneId = x.ZoneId
       AND t.MetricCode = x.MetricCode
    JOIN dbo.Metrics m
        ON m.MetricCode = x.MetricCode
    WHERE x.rn = 1;

    DECLARE @z INT, @mc VARCHAR(10), @id INT;

    DECLARE c CURSOR LOCAL FAST_FORWARD FOR
        SELECT ZoneId, MetricCode
        FROM #Eval
        ORDER BY ZoneId, MetricCode;

    OPEN c;
    FETCH NEXT FROM c INTO @z, @mc;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @id = NULL;

        SELECT @id = AlertId
        FROM dbo.Alerts WITH (UPDLOCK, HOLDLOCK)
        WHERE ZoneId = @z
          AND MetricCode = @mc
          AND AlertType = 'THRESHOLD'
          AND Status <> 'RESOLVED';

        UPDATE #Eval
        SET OpenAlertId = @id
        WHERE ZoneId = @z AND MetricCode = @mc;

        FETCH NEXT FROM c INTO @z, @mc;
    END

    CLOSE c;
    DEALLOCATE c;

    UPDATE #Eval
    SET Action = CASE
        WHEN OpenAlertId IS NULL
         AND (
             (MinValue IS NOT NULL AND Value < MinValue)
             OR (MaxValue IS NOT NULL AND Value > MaxValue)
         )
        THEN 'OPEN'
        WHEN OpenAlertId IS NOT NULL
         AND (MinValue IS NULL OR Value >= MinValue + H)
         AND (MaxValue IS NULL OR Value <= MaxValue - H)
        THEN 'CLOSE'
    END,
    Severity = CASE
        WHEN (
            MaxValue IS NOT NULL
            AND Value > MaxValue
            AND Value - MaxValue > ABS(MaxValue) * 0.1
        )
        OR (
            MinValue IS NOT NULL
            AND Value < MinValue
            AND MinValue - Value > ABS(MinValue) * 0.1
        )
        THEN 'CRITICAL'
        ELSE 'WARNING'
    END;

    INSERT dbo.Alerts
        (HouseId, ZoneId, AlertType, Severity,
         MetricCode, Value, Message)
    OUTPUT inserted.AlertId INTO @New (AlertId)
    SELECT e.HouseId, e.ZoneId, 'THRESHOLD',
           e.Severity, e.MetricCode, e.Value,
           CONCAT(
               m.Name,
               CASE
                   WHEN e.MaxValue IS NOT NULL
                    AND e.Value > e.MaxValue
                   THEN N' vượt ngưỡng trên '
                   ELSE N' dưới ngưỡng dưới '
               END,
               CASE
                   WHEN e.MaxValue IS NOT NULL
                    AND e.Value > e.MaxValue
                   THEN e.MaxValue
                   ELSE e.MinValue
               END,
               N' ', m.Unit, N': ', e.Value, N' ', m.Unit
           )
    FROM #Eval e
    JOIN dbo.Metrics m ON m.MetricCode = e.MetricCode
    WHERE e.Action = 'OPEN';

    UPDATE a
    SET Status = 'RESOLVED',
        ResolvedAt = @Now,
        ResolvedBy = NULL
    OUTPUT inserted.AlertId INTO @Resolved (AlertId)
    FROM dbo.Alerts a
    JOIN #Eval e ON e.OpenAlertId = a.AlertId
    WHERE e.Action = 'CLOSE';

    COMMIT;

    SELECT
        Received = (
            SELECT COUNT(*) FROM #In
        ),
        Accepted = (
            SELECT COUNT(*) FROM #In WHERE Status = 'ACCEPTED'
        ),
        Duplicates = (
            SELECT COUNT(*) FROM #In WHERE Status = 'DUPLICATE'
        ),
        Rejected = (
            SELECT COUNT(*) FROM #In WHERE Status = 'REJECTED'
        ),
        AcceptedJson = ISNULL((
            SELECT i.DeviceId,
                   DeviceCode = CAST(i.DeviceCode AS VARCHAR(50)),
                   i.HouseId, i.ZoneId,
                   MetricCode = CAST(i.MetricCode AS VARCHAR(10)),
                   i.Value,
                   RecordedAt = CONCAT(
                       CONVERT(CHAR(19), i.RecordedAt, 126), 'Z'
                   )
            FROM #In i
            WHERE i.Status = 'ACCEPTED'
            ORDER BY i.Ord
            FOR JSON PATH, INCLUDE_NULL_VALUES
        ), N'[]'),
        NewAlertsJson = ISNULL((
            SELECT v.*
            FROM dbo.vw_AlertJson v
            JOIN @New n ON n.AlertId = v.AlertId
            ORDER BY v.AlertId
            FOR JSON PATH, INCLUDE_NULL_VALUES
        ), N'[]'),
        ResolvedAlertIdsJson = ISNULL((
            SELECT AlertId
            FROM @Resolved
            ORDER BY AlertId
            FOR JSON PATH
        ), N'[]');
END
GO
