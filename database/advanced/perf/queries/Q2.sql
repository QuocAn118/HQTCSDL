SET NOCOUNT ON;

DECLARE @d INT;
DECLARE @to DATETIME2(0);

SELECT @d = DeviceId
FROM dbo.Devices
WHERE Code = 'H1-F1-SENSOR'
  AND DeviceType = 'SENSOR'
  AND IsActive = 1;

SET @to = DATEADD(DAY, -38, CONVERT(DATETIME2(0), '2026-10-12T00:00:00', 126));

IF @d IS NULL
    THROW 51002, N'Khong tim thay sensor H1-F1-SENSOR.', 1;

SELECT RecordedAt, Value
FROM dbo.SensorReadings
WHERE DeviceId = @d
  AND MetricCode = 'TEMP'
  AND RecordedAt >= DATEADD(DAY, -30, @to)
  AND RecordedAt < @to
ORDER BY RecordedAt;
