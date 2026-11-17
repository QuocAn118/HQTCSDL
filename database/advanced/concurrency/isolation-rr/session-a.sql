USE SwiftletCare_Perf;
GO
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
DECLARE @v1 decimal(10,2), @v2 decimal(10,2);
BEGIN TRY
    BEGIN TRANSACTION;
    SELECT @v1 = TargetValue FROM dbo.Thresholds WHERE ZoneId = 2 AND MetricCode = 'TEMP';
    INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
    VALUES ('isolation-rr', 'A', 'v1', CONVERT(nvarchar(100), @v1));
    WAITFOR DELAY '00:00:05';
    SELECT @v2 = TargetValue FROM dbo.Thresholds WHERE ZoneId = 2 AND MetricCode = 'TEMP';
    INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
    VALUES ('isolation-rr', 'A', 'v2', CONVERT(nvarchar(100), @v2));
    -- Ghi moc A xong truoc COMMIT; B van bi chan boi shared lock cua A.
    INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
    VALUES ('isolation-rr', 'A', 'xong', 'COMMIT');
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
