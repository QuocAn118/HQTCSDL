
SET NOCOUNT ON;
SET XACT_ABORT OFF;
GO

BEGIN TRAN;

DECLARE @u INT, @h1 INT, @h2 INT, @z1 INT, @z2 INT;
DECLARE @sensor INT, @fan INT, @cam INT;
DECLARE @expected NVARCHAR(50), @case NVARCHAR(200);

INSERT dbo.Users (Username, PasswordHash, FullName, Email, Role)
VALUES ('ck_user', 'x', N'Kiểm thử', 'ck@example.com', 'OWNER');
SET @u = SCOPE_IDENTITY();

INSERT dbo.Houses (OwnerId, Name) VALUES (@u, N'CK nhà 1');
SET @h1 = SCOPE_IDENTITY();

INSERT dbo.Houses (OwnerId, Name) VALUES (@u, N'CK nhà 2');
SET @h2 = SCOPE_IDENTITY();

INSERT dbo.Zones (HouseId, Name, FloorNo) VALUES (@h1, N'Tầng 1', 1);
SET @z1 = SCOPE_IDENTITY();

INSERT dbo.Zones (HouseId, Name, FloorNo) VALUES (@h2, N'Tầng 1', 1);
SET @z2 = SCOPE_IDENTITY();

IF NOT EXISTS (SELECT 1 FROM dbo.Metrics WHERE MetricCode = 'TEMP')
    INSERT dbo.Metrics (MetricCode, Name, Unit, ValidMin, ValidMax, Hysteresis)
    VALUES ('TEMP', N'Nhiệt độ', N'°C', -10, 60, 0.5);

INSERT dbo.Devices (ZoneId, Code, Name, DeviceType)
VALUES (@z1, 'CK-SENSOR', N'Cảm biến', 'SENSOR');
SET @sensor = SCOPE_IDENTITY();

INSERT dbo.Devices (ZoneId, Code, Name, DeviceType, Mode, IsOn)
VALUES (@z1, 'CK-FAN', N'Quạt', 'FAN', 'AUTO', 0);
SET @fan = SCOPE_IDENTITY();

INSERT dbo.Devices (ZoneId, Code, Name, DeviceType)
VALUES (@z1, 'CK-CAM', N'Camera', 'CAMERA');
SET @cam = SCOPE_IDENTITY();

-- USERS
SET @case = N'Users.Role ngoai mien';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.Users (Username, PasswordHash, FullName, Email, Role)
    VALUES ('x1', 'x', N'x', 'x1@e.com', 'GUEST');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

SET @case = N'Users.Username trung';
SET @expected = N'2601,2627';
BEGIN TRY
    INSERT dbo.Users (Username, PasswordHash, FullName, Email, Role)
    VALUES ('ck_user', 'x', N'x', 'x2@e.com', 'OWNER');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

-- DEVICES
SET @case = N'SENSOR co Mode';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.Devices (ZoneId, Code, Name, DeviceType, Mode)
    VALUES (@z1, 'CK-X1', N'x', 'SENSOR', 'AUTO');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

SET @case = N'FAN thieu Mode/IsOn';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.Devices (ZoneId, Code, Name, DeviceType)
    VALUES (@z1, 'CK-X2', N'x', 'FAN');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

SET @case = N'Devices.Level 101';
SET @expected = N'547';
BEGIN TRY
    UPDATE dbo.Devices SET Level = 101 WHERE DeviceId = @fan;
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

SET @case = N'Devices.Mode ngoai mien';
SET @expected = N'547';
BEGIN TRY
    UPDATE dbo.Devices SET Mode = 'SEMI' WHERE DeviceId = @fan;
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

SET @case = N'Devices.Code trung';
SET @expected = N'2601,2627';
BEGIN TRY
    INSERT dbo.Devices (ZoneId, Code, Name, DeviceType)
    VALUES (@z1, 'CK-SENSOR', N'x', 'SENSOR');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

-- METRICS
SET @case = N'Metrics ValidMin >= ValidMax';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.Metrics (MetricCode, Name, Unit, ValidMin, ValidMax, Hysteresis)
    VALUES ('CKX', N'x', N'x', 10, 10, 0);
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

-- THRESHOLDS
SET @case = N'Thresholds khong co nguong nao';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.Thresholds (ZoneId, MetricCode)
    VALUES (@z1, 'TEMP');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

