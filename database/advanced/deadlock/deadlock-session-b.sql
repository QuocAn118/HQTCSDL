USE SwiftletCare_Perf;
GO
SET NOCOUNT ON;
SET DEADLOCK_PRIORITY NORMAL;

BEGIN TRY
    BEGIN TRANSACTION;

    UPDATE dbo.DeadlockDemoRows
    SET Value = Value + 1
    WHERE Id = 2;

    PRINT 'Session B locked row 2.';
    WAITFOR DELAY '00:00:03';

    UPDATE dbo.DeadlockDemoRows
    SET Value = Value + 1
    WHERE Id = 1;

    COMMIT TRANSACTION;
    PRINT 'Session B committed.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
GO
