
-- Hinh dang chung cua canh bao trong moi cot JSON tra cho backend.
CREATE OR ALTER VIEW dbo.vw_AlertJson
AS
SELECT
    a.AlertId,
    a.HouseId,
    a.ZoneId,
    a.DeviceId,
    a.AlertType,
    a.Severity,
    a.MetricCode,
    a.Value,
    a.DetectedClass,
    a.Confidence,
    HasSnapshot = CAST(
        CASE
            WHEN a.SnapshotPath IS NOT NULL THEN 1
            ELSE 0
        END AS BIT
    ),
    a.Message,
    a.Status,
    CreatedAt = CONCAT(
        CONVERT(CHAR(19), a.CreatedAt, 126),
        'Z'
    )
FROM dbo.Alerts a;
GO
