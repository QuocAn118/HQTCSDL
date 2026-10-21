
CREATE OR ALTER PROCEDURE dbo.sp_DetectAnomalies
    @OfflineMinutes INT = 5,
    @DropPercent INT = 20,
    @CutoffHourVn INT = 20,
    @NowUtc DATETIME2(0) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @DropPercent IS NULL OR @DropPercent <= 0
       OR @DropPercent >= 100
       OR @CutoffHourVn IS NULL OR @CutoffHourVn < 0
       OR @CutoffHourVn > 23
       OR @OfflineMinutes IS NULL OR @OfflineMinutes <= 0
        THROW 50042, N'Tham so ngoai mien.', 1;

    SET @NowUtc = ISNULL(@NowUtc, SYSUTCDATETIME());

    DECLARE @NowVn DATETIME2(0) =
        CAST(
            @NowUtc AT TIME ZONE 'UTC'
            AT TIME ZONE 'SE Asia Standard Time'
            AS DATETIME2(0)
        );

    DECLARE @TodayVn DATE = CAST(@NowVn AS DATE);

    DECLARE @TodayStartUtc DATETIME2(0) =
        CAST(
            CAST(@TodayVn AS DATETIME2(0))
            AT TIME ZONE 'SE Asia Standard Time'
            AT TIME ZONE 'UTC'
            AS DATETIME2(0)
        );

    DECLARE @New TABLE (AlertId INT NOT NULL);

    EXEC sys.sp_set_session_context
        @key = N'UserId', @value = NULL;

    EXEC sys.sp_set_session_context
        @key = N'Note', @value = NULL;

    BEGIN TRAN;

    -- Phat hien giam dan sau gio chot
    IF DATEPART(HOUR, @NowVn) >= @CutoffHourVn
    BEGIN
        CREATE TABLE #Days (
            n INT NOT NULL,
            FromUtc DATETIME2(0) NOT NULL,
            ToUtc DATETIME2(0) NOT NULL
        );

        INSERT #Days (n, FromUtc, ToUtc)
        SELECT
            v.n,
            DATEADD(DAY, -v.n, @TodayStartUtc),
            DATEADD(
                HOUR,
                @CutoffHourVn,
                DATEADD(DAY, -v.n, @TodayStartUtc)
            )
        FROM (
            VALUES (0),(1),(2),(3),(4),(5),(6),(7)
        ) v(n);

        CREATE TABLE #PerDay (
            HouseId INT NOT NULL,
            n INT NOT NULL,
            Total INT NOT NULL
        );

        INSERT #PerDay (HouseId, n, Total)
        SELECT
            z.HouseId,
            dd.n,
            SUM(b.InCount)
        FROM #Days dd
        JOIN dbo.BirdCounts b
            ON b.WindowStart >= dd.FromUtc
           AND b.WindowStart < dd.ToUtc
        JOIN dbo.Devices d
            ON d.DeviceId = b.CameraId
        JOIN dbo.Zones z
            ON z.ZoneId = d.ZoneId
        JOIN dbo.Houses h
            ON h.HouseId = z.HouseId
           AND h.IsActive = 1
        GROUP BY z.HouseId, dd.n;

        INSERT dbo.Alerts (
            HouseId,
            AlertType,
            Severity,
            Message,
            CreatedAt
        )
        OUTPUT inserted.AlertId INTO @New (AlertId)
        SELECT
            s.HouseId,
            'POPULATION_DROP',
            'CRITICAL',
            CONCAT(
                N'Số chim về hôm nay (',
                s.TodayTotal,
                N') thấp hơn trung bình 7 ngày (',
                CAST(s.AvgPrev AS INT),
                N') quá ',
                @DropPercent,
                N'%'
            ),
            @NowUtc
        FROM (
            SELECT
                p.HouseId,
                TodayTotal = ISNULL(
                    MAX(CASE WHEN p.n = 0 THEN p.Total END), 0
                ),
                AvgPrev = AVG(
                    CASE WHEN p.n > 0
                         THEN CAST(p.Total AS DECIMAL(18,2))
                    END
                ),
                PrevDays = COUNT(
                    CASE WHEN p.n > 0 THEN 1 END
                )
            FROM #PerDay p
            GROUP BY p.HouseId
        ) s
        WHERE s.PrevDays >= 3
          AND s.AvgPrev > 0
          AND s.TodayTotal <
              s.AvgPrev * (100 - @DropPercent) / 100.0
          AND NOT EXISTS (
              SELECT 1
              FROM dbo.Alerts a WITH (UPDLOCK, HOLDLOCK)
              WHERE a.HouseId = s.HouseId
                AND a.AlertType = 'POPULATION_DROP'
                AND a.CreatedAt >= @TodayStartUtc
                AND a.CreatedAt <
                    DATEADD(DAY, 1, @TodayStartUtc)
          );
    END;

    -- Chuc nang OFFLINE se bo sung o Task 15

    COMMIT;

    SELECT NewAlertsJson = ISNULL((
        SELECT v.*
        FROM dbo.vw_AlertJson v
        JOIN @New n ON n.AlertId = v.AlertId
        ORDER BY v.AlertId
        FOR JSON PATH, INCLUDE_NULL_VALUES
    ), N'[]');
END
GO
