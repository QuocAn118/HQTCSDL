BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Users] (
    [UserId] INT NOT NULL IDENTITY(1,1),
    [Username] VARCHAR(50) NOT NULL,
    [PasswordHash] VARCHAR(255) NOT NULL,
    [FullName] NVARCHAR(100) NOT NULL,
    [Email] VARCHAR(255) NOT NULL,
    [Phone] VARCHAR(20),
    [Role] VARCHAR(10) NOT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [Users_IsActive_df] DEFAULT 1,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Users_CreatedAt_df] DEFAULT sysutcdatetime(),
    CONSTRAINT [Users_pkey] PRIMARY KEY CLUSTERED ([UserId]),
    CONSTRAINT [Users_Username_key] UNIQUE NONCLUSTERED ([Username]),
    CONSTRAINT [Users_Email_key] UNIQUE NONCLUSTERED ([Email])
);

-- CreateTable
CREATE TABLE [dbo].[Houses] (
    [HouseId] INT NOT NULL IDENTITY(1,1),
    [OwnerId] INT NOT NULL,
    [Name] NVARCHAR(100) NOT NULL,
    [Address] NVARCHAR(255),
    [IsActive] BIT NOT NULL CONSTRAINT [Houses_IsActive_df] DEFAULT 1,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Houses_CreatedAt_df] DEFAULT sysutcdatetime(),
    CONSTRAINT [Houses_pkey] PRIMARY KEY CLUSTERED ([HouseId]),
    CONSTRAINT [Houses_OwnerId_Name_key] UNIQUE NONCLUSTERED ([OwnerId],[Name])
);

-- CreateTable
CREATE TABLE [dbo].[Zones] (
    [ZoneId] INT NOT NULL IDENTITY(1,1),
    [HouseId] INT NOT NULL,
    [Name] NVARCHAR(50) NOT NULL,
    [FloorNo] TINYINT NOT NULL,
    CONSTRAINT [Zones_pkey] PRIMARY KEY CLUSTERED ([ZoneId]),
    CONSTRAINT [Zones_HouseId_Name_key] UNIQUE NONCLUSTERED ([HouseId],[Name]),
    CONSTRAINT [Zones_ZoneId_HouseId_key] UNIQUE NONCLUSTERED ([ZoneId],[HouseId])
);

-- CreateTable
CREATE TABLE [dbo].[Devices] (
    [DeviceId] INT NOT NULL IDENTITY(1,1),
    [ZoneId] INT NOT NULL,
    [Code] VARCHAR(50) NOT NULL,
    [Name] NVARCHAR(100) NOT NULL,
    [DeviceType] VARCHAR(10) NOT NULL,
    [Status] VARCHAR(10) NOT NULL CONSTRAINT [Devices_Status_df] DEFAULT 'OFFLINE',
    [LastSeenAt] DATETIME2,
    [Mode] VARCHAR(6),
    [IsOn] BIT,
    [Level] TINYINT,
    [IsActive] BIT NOT NULL CONSTRAINT [Devices_IsActive_df] DEFAULT 1,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Devices_CreatedAt_df] DEFAULT sysutcdatetime(),
    CONSTRAINT [Devices_pkey] PRIMARY KEY CLUSTERED ([DeviceId]),
    CONSTRAINT [Devices_Code_key] UNIQUE NONCLUSTERED ([Code])
);

-- CreateTable
CREATE TABLE [dbo].[Metrics] (
    [MetricCode] VARCHAR(10) NOT NULL,
    [Name] NVARCHAR(50) NOT NULL,
    [Unit] NVARCHAR(10) NOT NULL,
    [ValidMin] DECIMAL(9,2) NOT NULL,
    [ValidMax] DECIMAL(9,2) NOT NULL,
    [Hysteresis] DECIMAL(9,2) NOT NULL,
    CONSTRAINT [Metrics_pkey] PRIMARY KEY CLUSTERED ([MetricCode])
);

