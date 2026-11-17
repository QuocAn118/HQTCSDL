USE SwiftletCare_Perf;
GO
SET NOCOUNT ON;
DECLARE @v1 decimal(10,2), @v2 decimal(10,2), @a int, @b int, @final decimal(10,2);
SELECT @v1 = TRY_CONVERT(decimal(10,2), Val) FROM dbo.DemoLog WHERE Scenario='isolation-rr' AND Sess='A' AND Step='v1';
SELECT @v2 = TRY_CONVERT(decimal(10,2), Val) FROM dbo.DemoLog WHERE Scenario='isolation-rr' AND Sess='A' AND Step='v2';
SELECT @a = Id FROM dbo.DemoLog WHERE Scenario='isolation-rr' AND Sess='A' AND Step='xong';
SELECT @b = Id FROM dbo.DemoLog WHERE Scenario='isolation-rr' AND Sess='B' AND Step='xong';
SELECT @final = TargetValue FROM dbo.Thresholds WHERE ZoneId=2 AND MetricCode='TEMP';
IF @v1 <> 28.00 OR @v2 <> 28.00 THROW 52010, 'REPEATABLE READ expected v1=v2=28.', 1;
IF @a IS NULL OR @b IS NULL OR @a >= @b THROW 52011, 'Expected Session A xong before Session B.', 1;
IF @final <> 29.00 THROW 52012, 'Expected final TargetValue=29.', 1;
SELECT 'PASS' AS Result, @v1 AS v1, @v2 AS v2, @a AS SessionA_xong_Id, @b AS SessionB_xong_Id, @final AS FinalTargetValue;
GO
