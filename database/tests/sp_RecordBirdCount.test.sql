
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE #r (
    WindowsUpserted INT,
    WindowsUnchanged INT
);
GO

PRINT N'bird: ghi moi va gui lai du lieu';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @cam INT = (
        SELECT DeviceId
        FROM dbo.Devices
        WHERE Code = 'H1-F0-CAMERA'
    );

    DECLARE @j NVARCHAR(MAX) = N'[
      {
        "camera": "H1-F0-CAMERA",
        "windowStart": "2026-09-01T10:00:00Z",
        "in": 5,
        "out": 1
      },
      {
        "camera": "H1-F0-CAMERA",
        "windowStart": "2026-09-01T10:05:00Z",
        "in": 2,
        "out": 0
      }
    ]';

    INSERT #r
    EXEC dbo.sp_RecordBirdCount @j;

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE WindowsUpserted = 2
          AND WindowsUnchanged = 0
    )
        THROW 59999, N'Lan dau phai ghi 2 cua so', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.BirdCounts
        WHERE CameraId = @cam
          AND WindowStart = '2026-09-01T10:00:00'
          AND InCount = 5
          AND OutCount = 1
    )
        THROW 59999, N'Du lieu dem chim sai', 1;

    DELETE FROM #r;

    -- Gui lai cung du lieu
    INSERT #r
    EXEC dbo.sp_RecordBirdCount @j;

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE WindowsUpserted = 0
          AND WindowsUnchanged = 2
    )
        THROW 59999, N'Gui lai phai khong thay doi', 1;

    DELETE FROM #r;

    -- So chim vao nho hon, so chim ra lon hon
    INSERT #r
    EXEC dbo.sp_RecordBirdCount N'[
      {
        "camera": "H1-F0-CAMERA",
        "windowStart": "2026-09-01T10:00:00Z",
        "in": 3,
        "out": 4
      }
    ]';

    IF NOT EXISTS (
        SELECT 1 FROM dbo.BirdCounts
        WHERE CameraId = @cam
          AND WindowStart = '2026-09-01T10:00:00'
          AND InCount = 5
          AND OutCount = 4
    )
        THROW 59999, N'Phai giu InCount 5 va tang OutCount 4', 1;

    -- Trung cua so trong cung mot lo
    INSERT #r
    EXEC dbo.sp_RecordBirdCount N'[
      {
        "camera": "H2-F0-CAMERA",
        "windowStart": "2026-09-01T11:00:00Z",
        "in": 7,
        "out": 0
      },
      {
        "camera": "H2-F0-CAMERA",
        "windowStart": "2026-09-01T11:00:00Z",
        "in": 6,
        "out": 2
      }
    ]';

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.BirdCounts b
        JOIN dbo.Devices d ON d.DeviceId = b.CameraId
        WHERE d.Code = 'H2-F0-CAMERA'
          AND b.WindowStart = '2026-09-01T11:00:00'
          AND b.InCount = 7
          AND b.OutCount = 2
    )
        THROW 59999, N'Trung cua so phai lay gia tri lon nhat', 1;

    ROLLBACK;

    PRINT N'bird: ghi moi, gui lai, trung cua so PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO



PRINT N'bird: kiem tra ma loi du lieu khong hop le';

-- Camera khong ton tai -> 50010
BEGIN TRY
    EXEC dbo.sp_RecordBirdCount
        N'[{"camera":"KHONG-CO","windowStart":"2026-09-01T10:00:00Z","in":1,"out":0}]';

    THROW 59999, N'Mong doi loi 50010', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50010 THROW;
END CATCH
GO

-- Thiet bi SENSOR khong phai CAMERA -> 50010
BEGIN TRY
    EXEC dbo.sp_RecordBirdCount
        N'[{"camera":"H1-F1-SENSOR","windowStart":"2026-09-01T10:00:00Z","in":1,"out":0}]';

    THROW 59999, N'Mong doi loi 50010', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50010 THROW;
END CATCH
GO

-- So chim am -> 50012
BEGIN TRY
    EXEC dbo.sp_RecordBirdCount
        N'[{"camera":"H1-F0-CAMERA","windowStart":"2026-09-01T10:00:00Z","in":-1,"out":0}]';

    THROW 59999, N'Mong doi loi 50012', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50012 THROW;
END CATCH
GO

