SET NOCOUNT ON;

-- 1. Tao database roles neu chua ton tai.
IF DATABASE_PRINCIPAL_ID(N'role_backend') IS NULL
    CREATE ROLE [role_backend];

IF DATABASE_PRINCIPAL_ID(N'role_report') IS NULL
    CREATE ROLE [role_report];

-- 2. Tao database users tu cac server logins neu da ton tai.
IF SUSER_ID(N'app_backend') IS NOT NULL
BEGIN
    IF DATABASE_PRINCIPAL_ID(N'app_backend') IS NULL
        EXEC(N'CREATE USER [app_backend] FOR LOGIN [app_backend];');

    IF NOT EXISTS (
        SELECT 1
        FROM sys.database_role_members drm
        JOIN sys.database_principals r ON r.principal_id = drm.role_principal_id
        JOIN sys.database_principals m ON m.principal_id = drm.member_principal_id
        WHERE r.name = N'role_backend'
          AND m.name = N'app_backend'
    )
        ALTER ROLE [role_backend] ADD MEMBER [app_backend];
END;

IF SUSER_ID(N'app_report') IS NOT NULL
BEGIN
    IF DATABASE_PRINCIPAL_ID(N'app_report') IS NULL
        EXEC(N'CREATE USER [app_report] FOR LOGIN [app_report];');

    IF NOT EXISTS (
        SELECT 1
        FROM sys.database_role_members drm
        JOIN sys.database_principals r ON r.principal_id = drm.role_principal_id
        JOIN sys.database_principals m ON m.principal_id = drm.member_principal_id
        WHERE r.name = N'role_report'
          AND m.name = N'app_report'
    )
        ALTER ROLE [role_report] ADD MEMBER [app_report];
END;

-- 3. Danh sach quyen tren cac bang.
DECLARE @TableGrants TABLE (
    ObjectName SYSNAME NOT NULL,
    Permissions VARCHAR(100) NOT NULL,
    RoleName SYSNAME NOT NULL
);

INSERT INTO @TableGrants (ObjectName, Permissions, RoleName)
VALUES
    (N'Users',          'SELECT, INSERT, UPDATE', N'role_backend'),
    (N'Houses',         'SELECT, INSERT, UPDATE', N'role_backend'),
    (N'Zones',          'SELECT, INSERT, UPDATE', N'role_backend'),
    (N'Devices',        'SELECT, INSERT, UPDATE', N'role_backend'),
    (N'Thresholds',     'SELECT, INSERT, UPDATE', N'role_backend'),
    (N'Harvests',       'SELECT, INSERT',          N'role_backend'),
    (N'Metrics',        'SELECT',                  N'role_backend'),
    (N'Alerts',         'SELECT',                  N'role_backend'),
    (N'ControlLogs',    'SELECT',                  N'role_backend'),
    (N'BirdCounts',     'SELECT',                  N'role_backend'),
    (N'SensorReadings', 'SELECT',                  N'role_backend');

-- 4. Danh sach quyen tren cac stored procedures.
DECLARE @ProcedureGrants TABLE (
    ObjectName SYSNAME NOT NULL,
    RoleName SYSNAME NOT NULL
);

INSERT INTO @ProcedureGrants (ObjectName, RoleName)
VALUES
    (N'sp_IngestReadings',                 N'role_backend'),
    (N'sp_SetActuator',                    N'role_backend'),
    (N'sp_UpdateAlertStatus',              N'role_backend'),
    (N'sp_GetReadingHistory',              N'role_backend'),
    (N'sp_RecordBirdCount',                N'role_backend'),
    (N'sp_CreatePredatorAlert',            N'role_backend'),
    (N'sp_DetectAnomalies',                N'role_backend'),
    (N'sp_RecordHeartbeat',                N'role_backend'),
    (N'sp_Report_EnvStabilityVsYield',     N'role_backend');

-- 5. Danh sach quyen SELECT tren cac view.
DECLARE @ViewGrants TABLE (
    ObjectName SYSNAME NOT NULL,
    RoleName SYSNAME NOT NULL
);

INSERT INTO @ViewGrants (ObjectName, RoleName)
VALUES
    (N'vw_LatestReadings', N'role_backend'),
    (N'vw_OpenAlerts',     N'role_backend'),
    (N'vw_DailyEnvStats',  N'role_backend'),
    (N'vw_DailyBirdFlow',  N'role_backend'),
    (N'vw_LatestReadings', N'role_report'),
    (N'vw_OpenAlerts',     N'role_report'),
    (N'vw_DailyEnvStats',  N'role_report'),
    (N'vw_DailyBirdFlow',  N'role_report');

-- 6. Cap quyen tren bang, chi khi object ton tai.
DECLARE
    @ObjectName SYSNAME,
    @Permissions VARCHAR(100),
    @RoleName SYSNAME,
    @Sql NVARCHAR(MAX);

DECLARE table_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT ObjectName, Permissions, RoleName
    FROM @TableGrants;

OPEN table_cursor;
FETCH NEXT FROM table_cursor
INTO @ObjectName, @Permissions, @RoleName;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'dbo.' + @ObjectName, N'U') IS NOT NULL
    BEGIN
        SET @Sql =
            N'GRANT ' + @Permissions
            + N' ON OBJECT::dbo.' + QUOTENAME(@ObjectName)
            + N' TO ' + QUOTENAME(@RoleName) + N';';

        EXEC sys.sp_executesql @Sql;
    END;

    FETCH NEXT FROM table_cursor
    INTO @ObjectName, @Permissions, @RoleName;
END;

CLOSE table_cursor;
DEALLOCATE table_cursor;

-- 7. Cap EXECUTE tren stored procedures, chi khi object ton tai.
DECLARE procedure_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT ObjectName, RoleName
    FROM @ProcedureGrants;

OPEN procedure_cursor;
FETCH NEXT FROM procedure_cursor
INTO @ObjectName, @RoleName;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'dbo.' + @ObjectName, N'P') IS NOT NULL
    BEGIN
        SET @Sql =
            N'GRANT EXECUTE ON OBJECT::dbo.' + QUOTENAME(@ObjectName)
            + N' TO ' + QUOTENAME(@RoleName) + N';';

        EXEC sys.sp_executesql @Sql;
    END;

    FETCH NEXT FROM procedure_cursor
    INTO @ObjectName, @RoleName;
END;

CLOSE procedure_cursor;
DEALLOCATE procedure_cursor;

-- 8. Cap SELECT tren view, chi khi object ton tai.
DECLARE view_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT ObjectName, RoleName
    FROM @ViewGrants;

OPEN view_cursor;
FETCH NEXT FROM view_cursor
INTO @ObjectName, @RoleName;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'dbo.' + @ObjectName, N'V') IS NOT NULL
    BEGIN
        SET @Sql =
            N'GRANT SELECT ON OBJECT::dbo.' + QUOTENAME(@ObjectName)
            + N' TO ' + QUOTENAME(@RoleName) + N';';

        EXEC sys.sp_executesql @Sql;
    END;

    FETCH NEXT FROM view_cursor
    INTO @ObjectName, @RoleName;
END;

CLOSE view_cursor;
DEALLOCATE view_cursor;

PRINT N'04-security: roles, users va grants da duoc ap dung.';
GO
