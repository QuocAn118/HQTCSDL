BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Harvests] (
    [HarvestId] INT NOT NULL IDENTITY(1,1),
    [ZoneId] INT NOT NULL,
    [HarvestDate] DATE NOT NULL,
    [NestCount] INT NOT NULL,
    [WeightGram] DECIMAL(9,1) NOT NULL,
    [Grade] CHAR(1),
    [RecordedBy] INT NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Harvests_CreatedAt_df] DEFAULT sysutcdatetime(),
    CONSTRAINT [Harvests_pkey] PRIMARY KEY CLUSTERED ([HarvestId]),
    CONSTRAINT [Harvests_ZoneId_HarvestDate_key] UNIQUE NONCLUSTERED ([ZoneId],[HarvestDate])
);

-- AddForeignKey
ALTER TABLE [dbo].[Harvests] ADD CONSTRAINT [Harvests_ZoneId_fkey] FOREIGN KEY ([ZoneId]) REFERENCES [dbo].[Zones]([ZoneId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Harvests] ADD CONSTRAINT [Harvests_RecordedBy_fkey] FOREIGN KEY ([RecordedBy]) REFERENCES [dbo].[Users]([UserId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH



-- Rang buoc phan loai chat luong to yen
ALTER TABLE [dbo].[Harvests]
ADD CONSTRAINT [CK_Harvests_Grade]
CHECK ([Grade] IS NULL OR [Grade] IN ('A', 'B', 'C'));

-- So luong to yen khong duoc am
-- Trong luong thu hoach khong duoc am
ALTER TABLE [dbo].[Harvests]
ADD CONSTRAINT [CK_Harvests_NonNegative]
CHECK ([NestCount] >= 0 AND [WeightGram] >= 0);

