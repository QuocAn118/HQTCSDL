BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[BirdCounts] (
    [CountId] INT NOT NULL IDENTITY(1,1),
    [CameraId] INT NOT NULL,
    [WindowStart] DATETIME2 NOT NULL,
    [InCount] INT NOT NULL,
    [OutCount] INT NOT NULL,
    CONSTRAINT [BirdCounts_pkey] PRIMARY KEY CLUSTERED ([CountId]),
    CONSTRAINT [BirdCounts_CameraId_WindowStart_key] UNIQUE NONCLUSTERED ([CameraId],[WindowStart])
);

-- AddForeignKey
ALTER TABLE [dbo].[BirdCounts] ADD CONSTRAINT [BirdCounts_CameraId_fkey] FOREIGN KEY ([CameraId]) REFERENCES [dbo].[Devices]([DeviceId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- So luong chim vao va ra khong duoc am
ALTER TABLE dbo.BirdCounts
ADD CONSTRAINT CK_BirdCounts_NonNegative
CHECK (InCount >= 0 AND OutCount >= 0);

-- Moi cua so dem chim bat dau tai moc 5 phut
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


