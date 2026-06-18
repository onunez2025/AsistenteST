import os
import sys
import logging
import time
import zipfile
import io
import json
import requests
from dotenv import load_dotenv
from fastmcp import FastMCP

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger("mcp-qualtrics")

current_dir = os.path.dirname(os.path.abspath(__file__))
env_in_backend = os.path.join(current_dir, ".env")
env_in_root = os.path.join(os.path.dirname(current_dir), ".env")

if os.path.exists(env_in_backend):
    load_dotenv(env_in_backend, override=True)
elif os.path.exists(env_in_root):
    load_dotenv(env_in_root, override=True)
else:
    load_dotenv(override=True)

QUALTRICS_BASE_URL  = os.getenv("QUALTRICS_BASE_URL", "").rstrip("/")
QUALTRICS_API_TOKEN = os.getenv("QUALTRICS_API_TOKEN", "")
QUALTRICS_DIR_ID    = os.getenv("QUALTRICS_DIR_ID", "")

mcp = FastMCP("Qualtrics Server")


def _headers() -> dict:
    return {
        "X-API-TOKEN": QUALTRICS_API_TOKEN,
        "Content-Type": "application/json",
    }


def _check_config() -> str | None:
    if not QUALTRICS_BASE_URL or not QUALTRICS_API_TOKEN:
        return "Error: Las credenciales de Qualtrics no están configuradas (QUALTRICS_BASE_URL, QUALTRICS_API_TOKEN)."
    return None


@mcp.tool()
def listar_encuestas_qualtrics() -> str:
    """
    Lista todas las encuestas disponibles en la cuenta de Qualtrics.
    Úsala cuando el usuario pregunte qué encuestas existen, cuáles se usan para
    calificar tickets de atención o para conocer los IDs de encuesta disponibles.
    """
    err = _check_config()
    if err:
        return err

    logger.info("[MCP TOOL] listar_encuestas_qualtrics")
    url = f"{QUALTRICS_BASE_URL}/API/v3/surveys"
    all_surveys = []
    next_page = url

    while next_page:
        try:
            resp = requests.get(next_page, headers=_headers(), timeout=15)
            if resp.status_code != 200:
                return f"Error al listar encuestas: HTTP {resp.status_code} — {resp.text}"
            data = resp.json()
            elements = data.get("result", {}).get("elements", [])
            all_surveys.extend(elements)
            next_page = data.get("result", {}).get("nextPage")
        except Exception as e:
            return f"Error conectando con Qualtrics: {str(e)}"

    if not all_surveys:
        return "No se encontraron encuestas en la cuenta de Qualtrics."

    lines = ["Encuestas disponibles en Qualtrics:\n"]
    for s in all_surveys:
        lines.append(
            f"• ID: {s.get('id')} | Nombre: {s.get('name')} | "
            f"Activa: {s.get('isActive')} | Creada: {s.get('creationDate', '')[:10]}"
        )
    return "\n".join(lines)


