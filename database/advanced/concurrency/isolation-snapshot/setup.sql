USE SwiftletCare_Perf;
GO
SET NOCOUNT ON;
IF RIGHT(DB_NAME(), 5) <> '_Perf'
    THROW 52000, 'Task 7 chi duoc chay tren database co hau to _Perf.', 1;
IF (SELECT COUNT(*) FROM dbo.Thresholds WHERE ZoneId = 2 AND MetricCode = 'TEMP') <> 1
    THROW 52001, 'Khong tim thay duy nhat threshold TEMP cua H1-F1 (ZoneId=2).', 1;
ALTER DATABASE CURRENT SET ALLOW_SNAPSHOT_ISOLATION ON;
DELETE dbo.DemoLog WHERE Scenario = 'isolation-snapshot';
UPDATE dbo.Thresholds SET TargetValue = 28.00, UpdatedAt = SYSUTCDATETIME()
WHERE ZoneId = 2 AND MetricCode = 'TEMP';
PRINT 'isolation-snapshot setup PASS: SNAPSHOT enabled; H1-F1 TEMP = 28.00';
GO
