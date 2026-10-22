
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE #r (
    Changed BIT,
    DeviceCode VARCHAR(50),
    Mode VARCHAR(6),
    IsOn BIT,
    Level TINYINT
);
GO

PRINT N'actuator: kiem tra MANUAL';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @fan INT = (
        SELECT DeviceId
        FROM dbo.Devices
        WHERE Code = 'H1-F1-FAN'
    );

    DECLARE @u INT = (
        SELECT UserId
        FROM dbo.Users
        WHERE Username = 'owner1'
    );

    INSERT #r
    EXEC dbo.sp_SetActuator
        @DeviceId = @fan,
        @IsOn = 1,
        @Level = 80,
        @Source = 'MANUAL',
        @UserId = @u,
        @Reason = N'Bật tay';

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE Changed = 1
          AND DeviceCode = 'H1-F1-FAN'
          AND Mode = 'MANUAL'
          AND IsOn = 1
          AND Level = 80
    )
        THROW 59999, N'MANUAL: ket qua sai', 1;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.ControlLogs
        WHERE DeviceId = @fan
          AND Source = 'MANUAL'
          AND UserId = @u
          AND IsOn = 1
          AND Level = 80
    )
        THROW 59999, N'MANUAL: thieu ControlLogs', 1;

    ROLLBACK;
    PRINT N'sp_SetActuator: PASS';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
GO


PRINT N'actuator: AUTO khong duoc ghi de MANUAL';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @fan2 INT = (
        SELECT DeviceId
        FROM dbo.Devices
        WHERE Code = 'H1-F1-FAN'
    );

    DECLARE @user2 INT = (
        SELECT UserId
        FROM dbo.Users
        WHERE Username = 'owner1'
    );

    DECLARE @logsBefore2 INT = (
        SELECT COUNT(*)
        FROM dbo.ControlLogs
        WHERE DeviceId = @fan2
    );

    -- 1. Nguoi dung bat quat o che do MANUAL
    DELETE FROM #r;

    INSERT #r
    EXEC dbo.sp_SetActuator
        @DeviceId = @fan2,
        @IsOn = 1,
        @Level = 80,
        @Source = 'MANUAL',
        @UserId = @user2;

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE Changed = 1
          AND Mode = 'MANUAL'
          AND IsOn = 1
          AND Level = 80
    )
        THROW 59999, N'MANUAL khong thanh cong', 1;

    -- 2. He thong AUTO thu tat quat
    DELETE FROM #r;

    INSERT #r
    EXEC dbo.sp_SetActuator
        @DeviceId = @fan2,
        @IsOn = 0,
        @Source = 'AUTO';

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE Changed = 0
          AND Mode = 'MANUAL'
          AND IsOn = 1
          AND Level = 80
    )
        THROW 59999, N'AUTO da ghi de MANUAL', 1;

    -- 3. Xac nhan trang thai thiet bi khong doi
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Devices
        WHERE DeviceId = @fan2
          AND Mode = 'MANUAL'
          AND IsOn = 1
          AND Level = 80
    )
        THROW 59999, N'Trang thai thiet bi bi thay doi', 1;

    -- 4. Chi ghi mot nhat ky MANUAL
    IF (
        SELECT COUNT(*)
        FROM dbo.ControlLogs
        WHERE DeviceId = @fan2
    ) <> @logsBefore2 + 1
        THROW 59999, N'AUTO bi chan nhung van ghi nhat ky', 1;

    ROLLBACK;

    PRINT N'actuator: AUTO/MANUAL PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
GO



