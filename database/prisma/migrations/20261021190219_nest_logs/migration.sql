BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[NestLogs] (
    [ZoneId] INT NOT NULL,
    [WeekStart] DATE NOT NULL,
    [ActiveNests] INT NOT NULL,
    [NewNests] INT NOT NULL,
    [Note] NVARCHAR(500),
    CONSTRAINT [NestLogs_pkey] PRIMARY KEY CLUSTERED ([ZoneId],[WeekStart])
);

-- AddForeignKey
ALTER TABLE [dbo].[NestLogs] ADD CONSTRAINT [NestLogs_ZoneId_fkey] FOREIGN KEY ([ZoneId]) REFERENCES [dbo].[Zones]([ZoneId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH



-- Kiem tra WeekStart phai la thu Hai
-- Ngay 1900-01-01 la thu Hai
-- Khong dung DATEPART(WEEKDAY) vi phu thuoc DATEFIRST

IF OBJECT_ID(N'dbo.CK_NestLogs_Monday', N'C') IS NULL
    ALTER TABLE dbo.NestLogs
    ADD CONSTRAINT CK_NestLogs_Monday
    CHECK (
        DATEDIFF(DAY, '19000101', WeekStart) % 7 = 0
    );

-- Kiem tra so luong to yen khong duoc am

IF OBJECT_ID(N'dbo.CK_NestLogs_NonNegative', N'C') IS NULL
    ALTER TABLE dbo.NestLogs
    ADD CONSTRAINT CK_NestLogs_NonNegative
    CHECK (
        ActiveNests >= 0
        AND NewNests >= 0
    );