@mcp.tool()
def obtener_respuestas_encuesta(survey_id: str, fecha_inicio: str = "", fecha_fin: str = "") -> str:
    """
    Descarga y devuelve las respuestas de una encuesta de Qualtrics en un rango de fechas.
    Úsala cuando el usuario quiera ver los resultados/calificaciones de una encuesta específica,
    saber la satisfacción de clientes sobre tickets de atención, o analizar NPS/CSAT.

    Args:
        survey_id: ID de la encuesta (ej. 'SV_xxxxxxxxxxxxxxx').
        fecha_inicio: Fecha de inicio en formato 'YYYY-MM-DD' (opcional, ej. '2026-06-01').
        fecha_fin: Fecha de fin en formato 'YYYY-MM-DD' (opcional, ej. '2026-06-30').
    """
    err = _check_config()
    if err:
        return err

    logger.info(f"[MCP TOOL] obtener_respuestas_encuesta: survey={survey_id}, inicio={fecha_inicio}, fin={fecha_fin}")

    # Paso 1: iniciar exportación
    export_url = f"{QUALTRICS_BASE_URL}/API/v3/surveys/{survey_id}/export-responses"
    payload: dict = {"format": "json"}
    if fecha_inicio:
        payload["startDate"] = f"{fecha_inicio}T00:00:00Z"
    if fecha_fin:
        payload["endDate"] = f"{fecha_fin}T23:59:59Z"

    try:
        resp = requests.post(export_url, headers=_headers(), json=payload, timeout=15)
        if resp.status_code not in (200, 202):
            return f"Error al iniciar exportación: HTTP {resp.status_code} — {resp.text}"
        progress_id = resp.json()["result"]["progressId"]
    except Exception as e:
        return f"Error al iniciar exportación en Qualtrics: {str(e)}"

    # Paso 2: esperar hasta que esté listo (máx 90 s)
    status_url = f"{QUALTRICS_BASE_URL}/API/v3/surveys/{survey_id}/export-responses/{progress_id}"
    file_id = None
    for _ in range(30):
        time.sleep(3)
        try:
            status_resp = requests.get(status_url, headers=_headers(), timeout=15)
            status_data = status_resp.json().get("result", {})
            status = status_data.get("status", "")
            if status == "complete":
                file_id = status_data.get("fileId")
                break
            if status == "failed":
                return f"La exportación de Qualtrics falló: {status_data}"
        except Exception as e:
            return f"Error consultando estado de exportación: {str(e)}"

    if not file_id:
        return "La exportación de Qualtrics tardó demasiado. Inténtalo de nuevo."

    # Paso 3: descargar el archivo ZIP
    file_url = f"{QUALTRICS_BASE_URL}/API/v3/surveys/{survey_id}/export-responses/{file_id}/file"
    try:
        file_resp = requests.get(file_url, headers=_headers(), timeout=30)
        if file_resp.status_code != 200:
            return f"Error descargando archivo de respuestas: HTTP {file_resp.status_code}"

        with zipfile.ZipFile(io.BytesIO(file_resp.content)) as zf:
            json_filename = next((n for n in zf.namelist() if n.endswith(".json")), None)
            if not json_filename:
                return "No se encontró archivo JSON dentro del ZIP de Qualtrics."
            raw = json.loads(zf.read(json_filename))
    except Exception as e:
        return f"Error procesando archivo descargado: {str(e)}"

    responses = raw.get("responses", [])
    if not responses:
        return f"No se encontraron respuestas para la encuesta '{survey_id}' en el rango indicado."

    # Construir resumen legible
    lines = [f"Respuestas de encuesta '{survey_id}' ({len(responses)} total):\n"]
    for idx, r in enumerate(responses[:50], 1):  # limitar a 50 para no saturar el contexto
        values = r.get("values", {})
        embedded = r.get("embeddedData", {})
        lines.append(
            f"[{idx}] ID respuesta: {r.get('responseId')} | "
            f"Fecha: {values.get('recordedDate', '')[:10]} | "
            f"Duración: {values.get('duration', '')}s | "
            f"Datos embebidos: {json.dumps(embedded, ensure_ascii=False)}"
        )
        # Mostrar preguntas respondidas (claves QID)
        preguntas = {k: v for k, v in values.items() if k.startswith("Q") and not k.startswith("QID")}
        if preguntas:
            lines.append(f"   Respuestas: {json.dumps(preguntas, ensure_ascii=False)}")

    if len(responses) > 50:
        lines.append(f"\n... y {len(responses) - 50} respuestas más (usar filtro de fechas para acotar).")

    return "\n".join(lines)


