
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

PRINT N'nestlogs: kiem tra ngay thu Hai hop le';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @z INT = (
        SELECT TOP (1) ZoneId
        FROM dbo.Zones
    );

    INSERT dbo.NestLogs
        (ZoneId, WeekStart, ActiveNests, NewNests, Note)
    VALUES
        (@z, '2026-10-05', 120, 4, N'Tuan dau thang');

    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'nestlogs: ngay khong phai thu Hai phai bi tu choi';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @z INT = (
        SELECT TOP (1) ZoneId
        FROM dbo.Zones
    );

    INSERT dbo.NestLogs
        (ZoneId, WeekStart, ActiveNests, NewNests)
    VALUES
        (@z, '2026-10-06', 1, 0);

    THROW 59999, N'Mong doi loi 547', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 547 THROW;
END CATCH
GO

PRINT N'nestlogs: so luong to yen am phai bi tu choi';

BEGIN TRY
    BEGIN TRAN;

    DECLARE @z INT = (
        SELECT TOP (1) ZoneId
        FROM dbo.Zones
    );

    INSERT dbo.NestLogs
        (ZoneId, WeekStart, ActiveNests, NewNests)
    VALUES
        (@z, '2026-10-05', -1, 0);

    THROW 59999, N'Mong doi loi 547', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 547 THROW;
END CATCH
GO

PRINT N'nestlogs: PASS';
GO
