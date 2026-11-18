SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE
    @ObjectId INT = OBJECT_ID(N'dbo.SensorReadings'),
    @IndexId INT,
    @IndexName SYSNAME,
    @IsConstraint BIT,
    @HasInclude BIT,
    @Sql NVARCHAR(MAX);

IF @ObjectId IS NULL
    THROW 51020, 'Khong tim thay dbo.SensorReadings.', 1;

-- Tim unique index co dung 3 cot khoa theo thu tu.
SELECT
    @IndexId = i.index_id,
    @IndexName = i.name,
    @IsConstraint = i.is_unique_constraint,
    @HasInclude = CASE WHEN EXISTS (
        SELECT 1
        FROM sys.index_columns ic
        JOIN sys.columns c
          ON c.object_id = ic.object_id
         AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id
          AND ic.index_id = i.index_id
          AND ic.is_included_column = 1
          AND c.name = N'Value'
    ) THEN 1 ELSE 0 END
FROM sys.indexes i
WHERE i.object_id = @ObjectId
  AND i.is_unique = 1
  AND i.type = 2
  AND i.is_disabled = 0
  AND (
      SELECT COUNT(*)
      FROM sys.index_columns k
      WHERE k.object_id = i.object_id
        AND k.index_id = i.index_id
        AND k.key_ordinal > 0
  ) = 3
  AND EXISTS (
      SELECT 1 FROM sys.index_columns k
      JOIN sys.columns c ON c.object_id=k.object_id AND c.column_id=k.column_id
      WHERE k.object_id=i.object_id AND k.index_id=i.index_id
        AND k.key_ordinal=1 AND c.name=N'DeviceId'
  )
  AND EXISTS (
      SELECT 1 FROM sys.index_columns k
      JOIN sys.columns c ON c.object_id=k.object_id AND c.column_id=k.column_id
      WHERE k.object_id=i.object_id AND k.index_id=i.index_id
        AND k.key_ordinal=2 AND c.name=N'MetricCode'
  )
  AND EXISTS (
      SELECT 1 FROM sys.index_columns k
      JOIN sys.columns c ON c.object_id=k.object_id AND c.column_id=k.column_id
      WHERE k.object_id=i.object_id AND k.index_id=i.index_id
        AND k.key_ordinal=3 AND c.name=N'RecordedAt'
  );

IF @IndexName IS NULL
    THROW 51021, 'Khong tim thay unique index co dung 3 cot khoa yeu cau.', 1;

IF @HasInclude = 1
BEGIN
    PRINT N'da co INCLUDE, bo qua';
    RETURN;
END;

-- Khong tu y xoa constraint neu co FK tham chieu den index.
IF EXISTS (
    SELECT 1
    FROM sys.foreign_keys fk
    WHERE fk.referenced_object_id = @ObjectId
      AND fk.key_index_id = @IndexId
)
    THROW 51022, 'Unique constraint/index dang duoc FK tham chieu; dung lai de kiem tra.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    IF @IsConstraint = 1
    BEGIN
        SET @Sql = N'ALTER TABLE dbo.SensorReadings DROP CONSTRAINT '
                 + QUOTENAME(@IndexName) + N';';
        EXEC sys.sp_executesql @Sql;

        SET @Sql = N'CREATE UNIQUE NONCLUSTERED INDEX '
                 + QUOTENAME(@IndexName)
                 + N' ON dbo.SensorReadings (DeviceId, MetricCode, RecordedAt)'
                 + N' INCLUDE (Value);';
        EXEC sys.sp_executesql @Sql;
    END
    ELSE
    BEGIN
        SET @Sql = N'CREATE UNIQUE NONCLUSTERED INDEX '
                 + QUOTENAME(@IndexName)
                 + N' ON dbo.SensorReadings (DeviceId, MetricCode, RecordedAt)'
                 + N' INCLUDE (Value) WITH (DROP_EXISTING = ON);';
        EXEC sys.sp_executesql @Sql;
    END;

    -- Xoa index INCLUDE khong unique cu neu no dung chinh xac bo khoa nay.
    DECLARE @OldIndex SYSNAME;

    SELECT @OldIndex = i.name
    FROM sys.indexes i
    WHERE i.object_id = @ObjectId
      AND i.name = N'IX_SensorReadings_Device_Metric_Time_Include'
      AND i.is_unique = 0
      AND i.type = 2
      AND (
          SELECT COUNT(*) FROM sys.index_columns k
          WHERE k.object_id=i.object_id AND k.index_id=i.index_id
            AND k.key_ordinal > 0
      ) = 3
      AND EXISTS (
          SELECT 1 FROM sys.index_columns k
          JOIN sys.columns c ON c.object_id=k.object_id AND c.column_id=k.column_id
          WHERE k.object_id=i.object_id AND k.index_id=i.index_id
            AND k.key_ordinal=1 AND c.name=N'DeviceId'
      )
      AND EXISTS (
          SELECT 1 FROM sys.index_columns k
          JOIN sys.columns c ON c.object_id=k.object_id AND c.column_id=k.column_id
          WHERE k.object_id=i.object_id AND k.index_id=i.index_id
            AND k.key_ordinal=2 AND c.name=N'MetricCode'
      )
      AND EXISTS (
          SELECT 1 FROM sys.index_columns k
          JOIN sys.columns c ON c.object_id=k.object_id AND c.column_id=k.column_id
          WHERE k.object_id=i.object_id AND k.index_id=i.index_id
            AND k.key_ordinal=3 AND c.name=N'RecordedAt'
      )
      AND EXISTS (
          SELECT 1 FROM sys.index_columns k
          JOIN sys.columns c ON c.object_id=k.object_id AND c.column_id=k.column_id
          WHERE k.object_id=i.object_id AND k.index_id=i.index_id
            AND k.is_included_column=1 AND c.name=N'Value'
      );

    IF @OldIndex IS NOT NULL
    BEGIN
        SET @Sql = N'DROP INDEX ' + QUOTENAME(@OldIndex)
                 + N' ON dbo.SensorReadings;';
        EXEC sys.sp_executesql @Sql;
    END;

    COMMIT TRANSACTION;

    PRINT N'Da tao UNIQUE INDEX co INCLUDE(Value): ' + @IndexName;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
