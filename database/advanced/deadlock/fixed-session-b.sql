USE SwiftletCare_Perf;
GO
SET NOCOUNT ON;

BEGIN TRANSACTION;

UPDATE dbo.DeadlockDemoRows
SET Value = Value + 1
WHERE Id = 1;

WAITFOR DELAY '00:00:02';

UPDATE dbo.DeadlockDemoRows
SET Value = Value + 1
WHERE Id = 2;

COMMIT TRANSACTION;
PRINT 'Session B committed using order 1 -> 2.';
GO
