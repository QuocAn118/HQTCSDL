:setvar AnchorDateVn "2026-10-12"
:setvar Days "180"
:setvar StepSeconds "75"
:on error exit

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '=== TASK 9: GENERATE SENSOR READINGS ===';

-- Chi cho phep chay tren database co hau to _Perf.
IF RIGHT(DB_NAME(), 5) <> N'_Perf'
    THROW 51001, 'Chi duoc phep chay tren database co hau to _Perf.', 1;

-- Kiem tra tham so.
DECLARE @AnchorDate DATE = CONVERT(DATE, '$(AnchorDateVn)', 23);
DECLARE @Days INT = $(Days);
DECLARE @StepSeconds INT = $(StepSeconds);

IF @Days <= 0
    THROW 51002, 'Days phai lon hon 0.', 1;

IF @StepSeconds <= 0 OR 86400 % @StepSeconds <> 0
    THROW 51003, 'StepSeconds phai la so duong va chia het 86400.', 1;

DECLARE @SlotsPerDay INT = 86400 / @StepSeconds;

IF @SlotsPerDay > 1200
    THROW 51004, 'So moc moi ngay vuot qua gioi han bo sinh so.', 1;

-- Khoang sinh du lieu: [End - Days, End).
DECLARE @End DATETIME2(0) =
    DATEADD(DAY, -8, CAST(@AnchorDate AS DATETIME2(0)));

DECLARE @Start DATETIME2(0) =
    DATEADD(DAY, -@Days, @End);

DECLARE @StartedAt DATETIME2(7) = SYSUTCDATETIME();
DECLARE @BatchStartedAt DATETIME2(7);
DECLARE @BatchFinishedAt DATETIME2(7);

DECLARE @BeforeCount BIGINT;
DECLARE @AfterCount BIGINT;
DECLARE @InsertedToday INT;
DECLARE @InsertedTotal BIGINT = 0;
DECLARE @SkippedDays INT = 0;
DECLARE @ProcessedDays INT = 0;
DECLARE @FirstBatchMs BIGINT = NULL;
DECLARE @DayMs BIGINT;
DECLARE @CurrentDay DATETIME2(0) = @Start;

SELECT @BeforeCount = COUNT_BIG(*)
FROM dbo.SensorReadings;

PRINT 'Database: ' + DB_NAME();
PRINT 'Anchor date: ' + CONVERT(VARCHAR(10), @AnchorDate, 23);
PRINT 'Start UTC: ' + CONVERT(VARCHAR(30), @Start, 126);
PRINT 'End UTC (exclusive): ' + CONVERT(VARCHAR(30), @End, 126);
PRINT 'Days: ' + CONVERT(VARCHAR(12), @Days);
PRINT 'Step seconds: ' + CONVERT(VARCHAR(12), @StepSeconds);
PRINT 'Slots per day: ' + CONVERT(VARCHAR(12), @SlotsPerDay);
PRINT 'Existing readings: ' + CONVERT(VARCHAR(30), @BeforeCount);

-- Chuyen recovery model theo yeu cau Task 9.
DECLARE @RecoverySql NVARCHAR(MAX);

SET @RecoverySql =
    N'ALTER DATABASE ' + QUOTENAME(DB_NAME()) + N' SET RECOVERY SIMPLE;';

EXEC sys.sp_executesql @RecoverySql;

-- Lay 6 cam bien va 4 chi so cung nguong seed.
SELECT
    d.DeviceId,
    d.Code,
    m.MetricCode,
    m.ValidMin,
    m.ValidMax,
    CASE
        WHEN t.MinValue IS NULL OR t.MinValue < m.ValidMin
            THEN m.ValidMin
        ELSE t.MinValue
    END AS EffectiveMin,
    CASE
        WHEN t.MaxValue IS NULL OR t.MaxValue > m.ValidMax
            THEN m.ValidMax
        ELSE t.MaxValue
    END AS EffectiveMax
INTO #Series
FROM dbo.Devices d
CROSS JOIN dbo.Metrics m
INNER JOIN dbo.Thresholds t
    ON t.ZoneId = d.ZoneId
   AND t.MetricCode = m.MetricCode
WHERE d.DeviceType = 'SENSOR'
  AND d.IsActive = 1;

