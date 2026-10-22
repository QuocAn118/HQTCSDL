
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- Neu da co du lieu thu hoach thi bo qua
IF EXISTS (SELECT 1 FROM dbo.Harvests)
BEGIN
    PRINT N'seed 90: da co thu hoach, bo qua';
    RETURN;
END;

-- Ngay neo du lieu mau (do script deploy truyen vao)
DECLARE @AnchorVn DATE = '$(AnchorDateVn)';

-- Ngay dau tien cua thang neo
DECLARE @MonthStart DATE =
    DATEFROMPARTS(YEAR(@AnchorVn), MONTH(@AnchorVn), 1);

-- Tai khoan chu nha H1
DECLARE @owner1 INT = (
    SELECT UserId
    FROM dbo.Users
    WHERE Username = 'owner1'
);

-- Tao du lieu thu hoach cho H1, tang F1-F3
-- Moi tang co 3 lan thu hoach:
-- Thang neo va hai thang truoc do
INSERT dbo.Harvests (
    ZoneId,
    HarvestDate,
    NestCount,
    WeightGram,
    Grade,
    RecordedBy
)
SELECT
    z.ZoneId,

    -- Thu hoach vao ngay 10 hang thang
    DATEADD(
        DAY,
        9,
        DATEADD(MONTH, -m.k, @MonthStart)
    ),

    -- So to yen theo tang va thang
    40 + 5 * z.FloorNo - 3 * m.k,

    -- Trong luong trung binh 8.5 gram/to
    CAST(
        (40 + 5 * z.FloorNo - 3 * m.k) * 8.5
        AS DECIMAL(9, 1)
    ),

    -- Phan loai chat luong
    CASE
        WHEN z.FloorNo = 3 THEN 'A'
        WHEN z.FloorNo = 2 THEN 'B'
        ELSE 'C'
    END,

    @owner1

FROM dbo.Zones z

JOIN dbo.Houses h
    ON h.HouseId = z.HouseId
   AND h.Name = N'H1'

CROSS JOIN (
    VALUES (0), (1), (2)
) m(k)

WHERE z.FloorNo BETWEEN 1 AND 3;

PRINT N'seed 90: xong';
