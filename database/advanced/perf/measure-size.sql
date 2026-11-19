SET NOCOUNT ON;

PRINT '=== 1. TOTAL READINGS ===';
SELECT COUNT_BIG(*) AS TotalReadings
FROM dbo.SensorReadings;

PRINT '=== 2. TABLE SPACE USED ===';
EXEC sys.sp_spaceused N'dbo.SensorReadings';

PRINT '=== 3. DATABASE FILE SIZES ===';
SELECT
    name AS LogicalFileName,
    type_desc AS FileType,
    size AS SizePages,
    CAST(size * 8.0 / 1024 AS DECIMAL(18,2)) AS SizeMB
FROM sys.database_files;

SELECT
    CAST(SUM(size) * 8.0 / 1024 AS DECIMAL(18,2)) AS TotalDatabaseSizeMB
FROM sys.database_files;

PRINT '=== 4. INDEX SIZES ===';
SELECT
    i.name AS IndexName,
    SUM(ps.used_page_count) * 8.0 / 1024 AS UsedMB,
    SUM(ps.row_count) AS TotalRows
FROM sys.dm_db_partition_stats ps
JOIN sys.indexes i
    ON i.object_id = ps.object_id
   AND i.index_id = ps.index_id
WHERE ps.object_id = OBJECT_ID('dbo.SensorReadings')
GROUP BY i.name
ORDER BY i.name;

PRINT '=== 5. VALUE RANGE VALIDATION ===';
SELECT
    MetricCode,
    COUNT_BIG(*) AS ReadingCount,
    MIN(Value) AS MinValue,
    MAX(Value) AS MaxValue
FROM dbo.SensorReadings
WHERE RecordedAt >= '2026-04-07T00:00:00'
  AND RecordedAt < '2026-10-04T00:00:00'
GROUP BY MetricCode
ORDER BY MetricCode;

PRINT '=== 6. TIME RANGE VALIDATION ===';
SELECT
    MIN(RecordedAt) AS FirstReadingUTC,
    MAX(RecordedAt) AS LastReadingUTC,
    COUNT_BIG(*) AS ReadingCount
FROM dbo.SensorReadings
WHERE RecordedAt >= '2026-04-07T00:00:00'
  AND RecordedAt < '2026-10-04T00:00:00';