SET @case = N'Thresholds Min >= Max';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.Thresholds (ZoneId, MetricCode, MinValue, MaxValue)
    VALUES (@z1, 'TEMP', 30, 26);
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

SET @case = N'Thresholds Target ngoai [Min,Max]';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.Thresholds (ZoneId, MetricCode, MinValue, MaxValue, TargetValue)
    VALUES (@z1, 'TEMP', 26, 30, 31);
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

-- CONTROL LOGS
SET @case = N'ControlLogs MANUAL thieu UserId';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.ControlLogs (DeviceId, IsOn, Mode, Source)
    VALUES (@fan, 1, 'MANUAL', 'MANUAL');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

-- ALERTS
SET @case = N'Alerts THRESHOLD thieu MetricCode';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, Value, Message)
    VALUES (@h1, @z1, 'THRESHOLD', 'WARNING', 31, N'x');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

SET @case = N'Alerts POPULATION_DROP co ZoneId';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, Message)
    VALUES (@h1, @z1, 'POPULATION_DROP', 'CRITICAL', N'x');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

SET @case = N'Alerts PREDATOR loai la';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.Alerts
        (HouseId, ZoneId, DeviceId, AlertType, Severity, DetectedClass, Confidence, SnapshotPath, Message)
    VALUES
        (@h1, @z1, @cam, 'PREDATOR', 'CRITICAL', 'cat', 0.9, N'a.jpg', N'x');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

SET @case = N'Alerts ZoneId cua nha khac';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.Alerts
        (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message)
    VALUES
        (@h1, @z2, 'THRESHOLD', 'WARNING', 'TEMP', 31, N'x');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

SET @case = N'Alerts RESOLVED thieu ResolvedAt';
SET @expected = N'547';
BEGIN TRY
    INSERT dbo.Alerts
        (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message, Status)
    VALUES
        (@h1, @z1, 'THRESHOLD', 'WARNING', 'TEMP', 31, N'x', 'RESOLVED');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

-- FILTERED UNIQUE INDEX
INSERT dbo.Alerts
    (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message, Status, ResolvedAt)
VALUES
    (@h1, @z1, 'THRESHOLD', 'WARNING', 'TEMP', 31, N'da dong', 'RESOLVED', SYSUTCDATETIME());

INSERT dbo.Alerts
    (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message)
VALUES
    (@h1, @z1, 'THRESHOLD', 'WARNING', 'TEMP', 31, N'dang mo');

SET @case = N'Hai THRESHOLD dang mo cung zone metric';
SET @expected = N'2601';
BEGIN TRY
    INSERT dbo.Alerts
        (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message)
    VALUES
        (@h1, @z1, 'THRESHOLD', 'WARNING', 'TEMP', 32, N'trung');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

-- PREDATOR alerts must not be blocked by the threshold index
INSERT dbo.Alerts
    (HouseId, ZoneId, DeviceId, AlertType, Severity, DetectedClass, Confidence, SnapshotPath, Message)
VALUES
    (@h1, @z1, @cam, 'PREDATOR', 'CRITICAL', 'rat', 0.9, N'a.jpg', N'x');

INSERT dbo.Alerts
    (HouseId, ZoneId, DeviceId, AlertType, Severity, DetectedClass, Confidence, SnapshotPath, Message)
VALUES
    (@h1, @z1, @cam, 'PREDATOR', 'CRITICAL', 'owl', 0.8, N'b.jpg', N'y');

-- SENSOR READINGS
SET @case = N'SensorReadings trung Device Metric RecordedAt';
SET @expected = N'2601,2627';

INSERT dbo.SensorReadings (DeviceId, MetricCode, Value, RecordedAt)
VALUES (@sensor, 'TEMP', 28, '2026-10-12T10:00:00');

BEGIN TRY
    INSERT dbo.SensorReadings (DeviceId, MetricCode, Value, RecordedAt)
    VALUES (@sensor, 'TEMP', 29, '2026-10-12T10:00:00');
    THROW 59999, N'khong bi chan', 1;
END TRY
BEGIN CATCH
    IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0
    BEGIN
        ROLLBACK;
        THROW 59998, @case, 1;
    END
END CATCH;

ROLLBACK;
PRINT N'constraints: PASS';
GO
