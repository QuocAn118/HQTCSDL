BEGIN TRY

BEGIN TRAN;

-- ===== SQL viet tay: dua 12 cot thoi gian ve DATETIME2(0) (quy uoc spec database-core) =====
-- Prisma 7 khong ghi duoc @db.DateTime2(0) (P1012), nen cac cot do Prisma tao la DATETIME2(7).
-- ALTER COLUMN bi chan boi CHECK, DEFAULT, chi muc tren cot: xoa, doi kieu, tao lai dung ten va dinh nghia cu.
-- Gia tri cu duoc SQL Server LAM TRON ve giay (>= .5 len giay ke tiep).

-- 1. Xoa CHECK nhac toi cot
ALTER TABLE [dbo].[Alerts] DROP CONSTRAINT [CK_Alerts_Resolved];
ALTER TABLE [dbo].[BirdCounts] DROP CONSTRAINT [CK_BirdCounts_Window];

-- 2. Xoa DEFAULT sysutcdatetime()
ALTER TABLE [dbo].[Users] DROP CONSTRAINT [Users_CreatedAt_df];
ALTER TABLE [dbo].[Houses] DROP CONSTRAINT [Houses_CreatedAt_df];
ALTER TABLE [dbo].[Devices] DROP CONSTRAINT [Devices_CreatedAt_df];
ALTER TABLE [dbo].[Thresholds] DROP CONSTRAINT [Thresholds_UpdatedAt_df];
ALTER TABLE [dbo].[ControlLogs] DROP CONSTRAINT [ControlLogs_CreatedAt_df];
ALTER TABLE [dbo].[Alerts] DROP CONSTRAINT [Alerts_CreatedAt_df];
ALTER TABLE [dbo].[AlertHistory] DROP CONSTRAINT [AlertHistory_ChangedAt_df];
ALTER TABLE [dbo].[Harvests] DROP CONSTRAINT [Harvests_CreatedAt_df];

-- 3. Xoa chi muc va UNIQUE; chi muc CLUSTERED cua SensorReadings xoa sau cung
DROP INDEX [ControlLogs_DeviceId_CreatedAt_idx] ON [dbo].[ControlLogs];
DROP INDEX [Alerts_HouseId_Status_CreatedAt_idx] ON [dbo].[Alerts];
DROP INDEX [Alerts_DeviceId_AlertType_DetectedClass_CreatedAt_idx] ON [dbo].[Alerts];
ALTER TABLE [dbo].[BirdCounts] DROP CONSTRAINT [BirdCounts_CameraId_WindowStart_key];
ALTER TABLE [dbo].[SensorReadings] DROP CONSTRAINT [SensorReadings_DeviceId_MetricCode_RecordedAt_key];
DROP INDEX [SensorReadings_RecordedAt_idx] ON [dbo].[SensorReadings];

-- 4. Doi kieu, giu nguyen NULL / NOT NULL
ALTER TABLE [dbo].[Users] ALTER COLUMN [CreatedAt] DATETIME2(0) NOT NULL;
ALTER TABLE [dbo].[Houses] ALTER COLUMN [CreatedAt] DATETIME2(0) NOT NULL;
ALTER TABLE [dbo].[Devices] ALTER COLUMN [CreatedAt] DATETIME2(0) NOT NULL;
ALTER TABLE [dbo].[Devices] ALTER COLUMN [LastSeenAt] DATETIME2(0) NULL;
ALTER TABLE [dbo].[Thresholds] ALTER COLUMN [UpdatedAt] DATETIME2(0) NOT NULL;
ALTER TABLE [dbo].[SensorReadings] ALTER COLUMN [RecordedAt] DATETIME2(0) NOT NULL;
ALTER TABLE [dbo].[ControlLogs] ALTER COLUMN [CreatedAt] DATETIME2(0) NOT NULL;
ALTER TABLE [dbo].[Alerts] ALTER COLUMN [CreatedAt] DATETIME2(0) NOT NULL;
ALTER TABLE [dbo].[Alerts] ALTER COLUMN [ResolvedAt] DATETIME2(0) NULL;
ALTER TABLE [dbo].[AlertHistory] ALTER COLUMN [ChangedAt] DATETIME2(0) NOT NULL;
ALTER TABLE [dbo].[BirdCounts] ALTER COLUMN [WindowStart] DATETIME2(0) NOT NULL;
ALTER TABLE [dbo].[Harvests] ALTER COLUMN [CreatedAt] DATETIME2(0) NOT NULL;

