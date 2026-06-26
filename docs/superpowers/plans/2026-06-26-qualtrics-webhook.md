# Webhook Qualtrics → APPGAC.EncuestasServicioTecnico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar automáticamente respuestas completadas de la encuesta NPS de Servicio Técnico de Qualtrics y persistirlas en `APPGAC.EncuestasServicioTecnico` en Azure SQL Server.

**Architecture:** Qualtrics dispara `POST /webhook/qualtrics?secret=TOKEN` al backend FastAPI. El backend valida el secret, llama a `GET /API/v3/surveys/{surveyId}/responses/{responseId}` en Qualtrics para obtener el response completo, y lo inserta en SQL Server. El módulo `webhook_qualtrics.py` contiene toda la lógica de fetch/parse/insert desacoplada del routing de FastAPI.

**Tech Stack:** FastAPI, pyodbc (ODBC Driver 17 for SQL Server), requests, Azure SQL Server, Qualtrics API v3, python-dotenv

## Global Constraints

- Python 3.11+
- ODBC Driver 17 for SQL Server (ya instalado en el entorno)
- Azure SQL Server: `soledbserver.database.windows.net`, database: `soledb-puntoventa`
- Qualtrics survey ST: `SV_abEHkdGNsG9a3EG`, base URL: `https://sole.yul1.qualtrics.com`
- Schema SQL: `APPGAC`, tabla: `EncuestasServicioTecnico`
- El endpoint siempre responde `200 OK` incluso en errores internos (Qualtrics no reintenta si recibe 200)
- Sin UPSERT — INSERT siempre; duplicados aceptados con `FechaRecepcion` diferente
- El `.env` NUNCA se commitea a git

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `backend/crear_tabla_webhook.py` | Crear (one-shot) | Script que crea la tabla en Azure SQL Server |
| `backend/.env` | Crear | Variables de entorno con credenciales |
| `backend/webhook_qualtrics.py` | Crear | Fetch Qualtrics API + parse campos + insert SQL |
| `backend/main.py` | Modificar (líneas 37 y 1124) | Import + endpoint `POST /webhook/qualtrics` |
| `backend/registro_webhook.py` | Crear | CLI para registrar/listar/eliminar suscripción en Qualtrics |

---

### Task 1: Crear tabla `APPGAC.EncuestasServicioTecnico` en Azure SQL Server

**Files:**
- Create: `backend/crear_tabla_webhook.py`

**Interfaces:**
- Produces: tabla `[APPGAC].[EncuestasServicioTecnico]` con 31 columnas en Azure SQL Server

- [ ] **Step 1: Crear `backend/crear_tabla_webhook.py`**

```python
import pyodbc

conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};"
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
```

- [ ] **Step 2: Ejecutar el script**

```
cd backend
python crear_tabla_webhook.py
```

Expected output:
```
Columnas en la tabla: 31
  Id: int
  FechaRecepcion: datetime2
  ResponseId: varchar
  ...
Listo.
```

- [ ] **Step 3: Commit**

```bash
git add backend/crear_tabla_webhook.py
git commit -m "feat: script crear_tabla_webhook — crea APPGAC.EncuestasServicioTecnico"
```

---

### Task 2: Crear `backend/.env` con todas las credenciales

**Files:**
- Create: `backend/.env`
- Modify: `.gitignore` (si `.env` no está ya ignorado)

**Interfaces:**
- Produces: variables de entorno disponibles para `main.py` y `webhook_qualtrics.py`

- [ ] **Step 1: Generar `QUALTRICS_WEBHOOK_SECRET`**

```python
import uuid
print(uuid.uuid4())
```

Ejecutar y copiar el UUID resultante (ej. `f3a1b2c4-d5e6-7890-abcd-ef1234567890`).

- [ ] **Step 2: Crear `backend/.env`**

Reemplazar `<UUID-GENERADO>` con el UUID del paso anterior. Completar `JWT_SECRET` y cualquier otra variable que el equipo ya tenga configurada (ver `main.py` líneas 72-78 para las que son obligatorias).

