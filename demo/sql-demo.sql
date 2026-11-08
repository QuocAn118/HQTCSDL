-- Phan CSDL cua demo (moc 3:30). Chi doc, khong tao doi tuong nao. Chay bang demo\run-sql.ps1 (SwiftletCare_Dev).
-- Gio luu UTC (DATETIME2(0)); cot GioVN = UTC + 7 chi de doc.
SET NOCOUNT ON;
DECLARE @t0 DATETIME2(7);

-- 1. Vong dieu khien tu dong ghi lai "ai, khi nao, vi sao": sp_SetActuator ghi ControlLogs kem ly do
--    (quat H1-F2 tu bat "TEMP ... > Max 30", dieu khien tay 50% co UserId, tra ve AUTO).
SET @t0 = SYSDATETIME();
SELECT TOP (8)
    GioVN  = CONVERT(CHAR(19), DATEADD(HOUR, 7, l.CreatedAt), 120),
    ThietBi = d.Code,
    NguonLenh = l.Source,
    CheDo  = l.Mode,
    Bat    = l.IsOn,
    MucQuat = l.Level,
    NguoiDung = u.Username,
    LyDo   = l.Reason
FROM dbo.ControlLogs l
JOIN dbo.Devices d ON d.DeviceId = l.DeviceId
JOIN dbo.Zones z ON z.ZoneId = d.ZoneId
LEFT JOIN dbo.Users u ON u.UserId = l.UserId
WHERE z.HouseId = 1
ORDER BY l.LogId DESC;
PRINT CONCAT(N'Truy van 1 (ControlLogs): ', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), N' ms');

-- 2. Vong doi canh bao do TRIGGER trg_Alerts_History ghi: moi lan doi trang thai (NEW -> ACK -> RESOLVED)
--    la mot dong AlertHistory, ke ca khi sp_IngestReadings tu dong dong canh bao nguong (UserId NULL).
SET @t0 = SYSDATETIME();
SELECT TOP (10)
    GioVN   = CONVERT(CHAR(19), DATEADD(HOUR, 7, h.ChangedAt), 120),
    CanhBao = a.AlertId,
    Loai    = a.AlertType,
    ChiTiet = COALESCE(a.DetectedClass, a.MetricCode),
    TuTrangThai = h.OldStatus,
    SangTrangThai = h.NewStatus,
    NguoiDung = COALESCE(u.Username, N'(he thong)'),
    GhiChu  = h.Note
FROM dbo.AlertHistory h
JOIN dbo.Alerts a ON a.AlertId = h.AlertId
LEFT JOIN dbo.Users u ON u.UserId = h.UserId
WHERE a.HouseId = 1
ORDER BY h.HistoryId DESC;
PRINT CONCAT(N'Truy van 2 (AlertHistory): ', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), N' ms');
