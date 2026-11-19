USE SwiftletCare_Perf;
GO

CREATE OR ALTER PROCEDURE dbo.demo_LostUpdate_Naive
    @DeviceId INT,
    @Delta TINYINT = 10
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CurrentLevel INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @CurrentLevel = ISNULL(CAST(Level AS INT), 0)
        FROM dbo.Devices
        WHERE DeviceId = @DeviceId
          AND IsActive = 1
          AND DeviceType IN ('MIST', 'FAN', 'HEATER', 'SPEAKER');

        IF @CurrentLevel IS NULL
            THROW 51001, 'Actuator not found or inactive.', 1;

        WAITFOR DELAY '00:00:05';

        IF @CurrentLevel + @Delta > 255
            THROW 51002, 'Level would exceed TINYINT range.', 1;

        UPDATE dbo.Devices
        SET Level = @CurrentLevel + @Delta
        WHERE DeviceId = @DeviceId;

        COMMIT TRANSACTION;

        SELECT @DeviceId AS DeviceId,
               @CurrentLevel AS ReadLevel,
               @CurrentLevel + @Delta AS WrittenLevel,
               'NAIVE' AS TestType;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

CREATE OR ALTER PROCEDURE dbo.demo_LostUpdate_Safe
    @DeviceId INT,
    @Delta TINYINT = 10
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CurrentLevel INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @CurrentLevel = ISNULL(CAST(Level AS INT), 0)
        FROM dbo.Devices WITH (UPDLOCK, ROWLOCK)
        WHERE DeviceId = @DeviceId
          AND IsActive = 1
          AND DeviceType IN ('MIST', 'FAN', 'HEATER', 'SPEAKER');

        IF @CurrentLevel IS NULL
            THROW 51001, 'Actuator not found or inactive.', 1;

        WAITFOR DELAY '00:00:05';

        IF @CurrentLevel + @Delta > 255
            THROW 51002, 'Level would exceed TINYINT range.', 1;

        UPDATE dbo.Devices
        SET Level = @CurrentLevel + @Delta
        WHERE DeviceId = @DeviceId;

        COMMIT TRANSACTION;

        SELECT @DeviceId AS DeviceId,
               @CurrentLevel AS ReadLevel,
               @CurrentLevel + @Delta AS WrittenLevel,
               'SAFE' AS TestType;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