PRINT N'actuator: tra quyen AUTO va lenh trung';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @fan3 INT = (
        SELECT DeviceId
        FROM dbo.Devices
        WHERE Code = 'H1-F1-FAN'
    );

    DECLARE @user3 INT = (
        SELECT UserId
        FROM dbo.Users
        WHERE Username = 'owner1'
    );

    DECLARE @logs3 INT = (
        SELECT COUNT(*)
        FROM dbo.ControlLogs
        WHERE DeviceId = @fan3
    );

    -- 1. Chuyen sang MANUAL
    DELETE FROM #r;

    INSERT #r
    EXEC dbo.sp_SetActuator
        @DeviceId = @fan3,
        @IsOn = 1,
        @Level = 80,
        @Source = 'MANUAL',
        @UserId = @user3;

    -- 2. Gui lai lenh giong het
    DELETE FROM #r;

    INSERT #r
    EXEC dbo.sp_SetActuator
        @DeviceId = @fan3,
        @IsOn = 1,
        @Level = 80,
        @Source = 'MANUAL',
        @UserId = @user3;

    IF NOT EXISTS (
        SELECT 1 FROM #r WHERE Changed = 0
    )
        THROW 59999, N'Lenh trung phai co Changed = 0', 1;

    -- 3. Nguoi dung tra quyen ve AUTO
    DELETE FROM #r;

    INSERT #r
    EXEC dbo.sp_SetActuator
        @DeviceId = @fan3,
        @IsOn = 1,
        @Source = 'MANUAL',
        @Mode = 'AUTO',
        @UserId = @user3;

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE Changed = 1
          AND Mode = 'AUTO'
          AND IsOn = 1
    )
        THROW 59999, N'Tra quyen AUTO that bai', 1;

    -- 4. AUTO duoc phep tat quat
    DELETE FROM #r;

    INSERT #r
    EXEC dbo.sp_SetActuator
        @DeviceId = @fan3,
        @IsOn = 0,
        @Source = 'AUTO';

    IF NOT EXISTS (
        SELECT 1 FROM #r
        WHERE Changed = 1
          AND Mode = 'AUTO'
          AND IsOn = 0
    )
        THROW 59999, N'AUTO khong dieu khien duoc', 1;

    -- 5. Phai co dung 3 nhat ky moi
    IF (
        SELECT COUNT(*)
        FROM dbo.ControlLogs
        WHERE DeviceId = @fan3
    ) <> @logs3 + 3
        THROW 59999, N'So luong ControlLogs khong dung', 1;

    ROLLBACK;

    PRINT N'actuator: tra quyen AUTO PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
GO



PRINT N'actuator: kiem tra du lieu khong hop le';

-- 1. Source khong hop le -> 50001
BEGIN TRY
    DECLARE @fan4 INT = (
        SELECT DeviceId FROM dbo.Devices
        WHERE Code = 'H1-F1-FAN'
    );

    EXEC dbo.sp_SetActuator
        @DeviceId = @fan4,
        @IsOn = 1,
        @Source = 'ROBOT';

    THROW 59999, N'Source sai: mong doi 50001', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50001 THROW;
END CATCH;
GO

-- 2. MANUAL thieu UserId -> 50002
BEGIN TRY
    DECLARE @fan5 INT = (
        SELECT DeviceId FROM dbo.Devices
        WHERE Code = 'H1-F1-FAN'
    );

    EXEC dbo.sp_SetActuator
        @DeviceId = @fan5,
        @IsOn = 1,
        @Source = 'MANUAL';

    THROW 59999, N'MANUAL thieu UserId: mong doi 50002', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50002 THROW;
END CATCH;
GO

-- 3. Mode khong hop le -> 50042
BEGIN TRY
    DECLARE @fan6 INT = (
        SELECT DeviceId FROM dbo.Devices
        WHERE Code = 'H1-F1-FAN'
    );

    DECLARE @user6 INT = (
        SELECT UserId FROM dbo.Users
        WHERE Username = 'owner1'
    );

    EXEC dbo.sp_SetActuator
        @DeviceId = @fan6,
        @IsOn = 1,
        @Source = 'MANUAL',
        @Mode = 'SEMI',
        @UserId = @user6;

    THROW 59999, N'Mode sai: mong doi 50042', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH;
GO

-- 4. Level vuot gioi han -> 547
PRINT N'actuator: Level 150 phai bi tu choi';

DECLARE @fan7 INT = (
    SELECT DeviceId FROM dbo.Devices
    WHERE Code = 'H1-F1-FAN'
);

DECLARE @logsBefore7 INT = (
    SELECT COUNT(*) FROM dbo.ControlLogs
    WHERE DeviceId = @fan7
);

BEGIN TRY
    BEGIN TRAN;

    EXEC dbo.sp_SetActuator
        @DeviceId = @fan7,
        @IsOn = 1,
        @Level = 150,
        @Source = 'AUTO';

    THROW 59999, N'Level 150: mong doi loi 547', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 547 THROW;
END CATCH;

IF (
    SELECT COUNT(*) FROM dbo.ControlLogs
    WHERE DeviceId = @fan7
) <> @logsBefore7
    THROW 59999, N'Level sai nhung van ghi ControlLogs', 1;

PRINT N'actuator: invalid input PASS';
GO
