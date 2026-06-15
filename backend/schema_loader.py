import os
import sys
import pyodbc
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path, override=True)
else:
    load_dotenv(override=True)

SCHEMA_QUERY = """
SELECT
    TABLE_SCHEMA,
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE
    (TABLE_SCHEMA = 'dbo' AND TABLE_NAME LIKE 'GAC_APP_TB_%')
    OR (TABLE_SCHEMA = 'SIATC' AND TABLE_NAME = 'Dashboard_FSM')
    OR (TABLE_SCHEMA = 'APPGAC' AND TABLE_NAME IN (
        'ServiciosMateriales', 'ServiciosMaterialesMotivos', 'ServiciosViewSQL'
    ))
ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
"""

def _get_connection():
    conn_str = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={os.getenv('SQL_SERVER')};"
        f"DATABASE={os.getenv('SQL_DATABASE')};"
        f"UID={os.getenv('SQL_USER')};"
        f"PWD={os.getenv('SQL_PASSWORD')};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
    )
    return pyodbc.connect(conn_str)


def get_table_schemas(conn) -> dict:
    """Returns {(schema, table): [col_descriptions]}."""
    cursor = conn.cursor()
    cursor.execute(SCHEMA_QUERY)
    rows = cursor.fetchall()

    tables: dict = {}
    for schema, table, col_name, data_type, max_len, nullable in rows:
        key = (schema, table)
        if key not in tables:
            tables[key] = []
        col_str = f"{col_name} ({data_type}"
        if max_len and max_len != -1:
            col_str += f"({max_len})"
        if nullable == "NO":
            col_str += ", NOT NULL"
        col_str += ")"
        tables[key].append(col_str)

    return tables


def format_schema_for_prompt(tables: dict) -> str:
    """Produces the section to inject into the system prompt."""
    if not tables:
        return "(No se encontraron esquemas de tablas adicionales)"

    lines = []
    current_schema = None
    for (schema, table) in sorted(tables.keys()):
        cols = tables[(schema, table)]
        if schema != current_schema:
            lines.append(f"\n  ESQUEMA [{schema}]:")
            current_schema = schema
        lines.append(f"    • [{schema}].[{table}] ({len(cols)} columnas):")
        for col in cols:
            lines.append(f"        - {col}")

    return "\n".join(lines)


def load_schemas_for_prompt(get_db_fn) -> str:
    """Called from main.py at startup — returns formatted schema string."""
    try:
        conn = get_db_fn()
        tables = get_table_schemas(conn)
        conn.close()
        return format_schema_for_prompt(tables)
    except Exception as e:
        return f"(Error al cargar esquemas dinámicos: {e})"


if __name__ == "__main__":
    print("Conectando a la base de datos...")
    try:
        conn = _get_connection()
        tables = get_table_schemas(conn)
        conn.close()
        print(f"\n=== {len(tables)} tablas encontradas ===\n")
        for (schema, table), cols in sorted(tables.items()):
            print(f"[{schema}].[{table}]  ({len(cols)} columnas)")
            for c in cols:
                print(f"    {c}")
            print()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