IF (SELECT COUNT(*) FROM #Series) <> 24
    THROW 51005, 'Can dung 24 chuoi: 6 cam bien x 4 chi so va day du threshold.', 1;

IF EXISTS (
    SELECT 1
    FROM #Series
    WHERE EffectiveMin > EffectiveMax
)
    THROW 51006, 'Nguong Min/Max khong hop le.', 1;

-- Tao bo so 0..1199 bang CROSS JOIN VALUES.
SELECT
    a.N * 100 + b.N * 10 + c.N AS N
INTO #Numbers
FROM (VALUES
    (0),(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11)
) a(N)
CROSS JOIN (VALUES
    (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)
) b(N)
CROSS JOIN (VALUES
    (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)
) c(N)
WHERE a.N * 100 + b.N * 10 + c.N < @SlotsPerDay;

CREATE UNIQUE CLUSTERED INDEX IX_Numbers_N ON #Numbers(N);

PRINT 'Series count: 24';
DECLARE @NumberCount INT;
SELECT @NumberCount = COUNT(*) FROM #Numbers;
PRINT 'Number count: ' + CONVERT(VARCHAR(12), @NumberCount);

-- Moi vong lap xu ly mot ngay, commit rieng.
WHILE @CurrentDay < @End
BEGIN
    SET @ProcessedDays += 1;

    -- Neu ngay da co bat ky reading nao thi bo qua ca ngay.
    IF EXISTS (
        SELECT 1
        FROM dbo.SensorReadings
        WHERE RecordedAt >= @CurrentDay
          AND RecordedAt < DATEADD(DAY, 1, @CurrentDay)
    )
    BEGIN
        SET @SkippedDays += 1;
        SET @CurrentDay = DATEADD(DAY, 1, @CurrentDay);
        CONTINUE;
    END;

    SET @BatchStartedAt = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO dbo.SensorReadings
            (DeviceId, MetricCode, Value, RecordedAt)
        SELECT
            s.DeviceId,
            s.MetricCode,
            CAST(
                CASE
                    WHEN rounded.RawValue < s.EffectiveMin
                        THEN s.EffectiveMin
                    WHEN rounded.RawValue > s.EffectiveMax
                        THEN s.EffectiveMax
                    ELSE rounded.RawValue
                END
                AS DECIMAL(9,2)
            ) AS Value,
            DATEADD(SECOND, n.N * @StepSeconds, @CurrentDay) AS RecordedAt
        FROM #Series s
        CROSS JOIN #Numbers n
        CROSS APPLY (
            SELECT
                CAST(n.N * @StepSeconds AS FLOAT) AS SecondsOfDay
        ) sec
        CROSS APPLY (
            SELECT
                CASE s.MetricCode
                    WHEN 'TEMP' THEN
                        28.0
                        + 1.5 * SIN(2.0 * PI() * sec.SecondsOfDay / 86400.0)
                        + (n.N % 7) * 0.1 - 0.3

                    WHEN 'HUMID' THEN
                        82.0
                        + 3.0 * SIN(2.0 * PI() * sec.SecondsOfDay / 86400.0)
                        + (n.N % 5) * 0.2 - 0.4

                    WHEN 'CO2' THEN
                        700.0
                        + 80.0 * SIN(2.0 * PI() * sec.SecondsOfDay / 86400.0)
                        + (n.N % 7) * 3.0 - 9.0

                    WHEN 'LIGHT' THEN
                        3.0
                        + 1.5 * SIN(2.0 * PI() * sec.SecondsOfDay / 86400.0)
                        + (n.N % 5) * 0.1 - 0.2
                END AS RawValue
        ) raw
        CROSS APPLY (
            SELECT ROUND(raw.RawValue, 2) AS RawValue
        ) rounded;

        SET @InsertedToday = @@ROWCOUNT;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;

    SET @BatchFinishedAt = SYSUTCDATETIME();

    SET @DayMs = DATEDIFF_BIG(
        MILLISECOND,
        @BatchStartedAt,
        @BatchFinishedAt
    );

    IF @FirstBatchMs IS NULL
        SET @FirstBatchMs = @DayMs;

    SET @InsertedTotal += @InsertedToday;

    IF @ProcessedDays = 1 OR @ProcessedDays % 10 = 0
    BEGIN
        PRINT
            'Progress day '
            + CONVERT(VARCHAR(12), @ProcessedDays)
            + '/'
            + CONVERT(VARCHAR(12), @Days)
            + '; inserted='
            + CONVERT(VARCHAR(20), @InsertedToday)
            + '; batch_ms='
            + CONVERT(VARCHAR(20), @DayMs);
    END;

    SET @CurrentDay = DATEADD(DAY, 1, @CurrentDay);
END;

DECLARE @FinishedAt DATETIME2(7) = SYSUTCDATETIME();

SELECT @AfterCount = COUNT_BIG(*)
FROM dbo.SensorReadings;

PRINT '=== GENERATION SUMMARY ===';
PRINT 'New rows: ' + CONVERT(VARCHAR(30), @InsertedTotal);
PRINT 'Skipped days: ' + CONVERT(VARCHAR(12), @SkippedDays);
PRINT 'Processed days: ' + CONVERT(VARCHAR(12), @ProcessedDays);
PRINT 'First inserted batch ms: '
    + COALESCE(CONVERT(VARCHAR(30), @FirstBatchMs), 'N/A');
PRINT 'Total elapsed ms: '
    + CONVERT(VARCHAR(30), DATEDIFF_BIG(MILLISECOND, @StartedAt, @FinishedAt));
PRINT 'Rows before: ' + CONVERT(VARCHAR(30), @BeforeCount);
PRINT 'Rows after: ' + CONVERT(VARCHAR(30), @AfterCount);
PRINT 'Expected new rows if no days skipped: '
    + CONVERT(VARCHAR(30), CAST(@Days AS BIGINT) * @SlotsPerDay * 24);

SELECT
    @InsertedTotal AS NewRows,
    @SkippedDays AS SkippedDays,
    @ProcessedDays AS ProcessedDays,
    @FirstBatchMs AS FirstBatchMilliseconds,
    DATEDIFF_BIG(MILLISECOND, @StartedAt, @FinishedAt) AS TotalMilliseconds,
    @BeforeCount AS RowsBefore,
    @AfterCount AS RowsAfter;

DROP TABLE #Numbers;
DROP TABLE #Series;