-- Sai moc 5 phut -> 50014
BEGIN TRY
    EXEC dbo.sp_RecordBirdCount
        N'[{"camera":"H1-F0-CAMERA","windowStart":"2026-09-01T10:01:00Z","in":1,"out":0}]';

    THROW 59999, N'Mong doi loi 50014', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50014 THROW;
END CATCH
GO

-- JSON khong hop le -> 50030
BEGIN TRY
    EXEC dbo.sp_RecordBirdCount N'khong phai json';

    THROW 59999, N'Mong doi loi 50030', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50030 THROW;
END CATCH
GO

-- Thieu Z o thoi gian UTC -> 50042
BEGIN TRY
    EXEC dbo.sp_RecordBirdCount
        N'[{"camera":"H1-F0-CAMERA","windowStart":"2026-09-01T10:00:00","in":1,"out":0}]';

    THROW 59999, N'Mong doi loi 50042', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO

-- Sai kieu du lieu -> 50042
BEGIN TRY
    EXEC dbo.sp_RecordBirdCount
        N'[{"camera":"H1-F0-CAMERA","windowStart":"2026-09-01T10:00:00Z","in":"nam","out":0}]';

    THROW 59999, N'Mong doi loi 50042', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO

PRINT N'bird: invalid input PASS';
GO




PRINT N'bird: kiem tra tinh nguyen tu cua lo';

DECLARE @before INT = (
    SELECT COUNT(*)
    FROM dbo.BirdCounts
    WHERE WindowStart >= '2026-09-01'
      AND WindowStart < '2026-09-02'
);

BEGIN TRY
    EXEC dbo.sp_RecordBirdCount N'[
      {
        "camera": "H1-F0-CAMERA",
        "windowStart": "2026-09-01T12:00:00Z",
        "in": 1,
        "out": 0
      },
      {
        "camera": "KHONG-CO",
        "windowStart": "2026-09-01T12:00:00Z",
        "in": 1,
        "out": 0
      }
    ]';

    THROW 59999, N'Mong doi loi 50010', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50010 THROW;
END CATCH;

IF (
    SELECT COUNT(*)
    FROM dbo.BirdCounts
    WHERE WindowStart >= '2026-09-01'
      AND WindowStart < '2026-09-02'
) <> @before
    THROW 59999, N'Lo loi khong duoc ghi du lieu', 1;
GO

PRINT N'bird: atomic batch PASS';
GO



PRINT N'bird: kiem tra CHECK moc 5 phut';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @cam INT = (
        SELECT DeviceId
        FROM dbo.Devices
        WHERE Code = 'H1-F0-CAMERA'
    );

    INSERT dbo.BirdCounts
        (CameraId, WindowStart, InCount, OutCount)
    VALUES
        (@cam, '2026-09-01T10:02:00', 1, 0);

    THROW 59999, N'Mong doi loi CHECK 547', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 547 THROW;
END CATCH
GO

PRINT N'bird: vw_DailyBirdFlow theo ngay Viet Nam';

BEGIN TRY
    BEGIN TRAN;

    -- 16:55 UTC = 23:55 ngay 01/09 gio Viet Nam
    -- 17:00 UTC = 00:00 ngay 02/09 gio Viet Nam

    DECLARE @r TABLE (
        WindowsUpserted INT,
        WindowsUnchanged INT
    );

    INSERT @r
    EXEC dbo.sp_RecordBirdCount N'[
      {
        "camera": "H2-F0-CAMERA",
        "windowStart": "2026-09-01T16:55:00Z",
        "in": 10,
        "out": 3
      },
      {
        "camera": "H2-F0-CAMERA",
        "windowStart": "2026-09-01T17:00:00Z",
        "in": 4,
        "out": 0
      }
    ]';

    DECLARE @h INT = (
        SELECT HouseId
        FROM dbo.Houses
        WHERE Name = N'H2'
    );

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.vw_DailyBirdFlow
        WHERE HouseId = @h
          AND DayVn = '2026-09-01'
          AND InTotal = 10
          AND OutTotal = 3
          AND Net = 7
    )
        THROW 59999, N'DailyBirdFlow: ngay 01/09 sai', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.vw_DailyBirdFlow
        WHERE HouseId = @h
          AND DayVn = '2026-09-02'
          AND InTotal = 4
          AND OutTotal = 0
          AND Net = 4
    )
        THROW 59999, N'DailyBirdFlow: ngay 02/09 sai', 1;

    ROLLBACK;

    PRINT N'bird: vw_DailyBirdFlow PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'sp_RecordBirdCount: PASS';
GO
