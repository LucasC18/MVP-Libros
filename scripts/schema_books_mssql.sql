USE colegio;
GO

IF OBJECT_ID(N'dbo.books', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.books (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    isbn          NVARCHAR(32)  NOT NULL UNIQUE,
    titulo        NVARCHAR(200) NOT NULL,
    autor         NVARCHAR(200) NOT NULL,
    editorial     NVARCHAR(200) NOT NULL,
    anio          INT           NOT NULL,
    categoria     NVARCHAR(100) NOT NULL,
    ubicacion     NVARCHAR(100) NOT NULL,
    stock         INT           NOT NULL,
    precio        DECIMAL(10,2) NOT NULL,
    estado        NVARCHAR(20)  NOT NULL
                  CONSTRAINT CK_books_estado CHECK (estado IN (N'disponible', N'prestado', N'baja')),
    notas         NVARCHAR(MAX) NULL,            -- opcional (extra)
    responsable   NVARCHAR(100) NULL,            -- opcional (extra)
    created_at    DATETIME2(0)  NOT NULL CONSTRAINT DF_books_created DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2(0)  NOT NULL CONSTRAINT DF_books_updated DEFAULT SYSUTCDATETIME()
  );
END
GO

-- índice para búsquedas por titulo/autor/categoria (además del UNIQUE de isbn)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_books_busqueda' AND object_id = OBJECT_ID(N'dbo.books'))
BEGIN
  CREATE INDEX IX_books_busqueda ON dbo.books (titulo, autor, categoria);
END
GO
