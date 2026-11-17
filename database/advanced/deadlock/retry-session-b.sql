USE SwiftletCare_Perf;
GO
EXEC dbo.sp_DemoDeadlockRetry
    @FirstId = 2,
    @SecondId = 1,
    @MaxRetries = 3;
GO