```env
# SQL Server Azure
SQL_SERVER=soledbserver.database.windows.net
SQL_DATABASE=soledb-puntoventa
SQL_USER=soledbserveradmin
SQL_PASSWORD=@s0le@dm1nAI#82,

# Qualtrics
QUALTRICS_BASE_URL=https://sole.yul1.qualtrics.com
QUALTRICS_API_TOKEN=u6lL6bS164amdvqFeqLv2l6TD5DYRtdLFSBtNovU
QUALTRICS_DIR_ID=POOL_1CsDYTWRqHFTxD3
QUALTRICS_WEBHOOK_SECRET=<UUID-GENERADO>
QUALTRICS_SURVEY_ST=SV_abEHkdGNsG9a3EG

# Requerido por main.py (obligatorio — app no arranca sin él)
JWT_SECRET=<valor-existente>

# Opcionales (completar si se usan)
# AZURE_STORAGE_CONNECTION_STRING=
# AZURE_STORAGE_CONTAINER=stecnico
# ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
# DEEPSEEK_API_KEY=
# GEMINI_API_KEY=
```

- [ ] **Step 3: Verificar que `.env` está en `.gitignore`**

```bash
grep -n ".env" ../.gitignore
```

Si no aparece, añadirlo:
```bash
echo ".env" >> ../.gitignore
```

- [ ] **Step 4: Commit (solo .gitignore, nunca el .env)**

```bash
cd ..
git add .gitignore
git commit -m "chore: asegurar backend/.env en .gitignore"
```

---

### Task 3: Crear `backend/webhook_qualtrics.py`

**Files:**
- Create: `backend/webhook_qualtrics.py`

**Interfaces:**
- Consumes: env vars `QUALTRICS_BASE_URL`, `QUALTRICS_API_TOKEN` (cargados desde `.env`)
- Produces:
  - `fetch_qualtrics_response(survey_id: str, response_id: str) -> dict | None`
  - `parse_response(response_data: dict, survey_id: str) -> dict`
  - `insert_response(get_conn: Callable[[], pyodbc.Connection], parsed: dict) -> None`

- [ ] **Step 1: Crear `backend/webhook_qualtrics.py`**

