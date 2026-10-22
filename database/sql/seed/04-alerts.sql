
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF EXISTS (SELECT 1 FROM dbo.Alerts)
BEGIN
    PRINT N'seed 04: da co canh bao, bo qua';
    RETURN;
END

DECLARE @AnchorVn DATE = '$(AnchorDateVn)';

-- 00:00 gio Viet Nam cua ngay neo, doi sang UTC
DECLARE @AnchorStartUtc DATETIME2(0) =
    DATEADD(HOUR, -7, CAST(@AnchorVn AS DATETIME2(0)));

DECLARE @h1 INT = (
    SELECT HouseId
    FROM dbo.Houses
    WHERE Name = N'H1'
);

DECLARE @f2 INT = (
    SELECT ZoneId
    FROM dbo.Zones
    WHERE HouseId = @h1 AND Name = N'F2'
);

DECLARE @f3 INT = (
    SELECT ZoneId
    FROM dbo.Zones
    WHERE HouseId = @h1 AND Name = N'F3'
);

DECLARE @owner1 INT = (
    SELECT UserId
    FROM dbo.Users
    WHERE Username = 'owner1'
);

DECLARE @id INT;

-- Nguoi thao tac mac dinh la he thong
EXEC sys.sp_set_session_context
    @key = N'UserId', @value = NULL;

EXEC sys.sp_set_session_context
    @key = N'Note', @value = NULL;

-- 1. H1-F2: nhiet do vuot nguong, da xu ly
INSERT dbo.Alerts (
    HouseId,
    ZoneId,
    AlertType,
    Severity,
    MetricCode,
    Value,
    Message,
    CreatedAt
)
VALUES (
    @h1,
    @f2,
    'THRESHOLD',
    'WARNING',
    'TEMP',
    31.5,
    N'Nhiệt độ vượt ngưỡng trên 30.00 °C: 31.50 °C',
    DATEADD(HOUR, 13, DATEADD(DAY, -2, @AnchorStartUtc))
);

SET @id = SCOPE_IDENTITY();

UPDATE dbo.Alerts
SET
    Status = 'RESOLVED',
    ResolvedAt = DATEADD(
        HOUR, 15, DATEADD(DAY, -2, @AnchorStartUtc)
    )
WHERE AlertId = @id;

-- 2. H1-F3: do am thap, canh bao van dang mo
INSERT dbo.Alerts (
    HouseId,
    ZoneId,
    AlertType,
    Severity,
    MetricCode,
    Value,
    Message,
    CreatedAt
)
VALUES (
    @h1,
    @f3,
    'THRESHOLD',
    'WARNING',
    'HUMID',
    74.97,
    N'Độ ẩm dưới ngưỡng dưới 75.00 %: 74.97 %',
    DATEADD(HOUR, 14, @AnchorStartUtc)
);

-- 3. Camera H1-F0 phat hien ran luc 18:30 VN
DECLARE @pj NVARCHAR(MAX) = CONCAT(
    N'{"camera":"H1-F0-CAMERA",',
    N'"class":"snake",',
    N'"confidence":0.91,',
    N'"snapshot":"snapshots/seed/H1-F0-CAMERA_snake_seed.jpg",',
    N'"at":"',
    CONVERT(
        CHAR(19),
        DATEADD(MINUTE, 18 * 60 + 30, @AnchorStartUtc),
        126
    ),
    N'Z"}'
);

DECLARE @pr TABLE (
    Created BIT,
    AlertId INT,
    SkipReason VARCHAR(20),
    AlertJson NVARCHAR(MAX)
);

INSERT @pr
EXEC dbo.sp_CreatePredatorAlert @pj;

SELECT @id = AlertId
FROM @pr;

-- Chu nha xac nhan da kiem tra camera
DECLARE @ack TABLE (
    AlertId INT,
    HouseId INT,
    ZoneId INT,
    AlertType VARCHAR(20),
    Status VARCHAR(10),
    ResolvedAt DATETIME2(0),
    ResolvedBy INT
);

INSERT @ack
EXEC dbo.sp_UpdateAlertStatus
    @AlertId = @id,
    @Status = 'ACK',
    @UserId = @owner1,
    @Note = N'Đã kiểm tra camera, rắn đã bỏ đi';

PRINT N'seed 04: xong';
