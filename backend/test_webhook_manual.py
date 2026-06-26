"""Script de verificacion manual del modulo webhook_qualtrics."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import pyodbc
from dotenv import load_dotenv
load_dotenv()

SQL_SERVER   = os.getenv("SQL_SERVER")
SQL_DATABASE = os.getenv("SQL_DATABASE")
SQL_USER     = os.getenv("SQL_USER")
SQL_PASSWORD = os.getenv("SQL_PASSWORD")

def get_conn():
    return pyodbc.connect(
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={SQL_SERVER};DATABASE={SQL_DATABASE};"
        f"UID={SQL_USER};PWD={SQL_PASSWORD};"
        "Encrypt=yes;TrustServerCertificate=no;"
    )

from webhook_qualtrics import fetch_qualtrics_response, parse_response, insert_response

SURVEY_ID   = "SV_abEHkdGNsG9a3EG"
RESPONSE_ID = "R_b7cEAGtftH2k96K"  # response real con CalificacionNPS=0, GrupoNPS=Detractor

print("Fetching desde Qualtrics...")
data = fetch_qualtrics_response(SURVEY_ID, RESPONSE_ID)
assert data, "FAIL: fetch_qualtrics_response devolvio None"
print(f"  responseId: {data.get('responseId')}")

print("Parseando campos...")
parsed = parse_response(data, SURVEY_ID)
assert parsed["CalificacionNPS"] == 0,    f"FAIL: CalificacionNPS esperado 0, got {parsed['CalificacionNPS']}"
assert parsed["GrupoNPS"] == "Detractor", f"FAIL: GrupoNPS esperado Detractor, got {parsed['GrupoNPS']}"
assert parsed["OrdenDeServicio"] == "999999999", f"FAIL: OrdenDeServicio got {parsed['OrdenDeServicio']}"
print(f"  CalificacionNPS={parsed['CalificacionNPS']} GrupoNPS={parsed['GrupoNPS']} OK")

print("Insertando en SQL Server...")
insert_response(get_conn, parsed)

print("Verificando fila insertada...")
conn = get_conn()
row = conn.cursor().execute(
    "SELECT TOP 1 ResponseId, GrupoNPS, CalificacionNPS "
    "FROM [APPGAC].[EncuestasServicioTecnico] ORDER BY Id DESC"
).fetchone()
conn.close()
assert row.ResponseId     == RESPONSE_ID, f"FAIL: ResponseId {row.ResponseId}"
assert row.CalificacionNPS == 0,          f"FAIL: CalificacionNPS {row.CalificacionNPS}"
assert row.GrupoNPS       == "Detractor", f"FAIL: GrupoNPS {row.GrupoNPS}"

print("PASS: fetch -> parse -> insert verificado correctamente.")
