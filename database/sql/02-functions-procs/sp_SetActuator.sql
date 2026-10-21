
CREATE OR ALTER PROCEDURE dbo.sp_SetActuator
    @DeviceId INT,
    @IsOn BIT,
    @Level TINYINT = NULL,
    @Source VARCHAR(6),
    @Mode VARCHAR(6) = NULL,
    @UserId INT = NULL,
    @Reason NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Source IS NULL OR @Source NOT IN ('AUTO', 'MANUAL')
        THROW 50001, N'@Source phai la AUTO hoac MANUAL.', 1;

    IF @Source = 'MANUAL' AND @UserId IS NULL
        THROW 50002, N'Dieu khien MANUAL can @UserId.', 1;

    IF @IsOn IS NULL
       OR (@Mode IS NOT NULL AND @Mode NOT IN ('AUTO', 'MANUAL'))
        THROW 50042, N'@IsOn bat buoc; @Mode chi nhan AUTO/MANUAL.', 1;

    DECLARE @Code VARCHAR(50),
            @CurMode VARCHAR(6),
            @CurIsOn BIT,
            @CurLevel TINYINT;

    DECLARE @NewMode VARCHAR(6),
            @NewIsOn BIT,
            @NewLevel TINYINT,
            @Changed BIT = 0;

    BEGIN TRAN;

    SELECT
        @Code = Code,
        @CurMode = Mode,
        @CurIsOn = IsOn,
        @CurLevel = Level
    FROM dbo.Devices WITH (UPDLOCK, ROWLOCK)
    WHERE DeviceId = @DeviceId
      AND IsActive = 1
      AND DeviceType IN ('MIST', 'FAN', 'HEATER', 'SPEAKER');

    IF @Code IS NULL
        THROW 50003, N'Thiet bi khong ton tai hoac khong the dieu khien.', 1;

    IF @Source = 'AUTO' AND @CurMode = 'MANUAL'
    BEGIN
        SELECT
            @NewMode = @CurMode,
            @NewIsOn = @CurIsOn,
            @NewLevel = @CurLevel;
    END
    ELSE
    BEGIN
        SELECT
            @NewMode = CASE
                WHEN @Source = 'AUTO' THEN 'AUTO'
                ELSE ISNULL(@Mode, 'MANUAL')
            END,
            @NewIsOn = @IsOn,
            @NewLevel = CASE
                WHEN @Level IS NULL THEN @CurLevel
                ELSE @Level
            END;

        IF @NewMode <> @CurMode
           OR @NewIsOn <> @CurIsOn
           OR ISNULL(CAST(@NewLevel AS INT), -1)
              <> ISNULL(CAST(@CurLevel AS INT), -1)
            SET @Changed = 1;
    END

    IF @Changed = 1
    BEGIN
        UPDATE dbo.Devices
        SET Mode = @NewMode,
            IsOn = @NewIsOn,
            Level = @NewLevel
        WHERE DeviceId = @DeviceId;

        INSERT dbo.ControlLogs
            (DeviceId, UserId, Source, Mode, IsOn, Level, Reason)
        VALUES
            (@DeviceId,
             CASE WHEN @Source = 'AUTO' THEN NULL ELSE @UserId END,
             @Source, @NewMode, @NewIsOn, @NewLevel, @Reason);
    END

    COMMIT;

    SELECT
        Changed = @Changed,
        DeviceCode = @Code,
        Mode = @NewMode,
        IsOn = @NewIsOn,
        Level = @NewLevel;
END
GO
