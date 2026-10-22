
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE #r (
    NewAlertsJson NVARCHAR(MAX)
);
GO

PRINT N'anomaly: kiem tra giam dan va gio chot';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @cam INT = (
        SELECT DeviceId
        FROM dbo.Devices
        WHERE Code = 'H2-F0-CAMERA'
    );

    DECLARE @h2 INT = (
        SELECT HouseId
        FROM dbo.Houses
        WHERE Name = N'H2'
    );

    -- Bay ngay truoc: moi ngay 100 chim
    INSERT dbo.BirdCounts
        (CameraId, WindowStart, InCount, OutCount)
    SELECT
        @cam,
        DATEADD(DAY, n, '2026-09-01T11:00:00'),
        100,
        0
    FROM (VALUES (0),(1),(2),(3),(4),(5),(6)) v(n);

    -- Hom nay chi co 50 chim
    INSERT dbo.BirdCounts
        (CameraId, WindowStart, InCount, OutCount)
    VALUES
        (@cam, '2026-09-08T11:00:00', 50, 0);

    -- Du lieu sau gio chot khong duoc tinh
    INSERT dbo.BirdCounts
        (CameraId, WindowStart, InCount, OutCount)
    VALUES
        (@cam, '2026-09-08T14:00:00', 500, 0),
        (@cam, '2026-09-07T14:00:00', 900, 0);

    -- Truoc 20:00 gio Viet Nam: chua tao canh bao
    INSERT #r
    EXEC dbo.sp_DetectAnomalies
        @NowUtc = '2026-09-08T01:00:00';

    IF EXISTS (
        SELECT 1
        FROM dbo.Alerts
        WHERE AlertType = 'POPULATION_DROP'
          AND HouseId = @h2
    )
        THROW 59999, N'Truoc gio chot khong duoc bao', 1;

    DELETE FROM #r;

    -- 20:30 gio Viet Nam: phai tao canh bao
    INSERT #r
    EXEC dbo.sp_DetectAnomalies
        @NowUtc = '2026-09-08T13:30:00';

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Alerts
        WHERE AlertType = 'POPULATION_DROP'
          AND HouseId = @h2
          AND ZoneId IS NULL
          AND DeviceId IS NULL
          AND Severity = 'CRITICAL'
          AND CreatedAt = '2026-09-08T13:30:00'
    )
        THROW 59999, N'Giam 50 phan tram phai bao', 1;

    IF (
        SELECT COUNT(*)
        FROM OPENJSON(
            (SELECT NewAlertsJson FROM #r)
        )
        WHERE JSON_VALUE(value, '$.AlertType') = 'POPULATION_DROP'
    ) <> 1
        THROW 59999, N'NewAlertsJson phai co canh bao', 1;

    DELETE FROM #r;

    -- Chay lai cung ngay: khong tao them canh bao
    INSERT #r
    EXEC dbo.sp_DetectAnomalies
        @NowUtc = '2026-09-08T14:00:00';

    IF (
        SELECT COUNT(*)
        FROM dbo.Alerts
        WHERE AlertType = 'POPULATION_DROP'
          AND HouseId = @h2
    ) <> 1
        THROW 59999, N'Moi ngay chi duoc mot canh bao', 1;

    IF (SELECT NewAlertsJson FROM #r) <> N'[]'
        THROW 59999, N'Lan sau phai tra mang rong', 1;

    ROLLBACK;

    PRINT N'anomaly: population drop PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO



PRINT N'anomaly: duoi 3 ngay du lieu va giam it';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @c1 INT = (
        SELECT DeviceId
        FROM dbo.Devices
        WHERE Code = 'H1-F0-CAMERA'
    );

    DECLARE @c2 INT = (
        SELECT DeviceId
        FROM dbo.Devices
        WHERE Code = 'H2-F0-CAMERA'
    );

    -- H1: chi co 2 ngay du lieu truoc do
    INSERT dbo.BirdCounts
        (CameraId, WindowStart, InCount, OutCount)
    VALUES
        (@c1, '2026-09-06T11:00:00', 100, 0),
        (@c1, '2026-09-07T11:00:00', 100, 0),
        (@c1, '2026-09-08T11:00:00', 10, 0);

    -- H2: 7 ngay truoc moi ngay 100 chim
    INSERT dbo.BirdCounts
        (CameraId, WindowStart, InCount, OutCount)
    SELECT
        @c2,
        DATEADD(DAY, n, '2026-09-01T11:00:00'),
        100,
        0
    FROM (VALUES (0),(1),(2),(3),(4),(5),(6)) v(n);

    -- Hom nay 95 chim, chi giam 5%
    INSERT dbo.BirdCounts
        (CameraId, WindowStart, InCount, OutCount)
    VALUES
        (@c2, '2026-09-08T11:00:00', 95, 0);

    DECLARE @r TABLE (
        NewAlertsJson NVARCHAR(MAX)
    );

    INSERT @r
    EXEC dbo.sp_DetectAnomalies
        @NowUtc = '2026-09-08T13:30:00';

    IF EXISTS (
        SELECT 1
        FROM dbo.Alerts
        WHERE AlertType = 'POPULATION_DROP'
          AND CreatedAt = '2026-09-08T13:30:00'
    )
        THROW 59999, N'Khong du du lieu hoac giam it khong duoc bao', 1;

    ROLLBACK;

    PRINT N'anomaly: insufficient data and small drop PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'anomaly: kiem tra tham so khong hop le';

-- DropPercent ngoai khoang (0,100)
BEGIN TRY
    EXEC dbo.sp_DetectAnomalies @DropPercent = 150;
    THROW 59999, N'Mong doi loi 50042', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO

-- CutoffHourVn ngoai khoang [0,23]
BEGIN TRY
    EXEC dbo.sp_DetectAnomalies @CutoffHourVn = 24;
    THROW 59999, N'Mong doi loi 50042', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO

-- OfflineMinutes phai lon hon 0
BEGIN TRY
    EXEC dbo.sp_DetectAnomalies @OfflineMinutes = 0;
    THROW 59999, N'Mong doi loi 50042', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO

PRINT N'sp_DetectAnomalies: PASS';
GO