-- 5. Tao lai chi muc: CLUSTERED truoc
CREATE CLUSTERED INDEX [SensorReadings_RecordedAt_idx] ON [dbo].[SensorReadings]([RecordedAt]);
ALTER TABLE [dbo].[SensorReadings] ADD CONSTRAINT [SensorReadings_DeviceId_MetricCode_RecordedAt_key] UNIQUE NONCLUSTERED ([DeviceId],[MetricCode],[RecordedAt]);
ALTER TABLE [dbo].[BirdCounts] ADD CONSTRAINT [BirdCounts_CameraId_WindowStart_key] UNIQUE NONCLUSTERED ([CameraId],[WindowStart]);
CREATE NONCLUSTERED INDEX [ControlLogs_DeviceId_CreatedAt_idx] ON [dbo].[ControlLogs]([DeviceId], [CreatedAt] DESC);
CREATE NONCLUSTERED INDEX [Alerts_HouseId_Status_CreatedAt_idx] ON [dbo].[Alerts]([HouseId], [Status], [CreatedAt] DESC);
CREATE NONCLUSTERED INDEX [Alerts_DeviceId_AlertType_DetectedClass_CreatedAt_idx] ON [dbo].[Alerts]([DeviceId], [AlertType], [DetectedClass], [CreatedAt] DESC);

-- 6. Tao lai DEFAULT
ALTER TABLE [dbo].[Users] ADD CONSTRAINT [Users_CreatedAt_df] DEFAULT sysutcdatetime() FOR [CreatedAt];
ALTER TABLE [dbo].[Houses] ADD CONSTRAINT [Houses_CreatedAt_df] DEFAULT sysutcdatetime() FOR [CreatedAt];
ALTER TABLE [dbo].[Devices] ADD CONSTRAINT [Devices_CreatedAt_df] DEFAULT sysutcdatetime() FOR [CreatedAt];
ALTER TABLE [dbo].[Thresholds] ADD CONSTRAINT [Thresholds_UpdatedAt_df] DEFAULT sysutcdatetime() FOR [UpdatedAt];
ALTER TABLE [dbo].[ControlLogs] ADD CONSTRAINT [ControlLogs_CreatedAt_df] DEFAULT sysutcdatetime() FOR [CreatedAt];
ALTER TABLE [dbo].[Alerts] ADD CONSTRAINT [Alerts_CreatedAt_df] DEFAULT sysutcdatetime() FOR [CreatedAt];
ALTER TABLE [dbo].[AlertHistory] ADD CONSTRAINT [AlertHistory_ChangedAt_df] DEFAULT sysutcdatetime() FOR [ChangedAt];
ALTER TABLE [dbo].[Harvests] ADD CONSTRAINT [Harvests_CreatedAt_df] DEFAULT sysutcdatetime() FOR [CreatedAt];

-- 7. Tao lai CHECK (dinh nghia chep tu migration init va bird_counts)
ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_Resolved
CHECK (
    (Status = 'RESOLVED' AND ResolvedAt IS NOT NULL)
    OR
    (Status <> 'RESOLVED' AND ResolvedAt IS NULL)
);

ALTER TABLE dbo.BirdCounts
ADD CONSTRAINT CK_BirdCounts_Window
CHECK (
    DATEDIFF(MINUTE, '20000101', WindowStart) % 5 = 0
    AND DATEPART(SECOND, WindowStart) = 0
    AND DATEPART(NANOSECOND, WindowStart) = 0
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
