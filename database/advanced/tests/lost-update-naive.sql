USE SwiftletCare_Perf;
GO
EXEC dbo.demo_LostUpdate_Naive
    @DeviceId = 3,
    @Delta = 10;
GO
