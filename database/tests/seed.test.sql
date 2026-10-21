
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

PRINT N'seed: du lieu tham chieu';

IF (SELECT COUNT(*) FROM dbo.Users) <> 3
    THROW 59999, N'seed: Users phai co 3 dong', 1;

IF (SELECT COUNT(*) FROM dbo.Houses) <> 2
    THROW 59999, N'seed: Houses phai co 2 dong', 1;

IF (SELECT COUNT(*) FROM dbo.Zones) <> 6
    THROW 59999, N'seed: Zones phai co 6 dong', 1;

IF (SELECT COUNT(*) FROM dbo.Devices) <> 28
    THROW 59999, N'seed: Devices phai co 28 dong', 1;




PRINT N'seed: kiem tra du lieu mau Task 12';

IF (SELECT COUNT(*) FROM dbo.SensorReadings) <> 54144
    THROW 59999, N'seed: SensorReadings phai co 54144 dong', 1;

IF (SELECT MIN(RecordedAt) FROM dbo.SensorReadings)
       <> '2026-10-04T17:00:00'
   OR (SELECT MAX(RecordedAt) FROM dbo.SensorReadings)
       <> '2026-10-12T12:55:00'
    THROW 59999, N'seed: khoang thoi gian so do sai', 1;

IF (
    SELECT COUNT(*)
    FROM dbo.Devices
    WHERE DeviceType = 'SENSOR'
      AND Status = 'ONLINE'
      AND LastSeenAt = '2026-10-12T12:55:00'
) <> 6
    THROW 59999, N'seed: 6 cam bien phai ONLINE', 1;

IF (SELECT COUNT(*) FROM dbo.BirdCounts) <> 864
    THROW 59999, N'seed: BirdCounts phai co 864 dong', 1;

IF (SELECT COUNT(*) FROM dbo.Alerts) <> 3
    THROW 59999, N'seed: Alerts phai co 3 dong', 1;

IF (SELECT COUNT(*) FROM dbo.AlertHistory) <> 5
    THROW 59999, N'seed: AlertHistory phai co 5 dong', 1;

PRINT N'seed: so luong ban ghi PASS';
GO
