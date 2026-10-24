
CREATE OR ALTER PROCEDURE dbo.sp_RecordHeartbeat
    @Json NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Kiem tra JSON dau vao phai la mang
    IF @Json IS NULL OR ISJSON(@Json) = 0
       OR LEFT(
           LTRIM(
               REPLACE(
                   REPLACE(
                       REPLACE(@Json, NCHAR(13), N''),
                       NCHAR(10), N''
                   ),
                   NCHAR(9), N''
               )
           ), 1
       ) <> N'['
        THROW 50030, N'Chuoi JSON khong hop le (can mot mang).', 1;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

    CREATE TABLE #In (
        DeviceCode NVARCHAR(200) NULL,
        AtText NVARCHAR(100) NULL,
        At DATETIME2(0) NULL,
        DeviceId INT NULL
    );

    -- Doc danh sach heartbeat tu JSON
    INSERT #In (DeviceCode, AtText)
    SELECT x.device, x.at
    FROM OPENJSON(@Json) j
    OUTER APPLY (
        SELECT *
        FROM OPENJSON(
            CASE WHEN j.[type] = 5 THEN j.[value] END
        )
        WITH (
            device NVARCHAR(200) '$.device',
            at NVARCHAR(100) '$.at'
        )
    ) x;

    -- Chuyen thoi gian ISO UTC thanh DATETIME2
    UPDATE #In
    SET At = CASE
        WHEN AtText LIKE N'%Z'
        THEN CAST(
            DATEADD(
                MILLISECOND,
                -DATEPART(
                    MILLISECOND,
                    TRY_CONVERT(DATETIME2(3), AtText, 127)
                ),
                TRY_CONVERT(DATETIME2(3), AtText, 127)
            ) AS DATETIME2(0)
        )
    END;

    -- Chi chap nhan thiet bi dang hoat dong
    -- va thoi gian khong qua 5 phut trong tuong lai
    UPDATE i
    SET DeviceId = d.DeviceId
    FROM #In i
    JOIN dbo.Devices d
        ON d.Code = i.DeviceCode
       AND d.IsActive = 1
    WHERE i.At IS NOT NULL
      AND i.At <= DATEADD(MINUTE, 5, @Now);

    -- He thong tu dong thao tac, khong gan nguoi dung
    EXEC sys.sp_set_session_context
        @key = N'UserId', @value = NULL;

    EXEC sys.sp_set_session_context
        @key = N'Note', @value = NULL;

    BEGIN TRAN;

    -- Cap nhat thoi gian nhin thay thiet bi gan nhat
    UPDATE d
    SET LastSeenAt = CASE
        WHEN d.LastSeenAt IS NULL
          OR x.MaxAt > d.LastSeenAt
        THEN x.MaxAt
        ELSE d.LastSeenAt
    END
    FROM dbo.Devices d
    JOIN (
        SELECT DeviceId, MaxAt = MAX(At)
        FROM #In
        WHERE DeviceId IS NOT NULL
        GROUP BY DeviceId
    ) x ON x.DeviceId = d.DeviceId;

    -- Luu cac canh bao mat ket noi dang mo
    DECLARE @OfflineOpen TABLE (
        AlertId INT NOT NULL
    );

    DECLARE @Resolved TABLE (
        AlertId INT NOT NULL
    );

    INSERT @OfflineOpen (AlertId)
    SELECT a.AlertId
    FROM dbo.Alerts a WITH (UPDLOCK, HOLDLOCK)
    WHERE a.AlertType = 'DEVICE_OFFLINE'
      AND a.Status <> 'RESOLVED'
      AND a.DeviceId IN (
          SELECT DeviceId
          FROM #In
          WHERE DeviceId IS NOT NULL
      );

    -- Co heartbeat hop le thi chuyen thiet bi ve ONLINE
    UPDATE dbo.Devices
    SET Status = 'ONLINE'
    WHERE Status <> 'ONLINE'
      AND DeviceId IN (
          SELECT DeviceId
          FROM #In
          WHERE DeviceId IS NOT NULL
      );

    -- Trigger tu dong dong canh bao DEVICE_OFFLINE
    -- Lay cac AlertId da duoc dong
    INSERT @Resolved (AlertId)
    SELECT a.AlertId
    FROM dbo.Alerts a
    JOIN @OfflineOpen o
        ON o.AlertId = a.AlertId
    WHERE a.Status = 'RESOLVED';

    COMMIT;

    -- Tra ket qua cho backend
    SELECT
        Accepted = (
            SELECT COUNT(*)
            FROM #In
            WHERE DeviceId IS NOT NULL
        ),
        Rejected = (
            SELECT COUNT(*)
            FROM #In
            WHERE DeviceId IS NULL
        ),
        ResolvedAlertIdsJson = ISNULL((
            SELECT AlertId
            FROM @Resolved
            ORDER BY AlertId
            FOR JSON PATH, INCLUDE_NULL_VALUES
        ), N'[]');
END
GO
