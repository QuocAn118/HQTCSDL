USE SwiftletCare_Perf;
GO
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL SNAPSHOT;
DECLARE @v1 decimal(10,2), @v2 decimal(10,2), @err int = NULL;
BEGIN TRY
    BEGIN TRANSACTION;
    SELECT @v1 = TargetValue FROM dbo.Thresholds WHERE ZoneId = 2 AND MetricCode = 'TEMP';
    WAITFOR DELAY '00:00:05';
    SELECT @v2 = TargetValue FROM dbo.Thresholds WHERE ZoneId = 2 AND MetricCode = 'TEMP';

    BEGIN TRY
        UPDATE dbo.Thresholds
        SET TargetValue = 30.00, UpdatedAt = SYSUTCDATETIME()
        WHERE ZoneId = 2 AND MetricCode = 'TEMP';
    END TRY
    BEGIN CATCH
        SET @err = ERROR_NUMBER();
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    END CATCH;

    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;

    -- Ghi log sau rollback de giu lai bang chung loi 3960 va hai gia tri da doc.
    INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
    VALUES ('isolation-snapshot', 'A', 'v1', CONVERT(nvarchar(100), @v1)),
           ('isolation-snapshot', 'A', 'v2', CONVERT(nvarchar(100), @v2)),
           ('isolation-snapshot', 'A', 'update', COALESCE(CONVERT(nvarchar(100), @err), 'NO_ERROR')),
           ('isolation-snapshot', 'A', 'xong', 'ROLLBACK');
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
