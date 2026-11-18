SET NOCOUNT ON;

DECLARE @MatchCount INT;

SELECT @MatchCount = COUNT(*)
FROM sys.indexes AS i
WHERE i.object_id = OBJECT_ID(N'dbo.SensorReadings')
  AND i.is_unique = 1
  AND i.type = 2
  AND i.is_disabled = 0
  AND (
      SELECT COUNT(*)
      FROM sys.index_columns AS k
      WHERE k.object_id = i.object_id
        AND k.index_id = i.index_id
        AND k.key_ordinal > 0
  ) = 3
  AND EXISTS (
      SELECT 1
      FROM sys.index_columns AS k
      JOIN sys.columns AS c
        ON c.object_id = k.object_id
       AND c.column_id = k.column_id
      WHERE k.object_id = i.object_id
        AND k.index_id = i.index_id
        AND k.key_ordinal = 1
        AND c.name = N'DeviceId'
  )
  AND EXISTS (
      SELECT 1
      FROM sys.index_columns AS k
      JOIN sys.columns AS c
        ON c.object_id = k.object_id
       AND c.column_id = k.column_id
      WHERE k.object_id = i.object_id
        AND k.index_id = i.index_id
        AND k.key_ordinal = 2
        AND c.name = N'MetricCode'
  )
  AND EXISTS (
      SELECT 1
      FROM sys.index_columns AS k
      JOIN sys.columns AS c
        ON c.object_id = k.object_id
       AND c.column_id = k.column_id
      WHERE k.object_id = i.object_id
        AND k.index_id = i.index_id
        AND k.key_ordinal = 3
        AND c.name = N'RecordedAt'
  )
  AND EXISTS (
      SELECT 1
      FROM sys.index_columns AS k
      JOIN sys.columns AS c
        ON c.object_id = k.object_id
       AND c.column_id = k.column_id
      WHERE k.object_id = i.object_id
        AND k.index_id = i.index_id
        AND k.is_included_column = 1
        AND c.name = N'Value'
  );

IF @MatchCount <> 1
    THROW 51011,
        'FAIL: Khong co dung mot UNIQUE INDEX voi 3 cot khoa va INCLUDE(Value).',
        1;

PRINT 'PASS: Tim thay dung mot UNIQUE INDEX co INCLUDE(Value).';
