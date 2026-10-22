
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'admin')
BEGIN
    PRINT N'seed 01: da co du lieu, bo qua';
    RETURN;
END

BEGIN TRAN;

-- Hash bcrypt cho tai khoan demo
DECLARE @hash VARCHAR(255) =
'$2a$10$M/DxgzTqClpNLyz2TDREfuIq8x2OHTobFhaeNPRbb4wfw.xhCp05K';

INSERT dbo.Users (Username, PasswordHash, FullName, Email, Role)
VALUES
('admin', @hash, N'Quản trị viên', 'admin@swiftletcare.local', 'ADMIN'),
('owner1', @hash, N'Chủ nhà yến H1', 'owner1@swiftletcare.local', 'OWNER'),
('owner2', @hash, N'Chủ nhà yến H2', 'owner2@swiftletcare.local', 'OWNER');

INSERT dbo.Houses (OwnerId, Name, Address)
SELECT u.UserId, v.Name, v.Address
FROM (VALUES
    ('owner1', N'H1', N'Kiên Giang'),
    ('owner2', N'H2', N'Khánh Hòa')
) v (Username, Name, Address)
JOIN dbo.Users u ON u.Username = v.Username;

INSERT dbo.Zones (HouseId, Name, FloorNo)
SELECT h.HouseId, v.ZoneName, v.FloorNo
FROM (VALUES
    (N'H1', N'F0', 0),
    (N'H1', N'F1', 1),
    (N'H1', N'F2', 2),
    (N'H1', N'F3', 3),
    (N'H2', N'F0', 0),
    (N'H2', N'F1', 1)
) v (HouseName, ZoneName, FloorNo)
JOIN dbo.Houses h ON h.Name = v.HouseName;

-- Moi khu vuc co SENSOR, MIST, FAN, HEATER
INSERT dbo.Devices (ZoneId, Code, Name, DeviceType, Mode, IsOn, Level)
SELECT
    z.ZoneId,
    CONCAT(h.Name, '-F', z.FloorNo, '-', t.DeviceType),
    CONCAT(t.Label, N' ', h.Name, N' tầng ', z.FloorNo),
    t.DeviceType,
    CASE WHEN t.IsActuator = 1 THEN 'AUTO' END,
    CASE WHEN t.IsActuator = 1 THEN CAST(0 AS BIT) END,
    CASE WHEN t.DeviceType = 'FAN' THEN 0 END
FROM dbo.Zones z
JOIN dbo.Houses h ON h.HouseId = z.HouseId
CROSS JOIN (VALUES
    ('SENSOR', N'Cảm biến', 0),
    ('MIST', N'Phun sương', 1),
    ('FAN', N'Quạt', 1),
    ('HEATER', N'Sưởi', 1)
) t (DeviceType, Label, IsActuator);

-- Moi nha co them SPEAKER va CAMERA o tang F0
INSERT dbo.Devices (ZoneId, Code, Name, DeviceType, Mode, IsOn, Level)
SELECT
    z.ZoneId,
    CONCAT(h.Name, '-F0-', t.DeviceType),
    CONCAT(t.Label, N' ', h.Name),
    t.DeviceType,
    CASE WHEN t.DeviceType = 'SPEAKER' THEN 'AUTO' END,
    CASE WHEN t.DeviceType = 'SPEAKER' THEN CAST(1 AS BIT) END,
    NULL
FROM dbo.Zones z
JOIN dbo.Houses h
    ON h.HouseId = z.HouseId AND z.FloorNo = 0
CROSS JOIN (VALUES
    ('SPEAKER', N'Loa dẫn dụ'),
    ('CAMERA', N'Camera cửa')
) t (DeviceType, Label);

INSERT dbo.Metrics
    (MetricCode, Name, Unit, ValidMin, ValidMax, Hysteresis)
VALUES
    ('TEMP', N'Nhiệt độ', N'°C', -10, 60, 0.5),
    ('HUMID', N'Độ ẩm', N'%', 0, 100, 2),
    ('CO2', N'CO2', N'ppm', 0, 10000, 50),
    ('LIGHT', N'Ánh sáng', N'lux', 0, 100000, 2);

INSERT dbo.Thresholds
    (ZoneId, MetricCode, MinValue, MaxValue, TargetValue, UpdatedBy)
SELECT
    z.ZoneId,
    v.MetricCode,
    v.MinValue,
    v.MaxValue,
    v.TargetValue,
    (SELECT UserId FROM dbo.Users WHERE Username = 'admin')
FROM dbo.Zones z
CROSS JOIN (VALUES
    ('TEMP', 26, 30, 28),
    ('HUMID', 75, 90, 82),
    ('CO2', NULL, 1000, NULL),
    ('LIGHT', NULL, 10, NULL)
) v (MetricCode, MinValue, MaxValue, TargetValue);

COMMIT;

PRINT N'seed 01: xong';
