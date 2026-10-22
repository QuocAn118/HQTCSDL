
CREATE OR ALTER VIEW dbo.vw_OpenAlerts
AS
SELECT
    a.AlertId,
    a.HouseId,
    h.Name AS HouseName,
    a.ZoneId,
    z.Name AS ZoneName,
    a.DeviceId,
    d.Code AS DeviceCode,
    a.AlertType,
    a.Severity,
    a.MetricCode,
    a.Value,
    a.DetectedClass,
    a.Confidence,
    CAST(
        CASE
            WHEN a.SnapshotPath IS NOT NULL
                 AND LEN(LTRIM(RTRIM(a.SnapshotPath))) > 0
            THEN 1
            ELSE 0
        END AS BIT
    ) AS HasSnapshot,
    a.Message,
    a.Status,
    a.CreatedAt
FROM dbo.Alerts a
INNER JOIN dbo.Houses h
    ON a.HouseId = h.HouseId
LEFT JOIN dbo.Zones z
    ON a.ZoneId = z.ZoneId
LEFT JOIN dbo.Devices d
    ON a.DeviceId = d.DeviceId
WHERE a.Status <> 'RESOLVED';
GO