```python
import os
import logging
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("webhook-qualtrics")

QUALTRICS_BASE_URL  = os.getenv("QUALTRICS_BASE_URL", "").rstrip("/")
QUALTRICS_API_TOKEN = os.getenv("QUALTRICS_API_TOKEN", "")


def fetch_qualtrics_response(survey_id: str, response_id: str) -> dict | None:
    url = f"{QUALTRICS_BASE_URL}/API/v3/surveys/{survey_id}/responses/{response_id}"
    try:
        r = requests.get(url, headers={"X-API-TOKEN": QUALTRICS_API_TOKEN}, timeout=15)
        if r.status_code != 200:
            logger.error(f"Qualtrics GET {response_id} → HTTP {r.status_code}: {r.text[:200]}")
            return None
        return r.json().get("result", {})
    except Exception as e:
        logger.error(f"Error fetching Qualtrics response {response_id}: {e}")
        return None


def _parse_date(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _safe_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_response(response_data: dict, survey_id: str) -> dict:
    v      = response_data.get("values", {})
    labels = response_data.get("labels", {})

    qid12_labels = labels.get("QID12")
    aspectos = ", ".join(qid12_labels) if isinstance(qid12_labels, list) else (qid12_labels or "")

    return {
        "ResponseId":            response_data.get("responseId", ""),
        "SurveyId":              survey_id,
        "RecordedDate":          _parse_date(v.get("recordedDate")),
        "CalificacionNPS":       _safe_int(v.get("QID9")),
        "GrupoNPS":              labels.get("QID9_NPS_GROUP"),
        "AspectosBien":          (aspectos[:500] if aspectos else None),
        "ComentarioCliente":     v.get("QID24_TEXT"),
        "OrdenDeServicio":       v.get("ORDENDESERVICIO"),
        "FechaDeVisita":         v.get("FECHA_DE_VISITA"),
        "Anio":                  _safe_int(v.get("ANIO")),
        "Mes":                   _safe_int(v.get("MESN")),
        "Tienda":                v.get("TIENDA"),
        "Producto":              v.get("PRODUCTO"),
        "GrupoMaterial":         v.get("GRUPO_MATERIAL_1"),
        "Servicio":              v.get("SERVICIO"),
        "SegmentoAsignado":      v.get("SEGMENTO_ASIGNADO"),
        "Distrito":              v.get("DISTRITO"),
        "CodTecnico":            v.get("COD_TECNICO"),
        "Tecnico":               v.get("TECNICO"),
        "Empresa":               v.get("EMPRESA"),
        "Estado":                v.get("ESTADO"),
        "VisitaRealizada":       v.get("VISITA_REALIZADA"),
        "TrabajoEfectuado":      v.get("TRABAJO_EFECTUADO"),
        "Resultado":             v.get("RESULTADO"),
        "NuevaVisita":           v.get("NUEVA_VISITA"),
        "ObservacionTecnico":    v.get("OBSERVACION_TECNICO"),
        "MotivoCancelacion":     v.get("MOTIVO_DE_DESINSTALACION"),
        "RecipientEmail":        v.get("recipientEmail"),
        "ExternalDataReference": v.get("externalDataReference"),
    }


def insert_response(get_conn, parsed: dict) -> None:
    cols         = list(parsed.keys())
    placeholders = ", ".join("?" for _ in cols)
    col_names    = ", ".join(cols)
    sql          = (
        f"INSERT INTO [APPGAC].[EncuestasServicioTecnico] ({col_names}) "
        f"VALUES ({placeholders})"
    )
    values = [parsed[c] for c in cols]
    conn   = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, values)
        conn.commit()
    finally:
        conn.close()
```

- [ ] **Step 2: Crear `backend/test_webhook_manual.py` para verificar el módulo**

```python
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
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
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
assert parsed["CalificacionNPS"] == 0,   f"FAIL: CalificacionNPS esperado 0, got {parsed['CalificacionNPS']}"
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
assert row.ResponseId    == RESPONSE_ID, f"FAIL: ResponseId {row.ResponseId}"
assert row.CalificacionNPS == 0,         f"FAIL: CalificacionNPS {row.CalificacionNPS}"
assert row.GrupoNPS      == "Detractor", f"FAIL: GrupoNPS {row.GrupoNPS}"

print("PASS: fetch → parse → insert verificado correctamente.")
```

- [ ] **Step 3: Ejecutar el test manual**

```
cd backend
python test_webhook_manual.py
```

Expected:
```
Fetching desde Qualtrics...
  responseId: R_b7cEAGtftH2k96K
Parseando campos...
  CalificacionNPS=0 GrupoNPS=Detractor OK
Insertando en SQL Server...
Verificando fila insertada...
PASS: fetch → parse → insert verificado correctamente.
```

- [ ] **Step 4: Commit**

```bash
git add backend/webhook_qualtrics.py backend/test_webhook_manual.py
git commit -m "feat: modulo webhook_qualtrics — fetch/parse/insert respuestas Qualtrics en SQL Server"
```

---

### Task 4: Añadir endpoint `POST /webhook/qualtrics` a `main.py`

**Files:**
- Modify: `backend/main.py` — dos bloques: imports (línea ~37) y endpoint (línea ~1124, antes del `if __name__`)

**Interfaces:**
- Consumes: `fetch_qualtrics_response`, `parse_response`, `insert_response` de `webhook_qualtrics.py`
- Consumes: `get_db_connection` de `main.py` (ya existe, línea 58)
- Produces: endpoint `POST /webhook/qualtrics?secret=TOKEN` → `{"status": "ok"}`

- [ ] **Step 1: Añadir import en `main.py`**

Justo después de la línea `from schema_loader import load_schemas_for_prompt` (línea 37), añadir:

