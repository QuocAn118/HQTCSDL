
CREATE OR ALTER PROCEDURE dbo.sp_UpdateAlertStatus
    @AlertId INT,
    @Status VARCHAR(10),
    @UserId INT,
    @Note NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @UserId IS NULL
        THROW 50042, N'@UserId bat buoc.', 1;

    DECLARE @Cur VARCHAR(10);

    BEGIN TRY
        EXEC sys.sp_set_session_context
            @key = N'UserId',
            @value = @UserId;

        EXEC sys.sp_set_session_context
            @key = N'Note',
            @value = @Note;

        BEGIN TRAN;

        SELECT @Cur = Status
        FROM dbo.Alerts WITH (UPDLOCK, ROWLOCK)
        WHERE AlertId = @AlertId;

        IF @Cur IS NULL
            THROW 50020, N'Canh bao khong ton tai.', 1;

        IF NOT (
            (@Cur = 'NEW' AND @Status IN ('ACK', 'RESOLVED'))
            OR
            (@Cur = 'ACK' AND @Status = 'RESOLVED')
        )
            THROW 50021, N'Chuyen trang thai canh bao khong hop le.', 1;

        UPDATE dbo.Alerts
        SET
            Status = @Status,
            ResolvedAt = CASE
                WHEN @Status = 'RESOLVED'
                THEN SYSUTCDATETIME()
            END,
            ResolvedBy = CASE
                WHEN @Status = 'RESOLVED'
                THEN @UserId
            END
        WHERE AlertId = @AlertId;

        COMMIT;

        -- Xoa thong tin session de tranh anh huong ket noi sau.
        EXEC sys.sp_set_session_context
            @key = N'UserId',
            @value = NULL;

        EXEC sys.sp_set_session_context
            @key = N'Note',
            @value = NULL;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK;

        EXEC sys.sp_set_session_context
            @key = N'UserId',
            @value = NULL;

        EXEC sys.sp_set_session_context
            @key = N'Note',
            @value = NULL;

        THROW;
    END CATCH;

    SELECT
        AlertId,
        HouseId,
        ZoneId,
        AlertType,
        Status,
        ResolvedAt,
        ResolvedBy
    FROM dbo.Alerts
    WHERE AlertId = @AlertId;
END
GO