@mcp.tool()
def buscar_respuesta_por_ticket(survey_id: str, ticket_id: str) -> str:
    """
    Busca las respuestas de encuesta de Qualtrics asociadas a un ticket de atención específico.
    Úsala cuando el usuario quiera ver la calificación o feedback de un cliente sobre un ticket concreto.
    Requiere que el ticket_id esté guardado como dato embebido en la encuesta de Qualtrics.

    Args:
        survey_id: ID de la encuesta (ej. 'SV_xxxxxxxxxxxxxxx').
        ticket_id: ID del ticket de SAP C4C (ej. '123456').
    """
    err = _check_config()
    if err:
        return err

    logger.info(f"[MCP TOOL] buscar_respuesta_por_ticket: survey={survey_id}, ticket={ticket_id}")

    # Exportar todas las respuestas sin filtro de fecha y buscar por ticket_id en embeddedData
    export_url = f"{QUALTRICS_BASE_URL}/API/v3/surveys/{survey_id}/export-responses"
    payload = {"format": "json"}

    try:
        resp = requests.post(export_url, headers=_headers(), json=payload, timeout=15)
        if resp.status_code not in (200, 202):
            return f"Error al iniciar exportación: HTTP {resp.status_code} — {resp.text}"
        progress_id = resp.json()["result"]["progressId"]
    except Exception as e:
        return f"Error al iniciar exportación: {str(e)}"

    status_url = f"{QUALTRICS_BASE_URL}/API/v3/surveys/{survey_id}/export-responses/{progress_id}"
    file_id = None
    for _ in range(30):
        time.sleep(3)
        try:
            status_data = requests.get(status_url, headers=_headers(), timeout=15).json().get("result", {})
            if status_data.get("status") == "complete":
                file_id = status_data.get("fileId")
                break
            if status_data.get("status") == "failed":
                return f"Exportación fallida: {status_data}"
        except Exception as e:
            return f"Error consultando estado: {str(e)}"

    if not file_id:
        return "La exportación tardó demasiado. Inténtalo de nuevo."

    file_url = f"{QUALTRICS_BASE_URL}/API/v3/surveys/{survey_id}/export-responses/{file_id}/file"
    try:
        file_resp = requests.get(file_url, headers=_headers(), timeout=30)
        with zipfile.ZipFile(io.BytesIO(file_resp.content)) as zf:
            json_filename = next((n for n in zf.namelist() if n.endswith(".json")), None)
            raw = json.loads(zf.read(json_filename))
    except Exception as e:
        return f"Error procesando respuestas: {str(e)}"

    responses = raw.get("responses", [])
    # Buscar respuestas donde algún campo embebido contenga el ticket_id
    matches = [
        r for r in responses
        if ticket_id in json.dumps(r.get("embeddedData", {}))
        or ticket_id in json.dumps(r.get("values", {}))
    ]

    if not matches:
        return f"No se encontraron respuestas de encuesta vinculadas al ticket '{ticket_id}' en la encuesta '{survey_id}'."

    lines = [f"Respuestas vinculadas al ticket '{ticket_id}':\n"]
    for r in matches:
        values   = r.get("values", {})
        embedded = r.get("embeddedData", {})
        lines.append(f"• ID respuesta: {r.get('responseId')} | Fecha: {values.get('recordedDate', '')[:10]}")
        lines.append(f"  Datos embebidos: {json.dumps(embedded, ensure_ascii=False)}")
        preguntas = {k: v for k, v in values.items() if k.startswith("Q") and not k.startswith("QID")}
        if preguntas:
            lines.append(f"  Respuestas: {json.dumps(preguntas, ensure_ascii=False)}")

    return "\n".join(lines)


@mcp.tool()
def obtener_contactos_directorio_qualtrics(campo_busqueda: str = "", valor_busqueda: str = "") -> str:
    """
    Consulta los contactos del directorio de Qualtrics (XM Directory).
    Úsala para buscar un cliente por email, nombre u otro campo en el directorio de contactos.

    Args:
        campo_busqueda: Campo por el que filtrar (ej. 'email', 'firstName', 'lastName'). Vacío = devuelve los primeros 50.
        valor_busqueda: Valor a buscar en el campo indicado.
    """
    err = _check_config()
    if err:
        return err
    if not QUALTRICS_DIR_ID:
        return "Error: QUALTRICS_DIR_ID no está configurado."

    logger.info(f"[MCP TOOL] obtener_contactos_directorio_qualtrics: {campo_busqueda}={valor_busqueda}")

    url = f"{QUALTRICS_BASE_URL}/API/v3/directories/{QUALTRICS_DIR_ID}/contacts"
    params: dict = {"pageSize": 50}

    try:
        resp = requests.get(url, headers=_headers(), params=params, timeout=15)
        if resp.status_code != 200:
            return f"Error consultando directorio: HTTP {resp.status_code} — {resp.text}"
        contacts = resp.json().get("result", {}).get("elements", [])
    except Exception as e:
        return f"Error conectando con el directorio de Qualtrics: {str(e)}"

    if campo_busqueda and valor_busqueda:
        contacts = [
            c for c in contacts
            if valor_busqueda.lower() in str(c.get(campo_busqueda, "")).lower()
        ]

    if not contacts:
        return "No se encontraron contactos con los criterios indicados."

    lines = [f"Contactos en directorio Qualtrics ({len(contacts)} encontrado(s)):\n"]
    for c in contacts:
        lines.append(
            f"• ID: {c.get('id')} | Email: {c.get('email')} | "
            f"Nombre: {c.get('firstName', '')} {c.get('lastName', '')} | "
            f"Tel: {c.get('phone', '')} | Ext: {json.dumps(c.get('extRef', ''), ensure_ascii=False)}"
        )
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run(transport="stdio")
