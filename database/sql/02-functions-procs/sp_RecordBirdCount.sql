
CREATE OR ALTER PROCEDURE dbo.sp_RecordBirdCount
    @Json NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Json IS NULL OR ISJSON(@Json) = 0
       OR LEFT(LTRIM(REPLACE(REPLACE(REPLACE(
           @Json, NCHAR(13), N''), NCHAR(10), N''), NCHAR(9), N'')), 1) <> N'['
        THROW 50030, N'Chuoi JSON khong hop le (can mot mang).', 1;

    CREATE TABLE #In (
        CameraCode  NVARCHAR(200) NULL,
        WindowText  NVARCHAR(100) NULL,
        InText      NVARCHAR(50) NULL,
        OutText     NVARCHAR(50) NULL,
        IsObject    BIT NOT NULL,
        WindowStart DATETIME2(3) NULL,
        InCount     INT NULL,
        OutCount    INT NULL,
        CameraId    INT NULL
    );

    INSERT #In (CameraCode, WindowText, InText, OutText, IsObject)
    SELECT
        x.camera,
        x.windowStart,
        x.[in],
        x.[out],
        CASE WHEN j.[type] = 5 THEN 1 ELSE 0 END
    FROM OPENJSON(@Json) j
    OUTER APPLY (
        SELECT *
        FROM OPENJSON(
            CASE WHEN j.[type] = 5 THEN j.[value] END
        )
        WITH (
            camera NVARCHAR(200) '$.camera',
            windowStart NVARCHAR(100) '$.windowStart',
            [in] NVARCHAR(50) '$.in',
            [out] NVARCHAR(50) '$.out'
        )
    ) x;

    UPDATE #In
    SET
        WindowStart = CASE
            WHEN WindowText LIKE N'%Z'
            THEN TRY_CONVERT(DATETIME2(3), WindowText, 127)
        END,
        InCount = TRY_CONVERT(INT, InText),
        OutCount = TRY_CONVERT(INT, OutText);

    UPDATE i
    SET CameraId = d.DeviceId
    FROM #In i
    JOIN dbo.Devices d
        ON d.Code = i.CameraCode
       AND d.DeviceType = 'CAMERA'
       AND d.IsActive = 1;

    IF EXISTS (
        SELECT 1 FROM #In
        WHERE IsObject = 0
           OR CameraCode IS NULL
           OR WindowStart IS NULL
           OR InCount IS NULL
           OR OutCount IS NULL
    )
        THROW 50042, N'Du lieu thieu truong hoac sai kieu.', 1;

    IF EXISTS (SELECT 1 FROM #In WHERE CameraId IS NULL)
        THROW 50010, N'Camera khong hop le.', 1;

    IF EXISTS (
        SELECT 1 FROM #In
        WHERE InCount < 0 OR OutCount < 0
    )
        THROW 50012, N'So chim khong duoc am.', 1;

    IF EXISTS (
        SELECT 1 FROM #In
        WHERE DATEPART(MINUTE, WindowStart) % 5 <> 0
           OR DATEPART(SECOND, WindowStart) <> 0
           OR DATEPART(MILLISECOND, WindowStart) <> 0
    )
        THROW 50014, N'Phai dung moc 5 phut.', 1;

    CREATE TABLE #Agg (
        CameraId INT NOT NULL,
        WindowStart DATETIME2(0) NOT NULL,
        InCount INT NOT NULL,
        OutCount INT NOT NULL,
        HasRow BIT NOT NULL DEFAULT 0,
        OldIn INT NULL,
        OldOut INT NULL
    );

    INSERT #Agg (CameraId, WindowStart, InCount, OutCount)
    SELECT
        CameraId,
        CAST(WindowStart AS DATETIME2(0)),
        MAX(InCount),
        MAX(OutCount)
    FROM #In
    GROUP BY CameraId, CAST(WindowStart AS DATETIME2(0));

    BEGIN TRAN;

    UPDATE a
    SET
        HasRow = 1,
        OldIn = b.InCount,
        OldOut = b.OutCount
    FROM #Agg a
    JOIN dbo.BirdCounts b WITH (UPDLOCK, SERIALIZABLE)
        ON b.CameraId = a.CameraId
       AND b.WindowStart = a.WindowStart;

    INSERT dbo.BirdCounts
        (CameraId, WindowStart, InCount, OutCount)
    SELECT CameraId, WindowStart, InCount, OutCount
    FROM #Agg
    WHERE HasRow = 0;

    UPDATE b
    SET
        InCount = CASE
            WHEN a.InCount > b.InCount
            THEN a.InCount ELSE b.InCount
        END,
        OutCount = CASE
            WHEN a.OutCount > b.OutCount
            THEN a.OutCount ELSE b.OutCount
        END
    FROM dbo.BirdCounts b
    JOIN #Agg a
        ON a.CameraId = b.CameraId
       AND a.WindowStart = b.WindowStart
    WHERE a.HasRow = 1
      AND (
          a.InCount > a.OldIn
          OR a.OutCount > a.OldOut
      );

    COMMIT;

    SELECT
        WindowsUpserted = (
            SELECT COUNT(*)
            FROM #Agg
            WHERE HasRow = 0
               OR InCount > OldIn
               OR OutCount > OldOut
        ),
        WindowsUnchanged = (
            SELECT COUNT(*)
            FROM #Agg
            WHERE HasRow = 1
              AND InCount <= OldIn
              AND OutCount <= OldOut
        );
END
GO
