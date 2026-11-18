USE SwiftletCare_Perf;
GO
EXEC dbo.sp_DemoDeadlockRetry
    @FirstId = 1,
    @SecondId = 2,
    @MaxRetries = 3;
GO
