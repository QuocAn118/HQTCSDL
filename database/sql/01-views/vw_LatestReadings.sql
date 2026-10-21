
CREATE OR ALTER VIEW dbo.vw_LatestReadings
AS
WITH Latest AS (
    SELECT
        s.DeviceId,
        s.MetricCode,
        s.Value,
        s.RecordedAt,
        ROW_NUMBER() OVER (
            PARTITION BY s.DeviceId, s.MetricCode
            ORDER BY s.RecordedAt DESC, s.ReadingId DESC
        ) AS rn
    FROM dbo.SensorReadings s
)
SELECT
    h.HouseId,
    h.Name AS HouseName,
    z.ZoneId,
    z.Name AS ZoneName,
    z.FloorNo,
    d.DeviceId,
    d.Code AS DeviceCode,
    d.Status AS DeviceStatus,
    d.LastSeenAt,
    m.MetricCode,
    m.Name AS MetricName,
    m.Unit,
    l.Value,
    l.RecordedAt
FROM Latest l
INNER JOIN dbo.Devices d
    ON l.DeviceId = d.DeviceId
INNER JOIN dbo.Zones z
    ON d.ZoneId = z.ZoneId
INNER JOIN dbo.Houses h
    ON z.HouseId = h.HouseId
INNER JOIN dbo.Metrics m
    ON l.MetricCode = m.MetricCode
WHERE l.rn = 1
  AND d.DeviceType = 'SENSOR'
  AND d.IsActive = 1;
GO
