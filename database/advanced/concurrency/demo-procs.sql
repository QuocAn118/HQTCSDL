
USE SwiftletCare_Perf;
GO

SET NOCOUNT ON;
GO

-- Bang ghi nhan cac buoc quan sat cua cac phien demo.
IF OBJECT_ID(N'dbo.DemoLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DemoLog
    (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Scenario VARCHAR(40) NOT NULL,
        Sess CHAR(1) NOT NULL,
        Step VARCHAR(40) NOT NULL,
        Val NVARCHAR(100) NULL,
        At DATETIME2(3) NOT NULL
            CONSTRAINT DF_DemoLog_At DEFAULT SYSUTCDATETIME()
    );
END;
GO

-- NAIVE: doc khong khoa, tao khoang tranh chap bang WAITFOR.
CREATE OR ALTER PROCEDURE dbo.sp_SetActuatorNaive
    @DeviceCode VARCHAR(50),
    @IsOn BIT,
    @Source VARCHAR(6),
    @UserId INT = NULL,
    @DelaySeconds INT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Source NOT IN ('AUTO', 'MANUAL')
        THROW 51001, N'Source phai la AUTO hoac MANUAL.', 1;

    IF @Source = 'MANUAL' AND @UserId IS NULL
        THROW 51002, N'MANUAL can UserId.', 1;

    IF @DelaySeconds < 0 OR @DelaySeconds > 30
        THROW 51003, N'DelaySeconds phai trong khoang 0..30.', 1;

    DECLARE @DeviceId INT,
            @CurMode VARCHAR(6),
            @CurLevel TINYINT,
            @NewMode VARCHAR(6);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @DeviceId = DeviceId,
            @CurMode = Mode,
            @CurLevel = Level
        FROM dbo.Devices
        WHERE Code = @DeviceCode
          AND IsActive = 1
          AND DeviceType IN ('FAN', 'MIST', 'HEATER', 'SPEAKER');

        IF @DeviceId IS NULL
            THROW 51004, N'Khong tim thay actuator hop le.', 1;

        INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
        VALUES (
            'lost-update-naive',
            CASE WHEN @Source = 'AUTO' THEN 'A' ELSE 'B' END,
            'READ',
            CONCAT('Mode=', COALESCE(@CurMode, 'NULL'),
                   '; IsOn=', @IsOn)
        );

        IF @DelaySeconds > 0
            DECLARE @WaitTime VARCHAR(8) = CONVERT(VARCHAR(8), DATEADD(SECOND, @DelaySeconds, CAST('00:00:00' AS TIME)), 108);
            WAITFOR DELAY @WaitTime;

        -- Mo phong ghi theo gia tri Mode da doc truoc do.
        SET @NewMode =
            CASE WHEN @Source = 'MANUAL' THEN 'MANUAL' ELSE 'AUTO' END;

        IF NOT (@Source = 'AUTO' AND @CurMode = 'MANUAL')
        BEGIN
            UPDATE dbo.Devices
            SET Mode = @NewMode,
                IsOn = @IsOn
            WHERE DeviceId = @DeviceId;

            INSERT dbo.ControlLogs
                (DeviceId, UserId, Source, Mode, IsOn, Level, Reason)
            SELECT
                @DeviceId,
                @UserId,
                @Source,
                @NewMode,
                @IsOn,
                Level,
                N'Demo Task 5 - NAIVE'
            FROM dbo.Devices
            WHERE DeviceId = @DeviceId;

            INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
            VALUES (
                'lost-update-naive',
                CASE WHEN @Source = 'AUTO' THEN 'A' ELSE 'B' END,
                'WRITE',
                CONCAT('Mode=', @NewMode, '; IsOn=', @IsOn)
            );
        END
        ELSE
        BEGIN
            INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
            VALUES (
                'lost-update-naive',
                CASE WHEN @Source = 'AUTO' THEN 'A' ELSE 'B' END,
                'SKIP',
                'Device dang MANUAL'
            );
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- SAFE: UPDLOCK duoc giu trong transaction tu luc doc den luc ghi.
CREATE OR ALTER PROCEDURE dbo.sp_SetActuatorSafe
    @DeviceCode VARCHAR(50),
    @IsOn BIT,
    @Source VARCHAR(6),
    @UserId INT = NULL,
    @DelaySeconds INT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Source NOT IN ('AUTO', 'MANUAL')
        THROW 51101, N'Source phai la AUTO hoac MANUAL.', 1;

    IF @Source = 'MANUAL' AND @UserId IS NULL
        THROW 51102, N'MANUAL can UserId.', 1;

    IF @DelaySeconds < 0 OR @DelaySeconds > 30
        THROW 51103, N'DelaySeconds phai trong khoang 0..30.', 1;

    DECLARE @DeviceId INT,
            @CurMode VARCHAR(6),
            @CurLevel TINYINT,
            @NewMode VARCHAR(6);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @DeviceId = DeviceId,
            @CurMode = Mode,
            @CurLevel = Level
        FROM dbo.Devices WITH (UPDLOCK, ROWLOCK)
        WHERE Code = @DeviceCode
          AND IsActive = 1
          AND DeviceType IN ('FAN', 'MIST', 'HEATER', 'SPEAKER');

        IF @DeviceId IS NULL
            THROW 51104, N'Khong tim thay actuator hop le.', 1;

        INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
        VALUES (
            'lost-update-safe',
            CASE WHEN @Source = 'AUTO' THEN 'A' ELSE 'B' END,
            'READ',
            CONCAT('Mode=', COALESCE(@CurMode, 'NULL'),
                   '; IsOn=', @IsOn)
        );

        IF @DelaySeconds > 0
            DECLARE @WaitTime VARCHAR(8) = CONVERT(VARCHAR(8), DATEADD(SECOND, @DelaySeconds, CAST('00:00:00' AS TIME)), 108);
            WAITFOR DELAY @WaitTime;

        SET @NewMode =
            CASE WHEN @Source = 'MANUAL' THEN 'MANUAL' ELSE 'AUTO' END;

        IF NOT (@Source = 'AUTO' AND @CurMode = 'MANUAL')
        BEGIN
            UPDATE dbo.Devices
            SET Mode = @NewMode,
                IsOn = @IsOn
            WHERE DeviceId = @DeviceId;

            INSERT dbo.ControlLogs
                (DeviceId, UserId, Source, Mode, IsOn, Level, Reason)
            SELECT
                @DeviceId,
                @UserId,
                @Source,
                @NewMode,
                @IsOn,
                Level,
                N'Demo Task 5 - SAFE'
            FROM dbo.Devices
            WHERE DeviceId = @DeviceId;

            INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
            VALUES (
                'lost-update-safe',
                CASE WHEN @Source = 'AUTO' THEN 'A' ELSE 'B' END,
                'WRITE',
                CONCAT('Mode=', @NewMode, '; IsOn=', @IsOn)
            );
        END
        ELSE
        BEGIN
            INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
            VALUES (
                'lost-update-safe',
                CASE WHEN @Source = 'AUTO' THEN 'A' ELSE 'B' END,
                'SKIP',
                'Device dang MANUAL'
            );
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

PRINT N'Task 5 demo procedures: installed';
GO
