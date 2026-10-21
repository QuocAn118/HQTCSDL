
CREATE OR ALTER TRIGGER dbo.trg_Alerts_History
ON dbo.Alerts
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM inserted)
        RETURN;

    -- Lay thong tin nguoi thao tac tu SESSION_CONTEXT.
    -- NULL nghia la he thong tu dong xu ly.
    DECLARE @UserId INT =
        CAST(SESSION_CONTEXT(N'UserId') AS INT);

    DECLARE @Note NVARCHAR(500) =
        CAST(SESSION_CONTEXT(N'Note') AS NVARCHAR(500));

    -- Ghi lich su khi tao canh bao hoac thay doi trang thai.
    INSERT dbo.AlertHistory (
        AlertId,
        OldStatus,
        NewStatus,
        UserId,
        Note
    )
    SELECT
        i.AlertId,
        d.Status,
        i.Status,
        @UserId,
        @Note
    FROM inserted i
    LEFT JOIN deleted d
        ON d.AlertId = i.AlertId
    WHERE d.AlertId IS NULL
       OR d.Status <> i.Status;
END
GO