```python
from webhook_qualtrics import (
    fetch_qualtrics_response,
    parse_response as wq_parse_response,
    insert_response as wq_insert_response,
)
```

- [ ] **Step 2: Añadir variables de entorno en `main.py`**

Justo después de la línea `SQL_PASSWORD = os.getenv("SQL_PASSWORD")` (línea 56), añadir:

```python
QUALTRICS_WEBHOOK_SECRET = os.getenv("QUALTRICS_WEBHOOK_SECRET", "")
QUALTRICS_SURVEY_ST      = os.getenv("QUALTRICS_SURVEY_ST", "")
```

- [ ] **Step 3: Añadir el endpoint en `main.py`**

Justo antes de `if __name__ == "__main__":` (línea 1125), insertar:

```python
# ---------------------------------------------------------------------------
# WEBHOOK QUALTRICS
# ---------------------------------------------------------------------------

@app.post("/webhook/qualtrics")
async def webhook_qualtrics_endpoint(request: Request, secret: str = ""):
    if not QUALTRICS_WEBHOOK_SECRET or secret != QUALTRICS_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        body = await request.json()
    except Exception:
        return {"status": "ok", "detail": "invalid json"}

    survey_id   = body.get("SurveyID") or body.get("surveyId", "")
    response_id = body.get("ResponseID") or body.get("responseId", "")

    if survey_id != QUALTRICS_SURVEY_ST:
        logger.warning(f"Webhook ignorado: surveyId={survey_id} no es ST ({QUALTRICS_SURVEY_ST})")
        return {"status": "ignored"}

    if not response_id:
        logger.warning("Webhook recibido sin ResponseID")
        return {"status": "ok", "detail": "no response_id"}

    try:
        data = fetch_qualtrics_response(survey_id, response_id)
        if data:
            parsed = wq_parse_response(data, survey_id)
            wq_insert_response(get_db_connection, parsed)
            logger.info(f"Webhook: respuesta {response_id} insertada en APPGAC.EncuestasServicioTecnico")
        else:
            logger.error(f"Webhook: no se pudo obtener response {response_id} de Qualtrics")
    except Exception as e:
        logger.error(f"Webhook error procesando {response_id}: {e}", exc_info=True)

    return {"status": "ok"}
```

- [ ] **Step 4: Verificar que el servidor arranca sin errores**

```
cd backend
uvicorn main:app --reload --port 8000
```

Expected en consola (sin errores de import):
```
INFO:     Application startup complete.
```

- [ ] **Step 5: Probar el endpoint con token inválido**

```bash
curl -s -X POST "http://localhost:8000/webhook/qualtrics?secret=WRONG" \
  -H "Content-Type: application/json" \
  -d '{"SurveyID":"SV_abEHkdGNsG9a3EG","ResponseID":"R_b7cEAGtftH2k96K"}'
```

Expected: `{"detail":"Unauthorized"}`

- [ ] **Step 6: Probar el endpoint con token correcto**

Reemplazar `<SECRET>` con el valor de `QUALTRICS_WEBHOOK_SECRET` del `.env`:

```bash
curl -s -X POST "http://localhost:8000/webhook/qualtrics?secret=<SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"SurveyID":"SV_abEHkdGNsG9a3EG","ResponseID":"R_b7cEAGtftH2k96K"}'
```

Expected: `{"status":"ok"}`

Verificar nueva fila en BD:
```sql
SELECT TOP 3 Id, ResponseId, GrupoNPS, CalificacionNPS, FechaRecepcion
FROM [APPGAC].[EncuestasServicioTecnico]
ORDER BY Id DESC
```

- [ ] **Step 7: Commit**

```bash
git add backend/main.py
git commit -m "feat: endpoint POST /webhook/qualtrics con validacion de secret y insert en SQL Server"
```

---

### Task 5: Crear `backend/registro_webhook.py`

**Files:**
- Create: `backend/registro_webhook.py`

