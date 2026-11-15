IF SUSER_ID(N'app_backend') IS NULL
BEGIN
    CREATE LOGIN app_backend
    WITH PASSWORD = N'$(AppBackendPassword)',
         DEFAULT_DATABASE = master,
         CHECK_POLICY = ON,
         CHECK_EXPIRATION = OFF;
END
ELSE
BEGIN
    ALTER LOGIN app_backend
    WITH PASSWORD = N'$(AppBackendPassword)';
END;
GO

IF SUSER_ID(N'app_report') IS NULL
BEGIN
    CREATE LOGIN app_report
    WITH PASSWORD = N'$(AppReportPassword)',
         DEFAULT_DATABASE = master,
         CHECK_POLICY = ON,
         CHECK_EXPIRATION = OFF;
END
ELSE
BEGIN
    ALTER LOGIN app_report
    WITH PASSWORD = N'$(AppReportPassword)';
END;
GO
