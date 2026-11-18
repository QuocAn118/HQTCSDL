USE SwiftletCare_Perf;
GO

IF OBJECT_ID('dbo.DeadlockDemoRows', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DeadlockDemoRows
    (
        Id int NOT NULL CONSTRAINT PK_DeadlockDemoRows PRIMARY KEY,
        Value int NOT NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.DeadlockDemoRows WHERE Id = 1)
    INSERT dbo.DeadlockDemoRows(Id, Value) VALUES (1, 0);

IF NOT EXISTS (SELECT 1 FROM dbo.DeadlockDemoRows WHERE Id = 2)
    INSERT dbo.DeadlockDemoRows(Id, Value) VALUES (2, 0);
GO

CREATE OR ALTER PROCEDURE dbo.sp_DemoDeadlockRetry
    @FirstId int,
    @SecondId int,
    @MaxRetries int = 3
AS
BEGIN
    SET NOCOUNT ON;

    IF @FirstId NOT IN (1, 2)
       OR @SecondId NOT IN (1, 2)
       OR @FirstId = @SecondId
        THROW 51001, 'Invalid demo row order.', 1;

    DECLARE @Attempt int = 0;
    DECLARE @Done bit = 0;

    WHILE @Done = 0
    BEGIN
        SET @Attempt += 1;

        BEGIN TRY
            BEGIN TRANSACTION;

            UPDATE dbo.DeadlockDemoRows
            SET Value = Value + 1
            WHERE Id = @FirstId;

            WAITFOR DELAY '00:00:02';

            UPDATE dbo.DeadlockDemoRows
            SET Value = Value + 1
            WHERE Id = @SecondId;

            COMMIT TRANSACTION;
            SET @Done = 1;

            PRINT CONCAT('Transaction completed. Attempts: ', @Attempt);
        END TRY
        BEGIN CATCH
            DECLARE @ErrorNumber int = ERROR_NUMBER();

            IF XACT_STATE() <> 0
                ROLLBACK TRANSACTION;

            IF @ErrorNumber = 1205 AND @Attempt <= @MaxRetries
            BEGIN
                PRINT CONCAT('Deadlock victim. Retrying attempt ', @Attempt, '...');
                WAITFOR DELAY '00:00:01';
            END
            ELSE
                THROW;
        END CATCH;
    END;
END;
GO

SELECT Id, Value
FROM dbo.DeadlockDemoRows
ORDER BY Id;
GO