**Interfaces:**
- Consumes: env vars `QUALTRICS_BASE_URL`, `QUALTRICS_API_TOKEN`, `QUALTRICS_SURVEY_ST`, `QUALTRICS_WEBHOOK_SECRET`
- Produces: CLI `--register <URL>` | `--list` | `--delete <id>` | `--test <responseId> [url_local]`

- [ ] **Step 1: Crear `backend/registro_webhook.py`**

```python
#!/usr/bin/env python3
"""
CLI para gestionar la suscripcion de webhook de Qualtrics.

Uso:
  python registro_webhook.py --register <URL_PUBLICA_BACKEND>
  python registro_webhook.py --list
  python registro_webhook.py --delete <subscriptionId>
  python registro_webhook.py --test <responseId>
  python registro_webhook.py --test <responseId> <url_local>
"""
import sys
import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

BASE    = os.getenv("QUALTRICS_BASE_URL", "").rstrip("/")
TOKEN   = os.getenv("QUALTRICS_API_TOKEN", "")
SURVEY  = os.getenv("QUALTRICS_SURVEY_ST", "")
SECRET  = os.getenv("QUALTRICS_WEBHOOK_SECRET", "")
HEADERS = {"X-API-TOKEN": TOKEN, "Content-Type": "application/json"}


def register(public_url: str) -> None:
    webhook_url = f"{public_url.rstrip('/')}/webhook/qualtrics?secret={SECRET}"
    payload = {
        "topics":                f"surveyengine.completedResponse.{SURVEY}",
        "publicationUrl":        webhook_url,
        "encrypt":               False,
        "successEmailAddresses": [],
    }
    r = requests.post(f"{BASE}/API/v3/eventsubscriptions", headers=HEADERS, json=payload, timeout=15)
    print(f"HTTP {r.status_code}")
    print(json.dumps(r.json(), indent=2, ensure_ascii=False))


def list_subs() -> None:
    r = requests.get(f"{BASE}/API/v3/eventsubscriptions", headers=HEADERS, timeout=15)
    print(f"HTTP {r.status_code}")
    elements = r.json().get("result", {}).get("elements", [])
    if not elements:
        print("Sin suscripciones activas.")
        return
    for s in elements:
        print(f"  ID: {s.get('id')} | topic: {s.get('topics')} | url: {s.get('publicationUrl')}")


def delete_sub(subscription_id: str) -> None:
    r = requests.delete(
        f"{BASE}/API/v3/eventsubscriptions/{subscription_id}",
        headers=HEADERS, timeout=15
    )
    print(f"HTTP {r.status_code}")
    print(r.text)


def test_local(response_id: str, local_url: str = "http://localhost:8000") -> None:
    url     = f"{local_url.rstrip('/')}/webhook/qualtrics?secret={SECRET}"
    payload = {"SurveyID": SURVEY, "ResponseID": response_id}
    r = requests.post(url, json=payload, timeout=15)
    print(f"HTTP {r.status_code}")
    print(r.text)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(0)

    if args[0] == "--register" and len(args) == 2:
        register(args[1])
    elif args[0] == "--list":
        list_subs()
    elif args[0] == "--delete" and len(args) == 2:
        delete_sub(args[1])
    elif args[0] == "--test" and len(args) == 2:
        test_local(args[1])
    elif args[0] == "--test" and len(args) == 3:
        test_local(args[1], args[2])
    else:
        print(__doc__)
        sys.exit(1)
```

- [ ] **Step 2: Verificar `--list` (antes de registrar)**

```
cd backend
python registro_webhook.py --list
```

Expected: `Sin suscripciones activas.` (o lista de subs existentes si ya hay alguna)

- [ ] **Step 3: Verificar `--test` apuntando al servidor local**

Con el servidor corriendo en `localhost:8000` y el `<SECRET>` del .env:
```
python registro_webhook.py --test R_b7cEAGtftH2k96K
```

Expected:
```
HTTP 200
{"status":"ok"}
```

- [ ] **Step 4: Commit**

