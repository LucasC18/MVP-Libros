-- Crear DB y usarla
IF DB_ID(N'colegio') IS NULL
  CREATE DATABASE colegio;
GO
USE colegio;
GO

-- Tabla de administradores (SQL Server)
IF OBJECT_ID(N'dbo.admin_users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.admin_users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_admin_users_created DEFAULT SYSUTCDATETIME()
  );
END
GO
