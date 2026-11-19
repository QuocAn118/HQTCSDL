USE SwiftletCare_Perf;
GO
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
DECLARE @v1 decimal(10,2), @v2 decimal(10,2);
BEGIN TRY
    BEGIN TRANSACTION;
    SELECT @v1 = TargetValue FROM dbo.Thresholds WHERE ZoneId = 2 AND MetricCode = 'TEMP';
    INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
    VALUES ('isolation-rc', 'A', 'v1', CONVERT(nvarchar(100), @v1));
    WAITFOR DELAY '00:00:05';
    SELECT @v2 = TargetValue FROM dbo.Thresholds WHERE ZoneId = 2 AND MetricCode = 'TEMP';
    INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
    VALUES ('isolation-rc', 'A', 'v2', CONVERT(nvarchar(100), @v2));
    INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
    VALUES ('isolation-rc', 'A', 'xong', 'COMMIT');
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
