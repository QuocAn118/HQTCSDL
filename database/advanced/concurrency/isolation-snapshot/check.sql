USE SwiftletCare_Perf;
GO
SET NOCOUNT ON;
DECLARE @v1 decimal(10,2), @v2 decimal(10,2), @err int, @a int, @b int, @final decimal(10,2);
SELECT @v1 = TRY_CONVERT(decimal(10,2), Val) FROM dbo.DemoLog WHERE Scenario='isolation-snapshot' AND Sess='A' AND Step='v1';
SELECT @v2 = TRY_CONVERT(decimal(10,2), Val) FROM dbo.DemoLog WHERE Scenario='isolation-snapshot' AND Sess='A' AND Step='v2';
SELECT @err = TRY_CONVERT(int, Val) FROM dbo.DemoLog WHERE Scenario='isolation-snapshot' AND Sess='A' AND Step='update';
SELECT @a = Id FROM dbo.DemoLog WHERE Scenario='isolation-snapshot' AND Sess='A' AND Step='xong';
SELECT @b = Id FROM dbo.DemoLog WHERE Scenario='isolation-snapshot' AND Sess='B' AND Step='xong';
SELECT @final = TargetValue FROM dbo.Thresholds WHERE ZoneId=2 AND MetricCode='TEMP';
IF @v1 <> 28.00 OR @v2 <> 28.00 THROW 52010, 'SNAPSHOT expected v1=v2=28.', 1;
IF @err <> 3960 THROW 52011, 'SNAPSHOT expected update conflict error 3960.', 1;
IF @a IS NULL OR @b IS NULL OR @b >= @a THROW 52012, 'Expected Session B xong before Session A.', 1;
IF @final <> 29.00 THROW 52013, 'Expected final TargetValue=29; Session A update must rollback.', 1;
SELECT 'PASS' AS Result, @v1 AS v1, @v2 AS v2, @err AS UpdateError, @b AS SessionB_xong_Id, @a AS SessionA_xong_Id, @final AS FinalTargetValue;
GO