-- CreateTable
CREATE TABLE [dbo].[Thresholds] (
    [ZoneId] INT NOT NULL,
    [MetricCode] VARCHAR(10) NOT NULL,
    [MinValue] DECIMAL(9,2),
    [MaxValue] DECIMAL(9,2),
    [TargetValue] DECIMAL(9,2),
    [UpdatedBy] INT,
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [Thresholds_UpdatedAt_df] DEFAULT sysutcdatetime(),
    CONSTRAINT [Thresholds_pkey] PRIMARY KEY CLUSTERED ([ZoneId],[MetricCode])
);

-- CreateTable
CREATE TABLE [dbo].[SensorReadings] (
    [ReadingId] BIGINT NOT NULL IDENTITY(1,1),
    [DeviceId] INT NOT NULL,
    [MetricCode] VARCHAR(10) NOT NULL,
    [Value] DECIMAL(9,2) NOT NULL,
    [RecordedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SensorReadings_pkey] PRIMARY KEY NONCLUSTERED ([ReadingId]),
    CONSTRAINT [SensorReadings_DeviceId_MetricCode_RecordedAt_key] UNIQUE NONCLUSTERED ([DeviceId],[MetricCode],[RecordedAt])
);

-- CreateTable
CREATE TABLE [dbo].[ControlLogs] (
    [LogId] INT NOT NULL IDENTITY(1,1),
    [DeviceId] INT NOT NULL,
    [IsOn] BIT NOT NULL,
    [Level] TINYINT,
    [Mode] VARCHAR(6) NOT NULL,
    [Source] VARCHAR(6) NOT NULL,
    [UserId] INT,
    [Reason] NVARCHAR(200),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [ControlLogs_CreatedAt_df] DEFAULT sysutcdatetime(),
    CONSTRAINT [ControlLogs_pkey] PRIMARY KEY CLUSTERED ([LogId])
);

-- CreateTable
CREATE TABLE [dbo].[Alerts] (
    [AlertId] INT NOT NULL IDENTITY(1,1),
    [HouseId] INT NOT NULL,
    [ZoneId] INT,
    [DeviceId] INT,
    [AlertType] VARCHAR(20) NOT NULL,
    [Severity] VARCHAR(10) NOT NULL,
    [MetricCode] VARCHAR(10),
    [Value] DECIMAL(9,2),
    [DetectedClass] VARCHAR(10),
    [Confidence] DECIMAL(4,3),
    [SnapshotPath] NVARCHAR(260),
    [Message] NVARCHAR(500) NOT NULL,
    [Status] VARCHAR(10) NOT NULL CONSTRAINT [Alerts_Status_df] DEFAULT 'NEW',
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Alerts_CreatedAt_df] DEFAULT sysutcdatetime(),
    [ResolvedAt] DATETIME2,
    [ResolvedBy] INT,
    CONSTRAINT [Alerts_pkey] PRIMARY KEY CLUSTERED ([AlertId])
);

