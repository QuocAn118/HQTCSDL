
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE #r (
    Created BIT,
    AlertId INT,
    SkipReason VARCHAR(20),
    AlertJson NVARCHAR(MAX)
);
GO

PRINT N'predator: tao canh bao va kiem tra cooldown';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @cam INT = (
        SELECT DeviceId
        FROM dbo.Devices
        WHERE Code = 'H1-F0-CAMERA'
    );

    DECLARE @zone INT = (
        SELECT ZoneId
        FROM dbo.Devices
        WHERE Code = 'H1-F0-CAMERA'
    );

    DECLARE @house INT = (
        SELECT HouseId
        FROM dbo.Houses
        WHERE Name = N'H1'
    );

    DECLARE @a INT;

    -- Lan dau: phai tao canh bao
    INSERT #r
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"H1-F0-CAMERA","class":"snake","confidence":0.87,"snapshot":"snapshots/2026/09/01/snake.jpg","at":"2026-09-01T10:40:00Z"}';

    SELECT @a = AlertId
    FROM #r
    WHERE Created = 1
      AND SkipReason IS NULL;

    IF @a IS NULL
        THROW 59999, N'Lan dau phai tao canh bao', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Alerts
        WHERE AlertId = @a
          AND AlertType = 'PREDATOR'
          AND Severity = 'CRITICAL'
          AND DeviceId = @cam
          AND ZoneId = @zone
          AND HouseId = @house
          AND DetectedClass = 'snake'
          AND Confidence = 0.87
          AND CreatedAt = '2026-09-01T10:40:00'
    )
        THROW 59999, N'Du lieu canh bao sai', 1;

    IF (SELECT ISJSON(AlertJson) FROM #r) <> 1
       OR (SELECT JSON_VALUE(AlertJson, '$.HasSnapshot') FROM #r) <> 'true'
       OR (SELECT JSON_VALUE(AlertJson, '$.CreatedAt') FROM #r) <> '2026-09-01T10:40:00Z'
       OR (SELECT TRY_CAST(JSON_VALUE(AlertJson, '$.AlertId') AS INT) FROM #r) <> @a
        THROW 59999, N'AlertJson sai', 1;

    DELETE FROM #r;

    -- Cung camera, cung loai, trong 5 phut: bo qua
    INSERT #r
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"H1-F0-CAMERA","class":"snake","confidence":0.9,"snapshot":"snapshots/b.jpg","at":"2026-09-01T10:42:00Z"}';

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE Created = 0
          AND AlertId IS NULL
          AND SkipReason = 'COOLDOWN'
          AND AlertJson IS NULL
    )
        THROW 59999, N'Cooldown phai bo qua', 1;

    DELETE FROM #r;

    -- Khac loai: duoc tao canh bao
    INSERT #r
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"H1-F0-CAMERA","class":"owl","confidence":0.7,"snapshot":"snapshots/c.jpg","at":"2026-09-01T10:42:00Z"}';

    IF (SELECT Created FROM #r) <> 1
        THROW 59999, N'Khac loai phai tao canh bao', 1;

    DELETE FROM #r;

    -- Sau 6 phut: duoc tao canh bao moi
    INSERT #r
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"H1-F0-CAMERA","class":"snake","confidence":0.8,"snapshot":"snapshots/d.jpg","at":"2026-09-01T10:46:00Z"}';

    IF (SELECT Created FROM #r) <> 1
        THROW 59999, N'Het cooldown phai tao moi', 1;

    DELETE FROM #r;

    -- Do tin cay thap: bo qua
    INSERT #r
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"H1-F0-CAMERA","class":"rat","confidence":0.3,"snapshot":"snapshots/e.jpg","at":"2026-09-01T11:00:00Z"}';

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE Created = 0
          AND SkipReason = 'LOW_CONFIDENCE'
    )
        THROW 59999, N'Do tin cay thap phai bo qua', 1;

    ROLLBACK;

    PRINT N'predator: create and cooldown PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO



PRINT N'predator: kiem tra cac ma loi';

-- Loai dong vat khong hop le: 50013
BEGIN TRY
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"H1-F0-CAMERA","class":"cat","confidence":0.9,"snapshot":"snapshots/x.jpg","at":"2026-09-01T10:40:00Z"}';

    THROW 59999, N'Mong doi loi 50013', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50013 THROW;
END CATCH
GO

-- Camera khong ton tai: 50010
BEGIN TRY
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"KHONG-CO","class":"rat","confidence":0.9,"snapshot":"snapshots/x.jpg","at":"2026-09-01T10:40:00Z"}';

    THROW 59999, N'Mong doi loi 50010', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50010 THROW;
END CATCH
GO

-- Thiet bi khong phai CAMERA: 50010
BEGIN TRY
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"H1-F1-SENSOR","class":"rat","confidence":0.9,"snapshot":"snapshots/x.jpg","at":"2026-09-01T10:40:00Z"}';

    THROW 59999, N'Mong doi loi 50010', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50010 THROW;
END CATCH
GO

-- JSON la mang thay vi object: 50030
BEGIN TRY
    EXEC dbo.sp_CreatePredatorAlert
        N'[{"camera":"H1-F0-CAMERA"}]';

    THROW 59999, N'Mong doi loi 50030', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50030 THROW;
END CATCH
GO

-- Confidence vuot qua 1: 50042
BEGIN TRY
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"H1-F0-CAMERA","class":"rat","confidence":1.5,"snapshot":"snapshots/x.jpg","at":"2026-09-01T10:40:00Z"}';

    THROW 59999, N'Mong doi loi 50042', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO

-- Thieu snapshot: 50042
BEGIN TRY
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"H1-F0-CAMERA","class":"rat","confidence":0.9,"at":"2026-09-01T10:40:00Z"}';

    THROW 59999, N'Mong doi loi 50042', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO

-- Thoi gian khong dung dinh dang UTC Z: 50042
BEGIN TRY
    EXEC dbo.sp_CreatePredatorAlert
        N'{"camera":"H1-F0-CAMERA","class":"rat","confidence":0.9,"snapshot":"snapshots/x.jpg","at":"2026-09-01T10:40:00+07:00"}';

    THROW 59999, N'Mong doi loi 50042', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO

PRINT N'sp_CreatePredatorAlert: PASS';
GO
