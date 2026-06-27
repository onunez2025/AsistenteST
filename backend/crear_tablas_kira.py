import os, sys
import pyodbc
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

conn = pyodbc.connect(
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={os.getenv('SQL_SERVER')};"
    f"DATABASE={os.getenv('SQL_DATABASE')};"
    f"UID={os.getenv('SQL_USER')};"
    f"PWD={os.getenv('SQL_PASSWORD')};"
    f"Encrypt=yes;TrustServerCertificate=no;"
)
cursor = conn.cursor()

cursor.execute("""
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'KIRA')
    EXEC('CREATE SCHEMA KIRA');
""")

cursor.execute("""
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'KIRA' AND TABLE_NAME = 'Conversations'
)
BEGIN
    CREATE TABLE KIRA.Conversations (
        Id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        UserId      NVARCHAR(50)     NOT NULL,
        Title       NVARCHAR(500)    NOT NULL DEFAULT 'Nueva conversación',
        IsPinned    BIT              NOT NULL DEFAULT 0,
        CreatedAt   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt   DATETIME2        NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_Conversations_UserId ON KIRA.Conversations(UserId);
    PRINT 'Tabla KIRA.Conversations creada.';
END
ELSE
    PRINT 'KIRA.Conversations ya existia.';
""")

cursor.execute("""
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'KIRA' AND TABLE_NAME = 'Messages'
)
BEGIN
    CREATE TABLE KIRA.Messages (
        Id               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        ConversationId   UNIQUEIDENTIFIER NOT NULL
                            REFERENCES KIRA.Conversations(Id) ON DELETE CASCADE,
        Role             NVARCHAR(20)     NOT NULL,
        Content          NVARCHAR(MAX)    NOT NULL,
        AttachmentName   NVARCHAR(500)    NULL,
        AttachmentType   NVARCHAR(200)    NULL,
        AttachmentUrl    NVARCHAR(2000)   NULL,
        CreatedAt        DATETIME2        NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_Messages_ConversationId ON KIRA.Messages(ConversationId);
    PRINT 'Tabla KIRA.Messages creada.';
END
ELSE
    PRINT 'KIRA.Messages ya existia.';
""")

conn.commit()

# Verificar
for schema, table in [("KIRA", "Conversations"), ("KIRA", "Messages")]:
    cursor.execute("""
        SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION
    """, (schema, table))
    cols = cursor.fetchall()
    print(f"\n{schema}.{table} ({len(cols)} columnas):")
    for c in cols:
        print(f"  {c.COLUMN_NAME}: {c.DATA_TYPE}")

conn.close()
print("\nListo.")
