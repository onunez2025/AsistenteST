import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=soledbserver.database.windows.net;"
    "DATABASE=soledb-puntoventa;"
    "UID=soledbserveradmin;"
    "PWD=@s0le@dm1nAI#82,;"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
)
cursor = conn.cursor()

cursor.execute("""
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'APPGAC' AND TABLE_NAME = 'EncuestasServicioTecnico'
)
BEGIN
    CREATE TABLE [APPGAC].[EncuestasServicioTecnico] (
        Id                    INT IDENTITY(1,1) PRIMARY KEY,
        FechaRecepcion        DATETIME2        NOT NULL DEFAULT GETDATE(),
        ResponseId            VARCHAR(50)      NOT NULL,
        SurveyId              VARCHAR(50)      NOT NULL,
        RecordedDate          DATETIME2        NULL,
        CalificacionNPS       TINYINT          NULL,
        GrupoNPS              VARCHAR(20)      NULL,
        AspectosBien          NVARCHAR(500)    NULL,
        ComentarioCliente     NVARCHAR(MAX)    NULL,
        OrdenDeServicio       VARCHAR(50)      NULL,
        FechaDeVisita         VARCHAR(20)      NULL,
        Anio                  SMALLINT         NULL,
        Mes                   TINYINT          NULL,
        Tienda                NVARCHAR(200)    NULL,
        Producto              NVARCHAR(300)    NULL,
        GrupoMaterial         NVARCHAR(200)    NULL,
        Servicio              VARCHAR(100)     NULL,
        SegmentoAsignado      VARCHAR(200)     NULL,
        Distrito              VARCHAR(100)     NULL,
        CodTecnico            VARCHAR(50)      NULL,
        Tecnico               NVARCHAR(200)    NULL,
        Empresa               VARCHAR(100)     NULL,
        Estado                VARCHAR(50)      NULL,
        VisitaRealizada       VARCHAR(5)       NULL,
        TrabajoEfectuado      VARCHAR(5)       NULL,
        Resultado             VARCHAR(50)      NULL,
        NuevaVisita           VARCHAR(20)      NULL,
        ObservacionTecnico    NVARCHAR(MAX)    NULL,
        MotivoCancelacion     VARCHAR(200)     NULL,
        RecipientEmail        VARCHAR(200)     NULL,
        ExternalDataReference VARCHAR(100)     NULL
    )
    PRINT 'Tabla APPGAC.EncuestasServicioTecnico creada.'
END
ELSE
    PRINT 'Tabla ya existia.'
""")
conn.commit()

# Verificar
cursor.execute("""
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'APPGAC' AND TABLE_NAME = 'EncuestasServicioTecnico'
    ORDER BY ORDINAL_POSITION
""")
cols = cursor.fetchall()
print(f"Columnas en la tabla: {len(cols)}")
for c in cols:
    print(f"  {c.COLUMN_NAME}: {c.DATA_TYPE}")

conn.close()
print("Listo.")
