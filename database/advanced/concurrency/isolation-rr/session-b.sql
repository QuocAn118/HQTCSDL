USE SwiftletCare_Perf;
GO
SET NOCOUNT ON;
UPDATE dbo.Thresholds
SET TargetValue = 29.00, UpdatedAt = SYSUTCDATETIME()
WHERE ZoneId = 2 AND MetricCode = 'TEMP';
IF @@ROWCOUNT <> 1 THROW 52002, 'Session B khong cap nhat duoc H1-F1 TEMP.', 1;
INSERT dbo.DemoLog (Scenario, Sess, Step, Val)
VALUES ('isolation-rr', 'B', 'xong', 'TargetValue=29.00');
PRINT 'Session B completed';
GO
