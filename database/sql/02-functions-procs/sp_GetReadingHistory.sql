
CREATE OR ALTER PROCEDURE dbo.sp_GetReadingHistory
    @ZoneId        INT,
    @MetricCode    VARCHAR(10),
    @FromUtc       DATETIME2(0),
    @ToUtc         DATETIME2(0),
    @BucketMinutes INT = 60
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @BucketMinutes IS NULL OR @BucketMinutes <= 0
        THROW 50040, N'@BucketMinutes phai lon hon 0.', 1;

    IF @FromUtc IS NULL OR @ToUtc IS NULL
       OR @FromUtc >= @ToUtc
        THROW 50041, N'Khoang thoi gian khong hop le (From >= To).', 1;

    IF (
        DATEDIFF(MINUTE, @FromUtc, @ToUtc)
        + @BucketMinutes - 1
    ) / @BucketMinutes > 2000
        THROW 50042, N'Qua 2000 bucket, tang @BucketMinutes hoac thu hep khoang.', 1;

    SELECT
        BucketUtc = DATEADD(
            MINUTE,
            (
                DATEDIFF(MINUTE, @FromUtc, s.RecordedAt)
                / @BucketMinutes
            ) * @BucketMinutes,
            @FromUtc
        ),
        AvgValue = CAST(AVG(s.Value) AS DECIMAL(9, 2)),
        MinValue = MIN(s.Value),
        MaxValue = MAX(s.Value)
    FROM dbo.SensorReadings s
    JOIN dbo.Devices d
        ON d.DeviceId = s.DeviceId
    WHERE d.ZoneId = @ZoneId
      AND s.MetricCode = @MetricCode
      AND s.RecordedAt >= @FromUtc
      AND s.RecordedAt < @ToUtc
    GROUP BY DATEADD(
        MINUTE,
        (
            DATEDIFF(MINUTE, @FromUtc, s.RecordedAt)
            / @BucketMinutes
        ) * @BucketMinutes,
        @FromUtc
    )
    ORDER BY BucketUtc;
END
GO
