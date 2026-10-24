
CREATE OR ALTER VIEW dbo.vw_LatestReadings
AS
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
FROM dbo.Devices d
INNER JOIN dbo.Zones z
    ON d.ZoneId = z.ZoneId
INNER JOIN dbo.Houses h
    ON z.HouseId = h.HouseId
CROSS JOIN dbo.Metrics m
CROSS APPLY (
    SELECT TOP (1)
        s.Value,
        s.RecordedAt
    FROM dbo.SensorReadings s
    WHERE s.DeviceId = d.DeviceId
      AND s.MetricCode = m.MetricCode
    ORDER BY
        s.RecordedAt DESC,
        s.ReadingId DESC
) l
WHERE d.DeviceType = 'SENSOR'
  AND d.IsActive = 1;
GO
