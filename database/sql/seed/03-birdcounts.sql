
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF EXISTS (SELECT 1 FROM dbo.BirdCounts)
BEGIN
    PRINT N'seed 03: da co dem chim, bo qua';
    RETURN;
END

DECLARE @AnchorVn DATE = '$(AnchorDateVn)';

BEGIN TRAN;

-- Du lieu trong 8 ngay: ngay neo - 7 den ngay neo
-- Chim bay ra: 05:00 - 06:55 gio VN
-- Chim bay ve: 17:00 - 19:25 gio VN

WITH days AS (
    SELECT d = v.d
    FROM (VALUES (0),(1),(2),(3),(4),(5),(6),(7)) v(d)
),
w AS (
    SELECT
        k = ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1
    FROM (VALUES (0),(1),(2),(3),(4),(5)) a(x)
    CROSS JOIN (VALUES (0),(1),(2),(3),(4)) b(y)
),
slots AS (
    SELECT
        Kind = 'OUT',
        k,
        MinuteVn = 5 * 60 + 5 * k
    FROM w
    WHERE k < 24

    UNION ALL

    SELECT
        Kind = 'IN',
        k,
        MinuteVn = 17 * 60 + 5 * k
    FROM w
    WHERE k < 30
),
cams AS (
    SELECT
        d.DeviceId,
        h.Name AS HouseName
    FROM dbo.Devices d
    JOIN dbo.Zones z ON z.ZoneId = d.ZoneId
    JOIN dbo.Houses h ON h.HouseId = z.HouseId
    WHERE d.DeviceType = 'CAMERA'
)
INSERT dbo.BirdCounts (
    CameraId,
    WindowStart,
    InCount,
    OutCount
)
SELECT
    c.DeviceId,

    -- Chuyen gio Viet Nam sang UTC
    DATEADD(
        HOUR,
        -7,
        DATEADD(
            MINUTE,
            s.MinuteVn,
            CAST(
                DATEADD(DAY, dd.d - 7, @AnchorVn)
                AS DATETIME2(0)
            )
        )
    ),

    -- So chim bay ve
    CASE
        WHEN s.Kind = 'IN' THEN
            CASE
                -- H2 ngay cuoi giam khoang 40%
                WHEN c.HouseName = N'H2'
                     AND dd.d = 7
                THEN (15 + s.k % 3) * 6 / 10

                WHEN c.HouseName = N'H2'
                THEN 15 + s.k % 3

                ELSE 20 + s.k % 3
            END
        ELSE 0
    END,

    -- So chim bay ra
    CASE
        WHEN s.Kind = 'OUT' THEN
            (
                CASE
                    WHEN c.HouseName = N'H2'
                    THEN 18
                    ELSE 24
                END
            ) + s.k % 2
        ELSE 0
    END

FROM cams c
CROSS JOIN days dd
CROSS JOIN slots s;

COMMIT;

PRINT N'seed 03: xong';
