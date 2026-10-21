
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF EXISTS (SELECT 1 FROM dbo.SensorReadings)
BEGIN
    PRINT N'seed 02: da co so do, bo qua';
    RETURN;
END

DECLARE @AnchorVn DATE = '$(AnchorDateVn)';

-- 00:00 VN ngay neo - 7, chuyen sang UTC
DECLARE @StartUtc DATETIME2(0) =
    DATEADD(
        HOUR, -7,
        CAST(DATEADD(DAY, -7, @AnchorVn) AS DATETIME2(0))
    );

DECLARE @Pi FLOAT = PI();

BEGIN TRAN;

-- 2256 moc thoi gian, moi moc cach nhau 5 phut
WITH n AS (
    SELECT TOP (2256)
        i = ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1
    FROM sys.all_objects a
    CROSS JOIN sys.all_objects b
),
s AS (
    SELECT
        d.DeviceId,
        d.Code,
        z.FloorNo
    FROM dbo.Devices d
    JOIN dbo.Zones z ON z.ZoneId = d.ZoneId
    WHERE d.DeviceType = 'SENSOR'
),
p AS (
    SELECT
        s.DeviceId,
        s.Code,
        s.FloorNo,
        n.i,
        HourVn = (n.i % 288) * 5 / 60.0,
        DayIdx = n.i / 288,
        RecordedAt = DATEADD(MINUTE, 5 * n.i, @StartUtc)
    FROM n
    CROSS JOIN s
)
INSERT dbo.SensorReadings (
    DeviceId,
    MetricCode,
    Value,
    RecordedAt
)
SELECT
    p.DeviceId,
    m.MetricCode,
    CAST(
        ROUND(
            CASE m.MetricCode
                WHEN 'TEMP' THEN
                    CASE
                        WHEN p.Code = 'H1-F2-SENSOR'
                             AND p.DayIdx = 5
                             AND p.HourVn >= 13
                             AND p.HourVn < 15
                        THEN 31.5
                        ELSE 28
                             + 1.5 * SIN(
                                 2 * @Pi * (p.HourVn - 9) / 24
                               )
                             + 0.1 * p.FloorNo
                    END

                WHEN 'HUMID' THEN
                    CASE
                        WHEN p.Code = 'H1-F3-SENSOR'
                             AND p.DayIdx = 7
                        THEN 82 - 10.0 * (p.i % 288) * 5 / 1195
                        ELSE 82 + 4 * SIN(
                            2 * @Pi * p.HourVn / 24
                        )
                    END

                WHEN 'CO2' THEN
                    600 + 150 * SIN(
                        2 * @Pi * p.HourVn / 24
                    )

                ELSE
                    CASE
                        WHEN p.HourVn >= 6
                             AND p.HourVn < 18
                        THEN 5
                        ELSE 1
                    END
            END,
            2
        ) AS DECIMAL(9, 2)
    ),
    p.RecordedAt
FROM p
CROSS JOIN dbo.Metrics m;

-- Cap nhat thoi diem ghi nhan cuoi cua cam bien
UPDATE d
SET
    LastSeenAt = x.LastAt,
    Status = 'ONLINE'
FROM dbo.Devices d
JOIN (
    SELECT
        DeviceId,
        LastAt = MAX(RecordedAt)
    FROM dbo.SensorReadings
    GROUP BY DeviceId
) x ON x.DeviceId = d.DeviceId;

COMMIT;

PRINT N'seed 02: xong';
