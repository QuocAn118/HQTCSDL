
CREATE OR ALTER VIEW dbo.vw_DailyBirdFlow
AS
SELECT
    z.HouseId,

    DayVn = CAST(
        b.WindowStart
        AT TIME ZONE 'UTC'
        AT TIME ZONE 'SE Asia Standard Time'
        AS DATE
    ),

    InTotal = SUM(b.InCount),

    OutTotal = SUM(b.OutCount),

    Net = SUM(b.InCount) - SUM(b.OutCount)

FROM dbo.BirdCounts b

INNER JOIN dbo.Devices d
    ON d.DeviceId = b.CameraId

INNER JOIN dbo.Zones z
    ON z.ZoneId = d.ZoneId

GROUP BY
    z.HouseId,
    CAST(
        b.WindowStart
        AT TIME ZONE 'UTC'
        AT TIME ZONE 'SE Asia Standard Time'
        AS DATE
    );
GO
