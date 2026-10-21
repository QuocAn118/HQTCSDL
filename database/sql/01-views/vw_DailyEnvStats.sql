
CREATE OR ALTER VIEW dbo.vw_DailyEnvStats
AS
SELECT
    z.HouseId,
    z.ZoneId,
    s.MetricCode,

    DayVn = CAST(
        s.RecordedAt
        AT TIME ZONE 'UTC'
        AT TIME ZONE 'SE Asia Standard Time'
        AS DATE
    ),

    AvgValue = CAST(
        AVG(s.Value) AS DECIMAL(9, 2)
    ),

    MinValue = MIN(s.Value),

    MaxValue = MAX(s.Value),

    Samples = COUNT(*)

FROM dbo.SensorReadings s

INNER JOIN dbo.Devices d
    ON d.DeviceId = s.DeviceId

INNER JOIN dbo.Zones z
    ON z.ZoneId = d.ZoneId

GROUP BY
    z.HouseId,
    z.ZoneId,
    s.MetricCode,
    CAST(
        s.RecordedAt
        AT TIME ZONE 'UTC'
        AT TIME ZONE 'SE Asia Standard Time'
        AS DATE
    );
GO
