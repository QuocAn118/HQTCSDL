
CREATE OR ALTER TRIGGER dbo.trg_Devices_Status
ON dbo.Devices
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Chi xu ly khi UPDATE co cot Status
    IF NOT UPDATE(Status)
        RETURN;

    -- ONLINE -> OFFLINE / ERROR: tao canh bao
    INSERT dbo.Alerts (
        HouseId,
        ZoneId,
        DeviceId,
        AlertType,
        Severity,
        Message
    )
    SELECT
        z.HouseId,
        i.ZoneId,
        i.DeviceId,
        'DEVICE_OFFLINE',
        CASE
            WHEN i.Status = 'ERROR' THEN 'CRITICAL'
            ELSE 'WARNING'
        END,
        CONCAT(
            N'Thiết bị ',
            i.Code,
            CASE
                WHEN i.Status = 'ERROR' THEN N' báo lỗi'
                ELSE N' mất kết nối'
            END
        )
    FROM inserted i
    JOIN deleted d
        ON d.DeviceId = i.DeviceId
    JOIN dbo.Zones z
        ON z.ZoneId = i.ZoneId
    WHERE d.Status = 'ONLINE'
      AND i.Status IN ('OFFLINE', 'ERROR')
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.Alerts a
          WHERE a.DeviceId = i.DeviceId
            AND a.AlertType = 'DEVICE_OFFLINE'
            AND a.Status <> 'RESOLVED'
      );

    -- OFFLINE / ERROR -> ONLINE: tu dong dong canh bao
    UPDATE a
    SET
        Status = 'RESOLVED',
        ResolvedAt = SYSUTCDATETIME(),
        ResolvedBy = NULL
    FROM dbo.Alerts a
    JOIN inserted i
        ON i.DeviceId = a.DeviceId
    JOIN deleted d
        ON d.DeviceId = i.DeviceId
    WHERE d.Status <> 'ONLINE'
      AND i.Status = 'ONLINE'
      AND a.AlertType = 'DEVICE_OFFLINE'
      AND a.Status <> 'RESOLVED';
END
GO
