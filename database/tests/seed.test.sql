
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
