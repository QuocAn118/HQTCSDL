
CREATE OR ALTER PROCEDURE dbo.sp_Report_EnvStabilityVsYield
    @HouseId    INT,
    @FromVnDate DATE,
    @ToVnDate   DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @FromVnDate IS NULL
       OR @ToVnDate IS NULL
       OR @FromVnDate >= @ToVnDate
        THROW 50041, N'Khoang ngay khong hop le (From >= To).', 1;

    -- Chuyen ngay gio Viet Nam (UTC+7) sang UTC
    DECLARE @FromUtc DATETIME2(0) =
        DATEADD(HOUR, -7, CAST(@FromVnDate AS DATETIME2(0)));

    DECLARE @ToUtc DATETIME2(0) =
        DATEADD(HOUR, -7, CAST(@ToVnDate AS DATETIME2(0)));

    ;WITH env AS (
        SELECT
            d.ZoneId,
            MonthVn = CONVERT(
                CHAR(7),
                DATEADD(HOUR, 7, s.RecordedAt),
                126
            ),
            AvgTemp = AVG(
                CASE WHEN s.MetricCode = 'TEMP'
                     THEN CAST(s.Value AS FLOAT) END
            ),
            StdevTemp = STDEV(
                CASE WHEN s.MetricCode = 'TEMP'
                     THEN CAST(s.Value AS FLOAT) END
            ),
            AvgHumid = AVG(
                CASE WHEN s.MetricCode = 'HUMID'
                     THEN CAST(s.Value AS FLOAT) END
            ),
            StdevHumid = STDEV(
                CASE WHEN s.MetricCode = 'HUMID'
                     THEN CAST(s.Value AS FLOAT) END
            ),
            InRange = SUM(
                CASE
                    WHEN s.MetricCode IN ('TEMP', 'HUMID')
                     AND (t.MinValue IS NULL OR s.Value >= t.MinValue)
                     AND (t.MaxValue IS NULL OR s.Value <= t.MaxValue)
                    THEN 1 ELSE 0
                END
            ),
            Total = SUM(
                CASE
                    WHEN s.MetricCode IN ('TEMP', 'HUMID')
                    THEN 1 ELSE 0
                END
            )
        FROM dbo.SensorReadings s
        JOIN dbo.Devices d
            ON d.DeviceId = s.DeviceId
        JOIN dbo.Zones z
            ON z.ZoneId = d.ZoneId
           AND z.HouseId = @HouseId
        LEFT JOIN dbo.Thresholds t
            ON t.ZoneId = d.ZoneId
           AND t.MetricCode = s.MetricCode
        WHERE s.RecordedAt >= @FromUtc
          AND s.RecordedAt < @ToUtc
        GROUP BY
            d.ZoneId,
            CONVERT(
                CHAR(7),
                DATEADD(HOUR, 7, s.RecordedAt),
                126
            )
    ),
    yld AS (
        SELECT
            hv.ZoneId,
            MonthVn = CONVERT(CHAR(7), hv.HarvestDate, 126),
            NestCount = SUM(hv.NestCount),
            WeightGram = SUM(hv.WeightGram)
        FROM dbo.Harvests hv
        JOIN dbo.Zones z
            ON z.ZoneId = hv.ZoneId
           AND z.HouseId = @HouseId
        WHERE hv.HarvestDate >= @FromVnDate
          AND hv.HarvestDate < @ToVnDate
        GROUP BY
            hv.ZoneId,
            CONVERT(CHAR(7), hv.HarvestDate, 126)
    )
    SELECT
        z.ZoneId,
        ZoneName = z.Name,
        k.MonthVn,
        AvgTemp = CAST(e.AvgTemp AS DECIMAL(9, 2)),
        StdevTemp = CAST(e.StdevTemp AS DECIMAL(9, 2)),
        AvgHumid = CAST(e.AvgHumid AS DECIMAL(9, 2)),
        StdevHumid = CAST(e.StdevHumid AS DECIMAL(9, 2)),
        PctInRange = CAST(
            CASE
                WHEN e.Total > 0
                THEN 100.0 * e.InRange / e.Total
            END AS DECIMAL(5, 2)
        ),
        y.NestCount,
        y.WeightGram
    FROM (
        SELECT ZoneId, MonthVn FROM env
        UNION
        SELECT ZoneId, MonthVn FROM yld
    ) k
    JOIN dbo.Zones z
        ON z.ZoneId = k.ZoneId
    LEFT JOIN env e
        ON e.ZoneId = k.ZoneId
       AND e.MonthVn = k.MonthVn
    LEFT JOIN yld y
        ON y.ZoneId = k.ZoneId
       AND y.MonthVn = k.MonthVn
    ORDER BY z.FloorNo, k.MonthVn;
END
GO
