
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE #r (
    ZoneId INT,
    ZoneName NVARCHAR(50),
    MonthVn CHAR(7),
    AvgTemp DECIMAL(9, 2),
    StdevTemp DECIMAL(9, 2),
    AvgHumid DECIMAL(9, 2),
    StdevHumid DECIMAL(9, 2),
    PctInRange DECIMAL(5, 2),
    NestCount INT,
    WeightGram DECIMAL(9, 1)
);
GO

PRINT N'report: du lieu mau H1 thang 10/2026';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @h1 INT = (
        SELECT HouseId
        FROM dbo.Houses
        WHERE Name = N'H1'
    );

    INSERT #r
    EXEC dbo.sp_Report_EnvStabilityVsYield
        @HouseId = @h1,
        @FromVnDate = '2026-08-01',
        @ToVnDate = '2026-11-01';

    -- F1 thang 10 phai co du lieu moi truong va thu hoach
    IF NOT EXISTS (
        SELECT 1
        FROM #r
        WHERE ZoneName = N'F1'
          AND MonthVn = '2026-10'
          AND AvgTemp BETWEEN 26 AND 30
          AND NestCount > 0
    )
        THROW 59999, N'report: thieu dong F1 thang 10', 1;

    -- Thang 8 chi co du lieu thu hoach, van phai co dong
    IF NOT EXISTS (
        SELECT 1
        FROM #r
        WHERE ZoneName = N'F1'
          AND MonthVn = '2026-08'
          AND NestCount > 0
          AND AvgTemp IS NULL
    )
        THROW 59999, N'report: thang 8 phai co dong thu hoach', 1;

    -- Ty le moi truong dat chuan phai tu 0 den 100
    IF EXISTS (
        SELECT 1
        FROM #r
        WHERE PctInRange < 0
           OR PctInRange > 100
    )
        THROW 59999, N'report: PctInRange phai trong [0,100]', 1;

    -- F2 co giai doan nhiet do vuot nguong
    IF (
        SELECT PctInRange
        FROM #r
        WHERE ZoneName = N'F2'
          AND MonthVn = '2026-10'
    ) >= 100
        THROW 59999, N'report: F2 phai co PctInRange < 100', 1;

    ROLLBACK;

    PRINT N'report: du lieu mau PASS';

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'report: kiem tra khoang ngay khong hop le';

BEGIN TRY
    BEGIN TRAN;

    EXEC dbo.sp_Report_EnvStabilityVsYield
        @HouseId = 1,
        @FromVnDate = '2026-10-31',
        @ToVnDate = '2026-08-01';

    THROW 59999, N'Mong doi loi 50041', 1;

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50041 THROW;
END CATCH
GO

PRINT N'report: kiem tra rang buoc Grade';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @z INT = (
        SELECT TOP (1) ZoneId
        FROM dbo.Zones
    );

    DECLARE @u INT = (
        SELECT UserId
        FROM dbo.Users
        WHERE Username = 'owner1'
    );

    INSERT dbo.Harvests (
        ZoneId,
        HarvestDate,
        NestCount,
        WeightGram,
        Grade,
        RecordedBy
    )
    VALUES (
        @z,
        '2026-01-01',
        1,
        10,
        'D',
        @u
    );

    THROW 59999, N'Grade D phai bi tu choi', 1;

END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 547 THROW;
END CATCH
GO

PRINT N'sp_Report_EnvStabilityVsYield: PASS';
GO