-- CreateTable
CREATE TABLE [dbo].[AlertHistory] (
    [HistoryId] INT NOT NULL IDENTITY(1,1),
    [AlertId] INT NOT NULL,
    [OldStatus] VARCHAR(10),
    [NewStatus] VARCHAR(10) NOT NULL,
    [UserId] INT,
    [Note] NVARCHAR(500),
    [ChangedAt] DATETIME2 NOT NULL CONSTRAINT [AlertHistory_ChangedAt_df] DEFAULT sysutcdatetime(),
    CONSTRAINT [AlertHistory_pkey] PRIMARY KEY CLUSTERED ([HistoryId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Devices_ZoneId_idx] ON [dbo].[Devices]([ZoneId]);

-- CreateIndex
CREATE CLUSTERED INDEX [SensorReadings_RecordedAt_idx] ON [dbo].[SensorReadings]([RecordedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ControlLogs_DeviceId_CreatedAt_idx] ON [dbo].[ControlLogs]([DeviceId], [CreatedAt] DESC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Alerts_HouseId_Status_CreatedAt_idx] ON [dbo].[Alerts]([HouseId], [Status], [CreatedAt] DESC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Alerts_DeviceId_AlertType_DetectedClass_CreatedAt_idx] ON [dbo].[Alerts]([DeviceId], [AlertType], [DetectedClass], [CreatedAt] DESC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AlertHistory_AlertId_idx] ON [dbo].[AlertHistory]([AlertId]);

-- AddForeignKey
ALTER TABLE [dbo].[Houses] ADD CONSTRAINT [Houses_OwnerId_fkey] FOREIGN KEY ([OwnerId]) REFERENCES [dbo].[Users]([UserId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Zones] ADD CONSTRAINT [Zones_HouseId_fkey] FOREIGN KEY ([HouseId]) REFERENCES [dbo].[Houses]([HouseId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Devices] ADD CONSTRAINT [Devices_ZoneId_fkey] FOREIGN KEY ([ZoneId]) REFERENCES [dbo].[Zones]([ZoneId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Thresholds] ADD CONSTRAINT [Thresholds_ZoneId_fkey] FOREIGN KEY ([ZoneId]) REFERENCES [dbo].[Zones]([ZoneId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Thresholds] ADD CONSTRAINT [Thresholds_MetricCode_fkey] FOREIGN KEY ([MetricCode]) REFERENCES [dbo].[Metrics]([MetricCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Thresholds] ADD CONSTRAINT [Thresholds_UpdatedBy_fkey] FOREIGN KEY ([UpdatedBy]) REFERENCES [dbo].[Users]([UserId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SensorReadings] ADD CONSTRAINT [SensorReadings_DeviceId_fkey] FOREIGN KEY ([DeviceId]) REFERENCES [dbo].[Devices]([DeviceId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SensorReadings] ADD CONSTRAINT [SensorReadings_MetricCode_fkey] FOREIGN KEY ([MetricCode]) REFERENCES [dbo].[Metrics]([MetricCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ControlLogs] ADD CONSTRAINT [ControlLogs_DeviceId_fkey] FOREIGN KEY ([DeviceId]) REFERENCES [dbo].[Devices]([DeviceId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ControlLogs] ADD CONSTRAINT [ControlLogs_UserId_fkey] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([UserId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Alerts] ADD CONSTRAINT [Alerts_HouseId_fkey] FOREIGN KEY ([HouseId]) REFERENCES [dbo].[Houses]([HouseId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Alerts] ADD CONSTRAINT [Alerts_ZoneId_HouseId_fkey] FOREIGN KEY ([ZoneId], [HouseId]) REFERENCES [dbo].[Zones]([ZoneId],[HouseId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Alerts] ADD CONSTRAINT [Alerts_DeviceId_fkey] FOREIGN KEY ([DeviceId]) REFERENCES [dbo].[Devices]([DeviceId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Alerts] ADD CONSTRAINT [Alerts_MetricCode_fkey] FOREIGN KEY ([MetricCode]) REFERENCES [dbo].[Metrics]([MetricCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Alerts] ADD CONSTRAINT [Alerts_ResolvedBy_fkey] FOREIGN KEY ([ResolvedBy]) REFERENCES [dbo].[Users]([UserId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AlertHistory] ADD CONSTRAINT [AlertHistory_AlertId_fkey] FOREIGN KEY ([AlertId]) REFERENCES [dbo].[Alerts]([AlertId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AlertHistory] ADD CONSTRAINT [AlertHistory_UserId_fkey] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([UserId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ===== SQL viet tay: CHECK, chi muc loc =====

-- 1. USERS
IF OBJECT_ID(N'dbo.CK_Users_Role', N'C') IS NULL
    ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_Role
    CHECK (Role IN ('ADMIN', 'OWNER'));

-- 2. DEVICES
IF OBJECT_ID(N'dbo.CK_Devices_Type', N'C') IS NULL
    ALTER TABLE dbo.Devices ADD CONSTRAINT CK_Devices_Type
    CHECK (DeviceType IN ('SENSOR', 'MIST', 'FAN', 'HEATER', 'SPEAKER', 'CAMERA'));

IF OBJECT_ID(N'dbo.CK_Devices_Status', N'C') IS NULL
    ALTER TABLE dbo.Devices ADD CONSTRAINT CK_Devices_Status
    CHECK (Status IN ('ONLINE', 'OFFLINE', 'ERROR'));

IF OBJECT_ID(N'dbo.CK_Devices_Mode', N'C') IS NULL
    ALTER TABLE dbo.Devices ADD CONSTRAINT CK_Devices_Mode
    CHECK (Mode IN ('AUTO', 'MANUAL'));

IF OBJECT_ID(N'dbo.CK_Devices_Level', N'C') IS NULL
    ALTER TABLE dbo.Devices ADD CONSTRAINT CK_Devices_Level
    CHECK (Level BETWEEN 0 AND 100);

IF OBJECT_ID(N'dbo.CK_Devices_ActuatorState', N'C') IS NULL
    ALTER TABLE dbo.Devices ADD CONSTRAINT CK_Devices_ActuatorState
    CHECK (
        (DeviceType IN ('MIST', 'FAN', 'HEATER', 'SPEAKER')
            AND Mode IS NOT NULL AND IsOn IS NOT NULL)
        OR
        (DeviceType IN ('SENSOR', 'CAMERA')
            AND Mode IS NULL AND IsOn IS NULL AND Level IS NULL)
    );

-- 3. METRICS
IF OBJECT_ID(N'dbo.CK_Metrics_Range', N'C') IS NULL
    ALTER TABLE dbo.Metrics ADD CONSTRAINT CK_Metrics_Range
    CHECK (ValidMin < ValidMax);

IF OBJECT_ID(N'dbo.CK_Metrics_Hysteresis', N'C') IS NULL
    ALTER TABLE dbo.Metrics ADD CONSTRAINT CK_Metrics_Hysteresis
    CHECK (Hysteresis >= 0);

-- 4. THRESHOLDS
IF OBJECT_ID(N'dbo.CK_Thresholds_AnyBound', N'C') IS NULL
    ALTER TABLE dbo.Thresholds ADD CONSTRAINT CK_Thresholds_AnyBound
    CHECK (MinValue IS NOT NULL OR MaxValue IS NOT NULL);

IF OBJECT_ID(N'dbo.CK_Thresholds_MinMax', N'C') IS NULL
    ALTER TABLE dbo.Thresholds ADD CONSTRAINT CK_Thresholds_MinMax
    CHECK (MinValue IS NULL OR MaxValue IS NULL OR MinValue < MaxValue);

IF OBJECT_ID(N'dbo.CK_Thresholds_Target', N'C') IS NULL
    ALTER TABLE dbo.Thresholds ADD CONSTRAINT CK_Thresholds_Target
    CHECK (
        TargetValue IS NULL
        OR (
            (MinValue IS NULL OR TargetValue >= MinValue)
            AND (MaxValue IS NULL OR TargetValue <= MaxValue)
        )
    );

-- 5. CONTROL LOGS
IF OBJECT_ID(N'dbo.CK_ControlLogs_Mode', N'C') IS NULL
    ALTER TABLE dbo.ControlLogs ADD CONSTRAINT CK_ControlLogs_Mode
    CHECK (Mode IN ('AUTO', 'MANUAL'));

IF OBJECT_ID(N'dbo.CK_ControlLogs_Source', N'C') IS NULL
    ALTER TABLE dbo.ControlLogs ADD CONSTRAINT CK_ControlLogs_Source
    CHECK (Source IN ('AUTO', 'MANUAL'));

IF OBJECT_ID(N'dbo.CK_ControlLogs_ManualUser', N'C') IS NULL
    ALTER TABLE dbo.ControlLogs ADD CONSTRAINT CK_ControlLogs_ManualUser
    CHECK (Source <> 'MANUAL' OR UserId IS NOT NULL);

IF OBJECT_ID(N'dbo.CK_ControlLogs_Level', N'C') IS NULL
    ALTER TABLE dbo.ControlLogs ADD CONSTRAINT CK_ControlLogs_Level
    CHECK (Level BETWEEN 0 AND 100);

-- 6. ALERTS
IF OBJECT_ID(N'dbo.CK_Alerts_Type', N'C') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_Type
    CHECK (AlertType IN ('THRESHOLD', 'PREDATOR', 'DEVICE_OFFLINE', 'POPULATION_DROP'));

IF OBJECT_ID(N'dbo.CK_Alerts_Severity', N'C') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_Severity
    CHECK (Severity IN ('INFO', 'WARNING', 'CRITICAL'));

IF OBJECT_ID(N'dbo.CK_Alerts_Status', N'C') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_Status
    CHECK (Status IN ('NEW', 'ACK', 'RESOLVED'));

IF OBJECT_ID(N'dbo.CK_Alerts_Resolved', N'C') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_Resolved
    CHECK (
        (Status = 'RESOLVED' AND ResolvedAt IS NOT NULL)
        OR
        (Status <> 'RESOLVED' AND ResolvedAt IS NULL)
    );

IF OBJECT_ID(N'dbo.CK_Alerts_Confidence', N'C') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_Confidence
    CHECK (Confidence BETWEEN 0 AND 1);

IF OBJECT_ID(N'dbo.CK_Alerts_ByType', N'C') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_ByType
    CHECK (
        (AlertType = 'THRESHOLD'
            AND ZoneId IS NOT NULL
            AND MetricCode IS NOT NULL
            AND Value IS NOT NULL
            AND DetectedClass IS NULL
            AND Confidence IS NULL
            AND SnapshotPath IS NULL)
        OR
        (AlertType = 'PREDATOR'
            AND DeviceId IS NOT NULL
            AND ZoneId IS NOT NULL
            AND DetectedClass IN ('rat', 'snake', 'owl')
            AND Confidence IS NOT NULL
            AND SnapshotPath IS NOT NULL
            AND MetricCode IS NULL
            AND Value IS NULL)
        OR
        (AlertType = 'DEVICE_OFFLINE'
            AND DeviceId IS NOT NULL
            AND ZoneId IS NOT NULL
            AND MetricCode IS NULL
            AND Value IS NULL
            AND DetectedClass IS NULL
            AND Confidence IS NULL
            AND SnapshotPath IS NULL)
        OR
        (AlertType = 'POPULATION_DROP'
            AND ZoneId IS NULL
            AND DeviceId IS NULL
            AND MetricCode IS NULL
            AND Value IS NULL
            AND DetectedClass IS NULL
            AND Confidence IS NULL
            AND SnapshotPath IS NULL)
    );

-- 7. ALERT HISTORY
IF OBJECT_ID(N'dbo.CK_AlertHistory_Status', N'C') IS NULL
    ALTER TABLE dbo.AlertHistory ADD CONSTRAINT CK_AlertHistory_Status
    CHECK (
        NewStatus IN ('NEW', 'ACK', 'RESOLVED')
        AND (OldStatus IS NULL OR OldStatus IN ('NEW', 'ACK', 'RESOLVED'))
    );

-- 8. FILTERED UNIQUE INDEX
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_Alerts_OpenThreshold'
      AND object_id = OBJECT_ID(N'dbo.Alerts')
)
    CREATE UNIQUE NONCLUSTERED INDEX UX_Alerts_OpenThreshold
    ON dbo.Alerts (ZoneId, MetricCode)
    WHERE AlertType = 'THRESHOLD' AND Status <> 'RESOLVED';
    
COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