```bash
git add backend/registro_webhook.py
git commit -m "feat: CLI registro_webhook.py — register/list/delete/test suscripciones Qualtrics"
```

---

### Task 6: Registrar el webhook en Qualtrics y prueba end-to-end

**Files:**
- Sin archivos nuevos — operación de configuración en producción

**Interfaces:**
- Consumes: backend desplegado con HTTPS (EasyPanel/Nginx), `registro_webhook.py`
- Produces: suscripción activa en Qualtrics que dispara el webhook con cada respuesta completada de `SV_abEHkdGNsG9a3EG`

- [ ] **Step 1: Desplegar el backend actualizado**

Asegurarse de que el backend con los cambios de Task 3 y Task 4 esté desplegado en producción. Las variables de entorno `QUALTRICS_WEBHOOK_SECRET` y `QUALTRICS_SURVEY_ST` deben estar configuradas en EasyPanel.

Verificar que el endpoint responda:
```bash
curl -s https://<URL-PUBLICA>/webhook/qualtrics?secret=WRONG -X POST \
  -H "Content-Type: application/json" -d "{}"
```
Expected: `{"detail":"Unauthorized"}`

- [ ] **Step 2: Registrar la suscripción en Qualtrics**

```bash
cd backend
python registro_webhook.py --register https://<URL-PUBLICA>
```

Expected (HTTP 200):
```json
{
  "result": {
    "id": "SUB_xxxxxxxxxx",
    "topics": "surveyengine.completedResponse.SV_abEHkdGNsG9a3EG",
    "publicationUrl": "https://<URL-PUBLICA>/webhook/qualtrics?secret=...",
    "encrypt": false
  }
}
```

Guardar el `id` (ej. `SUB_xxxxxxxxxx`) para referencia.

- [ ] **Step 3: Verificar suscripción activa**

```bash
python registro_webhook.py --list
```

Expected: la suscripción recién creada aparece con el topic correcto.

- [ ] **Step 4: Prueba end-to-end real**

Completar una respuesta de prueba en la encuesta `SV_abEHkdGNsG9a3EG`. Esperar hasta 60 segundos. Luego verificar en SQL Server:

```sql
SELECT TOP 5
    Id, ResponseId, GrupoNPS, CalificacionNPS, OrdenDeServicio, FechaRecepcion
FROM [APPGAC].[EncuestasServicioTecnico]
ORDER BY Id DESC
```

Expected: nueva fila con la respuesta de prueba y `FechaRecepcion` reciente.

- [ ] **Step 5: Commit de cierre**

```bash
git add .
git commit -m "chore: webhook Qualtrics registrado en produccion y verificado end-to-end"
```

---

## Self-review

**Cobertura del spec:**
- ✅ Tabla `APPGAC.EncuestasServicioTecnico` con 31 columnas → Task 1
- ✅ `backend/.env` con todas las credenciales y UUID generado → Task 2
- ✅ Módulo `webhook_qualtrics.py` con `fetch_qualtrics_response`, `parse_response`, `insert_response` → Task 3
- ✅ Endpoint `POST /webhook/qualtrics?secret=TOKEN` → Task 4
- ✅ Secret inválido → 401; survey distinto → 200 ignored; errores internos → 200 + log → Task 4
- ✅ INSERT siempre (sin UPSERT) → Task 3/4
- ✅ Script CLI `registro_webhook.py` con --register/--list/--delete/--test → Task 5
- ✅ Registro en Qualtrics y prueba end-to-end → Task 6

**Tipos y firmas consistentes en todos los tasks:**
- `fetch_qualtrics_response(survey_id: str, response_id: str) -> dict | None` — definido Task 3, usado Task 4
- `parse_response(response_data: dict, survey_id: str) -> dict` (alias `wq_parse_response`) — definido Task 3, usado Task 4
- `insert_response(get_conn: Callable, parsed: dict) -> None` (alias `wq_insert_response`) — definido Task 3, usado Task 4
- `get_db_connection` pasado como callable (no invocado) — existe en `main.py` línea 58, usado en Task 4
