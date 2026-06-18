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


def _exportar_respuestas(survey_id: str) -> list | str:
    """Helper interno: descarga TODAS las respuestas de una encuesta sin filtro de fecha."""
    try:
        resp = requests.post(
            f"{QUALTRICS_BASE_URL}/API/v3/surveys/{survey_id}/export-responses",
            headers=_headers(), json={"format": "json"}, timeout=30
        )
        if resp.status_code not in (200, 202):
            return f"Error al iniciar exportación: HTTP {resp.status_code} — {resp.text}"
        progress_id = resp.json()["result"]["progressId"]
    except Exception as e:
        return f"Error iniciando exportación: {str(e)}"

    status_url = f"{QUALTRICS_BASE_URL}/API/v3/surveys/{survey_id}/export-responses/{progress_id}"
    file_id = None
    for _ in range(40):
        time.sleep(3)
        try:
            st = requests.get(status_url, headers=_headers(), timeout=30).json().get("result", {})
            if st.get("status") == "complete":
                file_id = st.get("fileId")
                break
            if st.get("status") == "failed":
                return f"Exportación fallida: {st}"
        except Exception:
            continue

    if not file_id:
        return "La exportación tardó demasiado. Inténtalo de nuevo."

    try:
        file_resp = requests.get(
            f"{QUALTRICS_BASE_URL}/API/v3/surveys/{survey_id}/export-responses/{file_id}/file",
            headers=_headers(), timeout=60
        )
        with zipfile.ZipFile(io.BytesIO(file_resp.content)) as zf:
            fname = next((n for n in zf.namelist() if n.endswith(".json")), None)
            return json.loads(zf.read(fname)).get("responses", [])
    except Exception as e:
        return f"Error procesando archivo: {str(e)}"


from datetime import date as _date


def _parse_fecha_visita(raw: str) -> _date | None:
    """Convierte 'DD/MM/YYYY' o 'DD/MM/YYYY HH:MM' a date. Devuelve None si no puede."""
    if not raw or raw in ("NULL", "None", ""):
        return None
    try:
        return _date.fromisoformat(raw[:10].replace("/", "-")[::-1].replace("-", "/").split("/")[2]
                                   + "-" + raw[:10].split("/")[1] + "-" + raw[:10].split("/")[0])
    except Exception:
        return None


def _filtrar_por_fecha_visita(responses: list, fecha_inicio: str, fecha_fin: str) -> list:
    """Filtra respuestas por el campo FECHA_DE_VISITA (DD/MM/YYYY) del ticket."""
    try:
        d_ini = _date.fromisoformat(fecha_inicio) if fecha_inicio else None
        d_fin = _date.fromisoformat(fecha_fin)     if fecha_fin     else None
    except ValueError:
        return responses  # si el formato es inválido, no filtrar

    resultado = []
    for r in responses:
        raw = str(r.get("values", {}).get("FECHA_DE_VISITA", "") or "")
        # Formato esperado: DD/MM/YYYY o DD/MM/YYYY HH:MM
        partes = raw.strip().split(" ")[0].split("/")
        if len(partes) != 3:
            continue
        try:
            d = _date(int(partes[2]), int(partes[1]), int(partes[0]))
        except ValueError:
            continue
        if d_ini and d < d_ini:
            continue
        if d_fin and d > d_fin:
            continue
        resultado.append(r)
    return resultado


def _calcular_nps_stats(filtered: list, empresa: str, fecha_inicio: str, fecha_fin: str) -> str:
    """Genera el texto de resultado NPS a partir de una lista de respuestas ya filtrada."""
    if not filtered:
        return f"No se encontraron encuestas para '{empresa}' entre {fecha_inicio or 'inicio'} y {fecha_fin or 'hoy'}."

    promotores  = sum(1 for r in filtered if r.get("values", {}).get("QID9_NPS_GROUP") == 3)
    pasivos     = sum(1 for r in filtered if r.get("values", {}).get("QID9_NPS_GROUP") == 2)
    detractores = sum(1 for r in filtered if r.get("values", {}).get("QID9_NPS_GROUP") == 1)
    total       = len(filtered)
    nps         = round(((promotores - detractores) / total) * 100, 1) if total else 0

    scores = [r.get("values", {}).get("QID9") for r in filtered if r.get("values", {}).get("QID9") is not None]
    score_dist = {i: scores.count(i) for i in range(11) if scores.count(i) > 0}

    aspect_counts: dict = {}
    for r in filtered:
        aspects = r.get("labels", {}).get("QID12", [])
        if isinstance(aspects, list):
            for a in aspects:
                aspect_counts[a] = aspect_counts.get(a, 0) + 1
        elif isinstance(aspects, str):
            aspect_counts[aspects] = aspect_counts.get(aspects, 0) + 1
    top_aspects = sorted(aspect_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    lines = [
        f"NPS — {empresa.upper()} | Fecha de visita: {fecha_inicio or 'inicio'} → {fecha_fin or 'hoy'}",
        f"(Filtrado por FECHA_DE_VISITA del ticket, no por fecha de respuesta)",
        f"",
        f"Total encuestas : {total}",
        f"Promotores  (9-10): {promotores} ({round(promotores/total*100,1) if total else 0}%)",
        f"Pasivos     (7-8) : {pasivos} ({round(pasivos/total*100,1) if total else 0}%)",
        f"Detractores (0-6) : {detractores} ({round(detractores/total*100,1) if total else 0}%)",
        f"",
        f"NPS = ({promotores} - {detractores}) / {total} × 100 = {nps}",
        f"",
        f"Distribución de calificaciones:",
    ]
    for score in range(10, -1, -1):
        cnt = score_dist.get(score, 0)
        if cnt:
            lines.append(f"  {score:>2}: {'█' * min(cnt, 40)} {cnt}")
    if top_aspects:
        lines.append(f"\nAspectos más destacados:")
        for aspect, cnt in top_aspects:
            lines.append(f"  • {aspect}: {cnt} veces")
    return "\n".join(lines)


@mcp.tool()
def calcular_nps_por_empresa(
    survey_id: str,
    empresa: str,
    fecha_inicio: str = "",
    fecha_fin: str = "",
) -> str:
    """
    Calcula el NPS de una empresa/CAS específica filtrando por FECHA_DE_VISITA del ticket.
    El filtro de fechas se aplica sobre el campo FECHA_DE_VISITA (fecha en que se realizó la visita
    técnica), NO sobre la fecha en que el cliente respondió la encuesta.
    Fórmula: NPS = ((Promotores - Detractores) / Total) × 100
    - Promotores: calificación 9-10
    - Pasivos:    calificación 7-8
    - Detractores: calificación 0-6

    Úsala cuando el usuario pida el NPS de un CAS o empresa en un período determinado.

    Args:
        survey_id:    ID de la encuesta. La encuesta de Servicio Técnico es 'SV_abEHkdGNsG9a3EG'.
        empresa:      Nombre o abreviatura del CAS (ej. 'VYA', 'SB2', 'SILAR', 'EMSS').
                      Coincidencia parcial, sin distinción de mayúsculas.
        fecha_inicio: Fecha de inicio de visita en formato 'YYYY-MM-DD' (ej. '2026-06-01').
        fecha_fin:    Fecha de fin   de visita en formato 'YYYY-MM-DD' (ej. '2026-06-30').
    """
    err = _check_config()
    if err:
        return err

    logger.info(f"[MCP TOOL] calcular_nps_por_empresa: survey={survey_id} empresa={empresa} {fecha_inicio}→{fecha_fin}")

    responses = _exportar_respuestas(survey_id)
    if isinstance(responses, str):
        return responses

    # 1. Filtrar por FECHA_DE_VISITA
    by_date = _filtrar_por_fecha_visita(responses, fecha_inicio, fecha_fin)

    # 2. Filtrar por empresa
    empresa_lower = empresa.lower().strip()
    filtered = [
        r for r in by_date
        if empresa_lower in str(r.get("values", {}).get("EMPRESA", "")).lower()
    ]

    if not filtered:
        return (
            f"No se encontraron encuestas para '{empresa}' con FECHA_DE_VISITA entre "
            f"{fecha_inicio or 'inicio'} y {fecha_fin or 'hoy'}.\n"
            f"Total respuestas en ese período (todas las empresas): {len(by_date)}"
        )

    return _calcular_nps_stats(filtered, empresa, fecha_inicio, fecha_fin)


@mcp.tool()
def calcular_nps_comparativo(
    survey_id: str,
    fecha_inicio: str,
    fecha_fin: str,
) -> str:
    """
    Calcula y compara el NPS de TODAS las empresas/CAS en un rango de fechas, ordenadas de mayor a menor NPS.
    El filtro de fechas se aplica sobre FECHA_DE_VISITA del ticket, no sobre la fecha de respuesta del cliente.
    Úsala cuando el usuario quiera ver un ranking de NPS de todos los CAS o empresas para un período.

    Args:
        survey_id:    ID de la encuesta. La encuesta de Servicio Técnico es 'SV_abEHkdGNsG9a3EG'.
        fecha_inicio: Fecha de inicio de visita en formato 'YYYY-MM-DD' (ej. '2026-06-01').
        fecha_fin:    Fecha de fin   de visita en formato 'YYYY-MM-DD' (ej. '2026-06-30').
    """
    err = _check_config()
    if err:
        return err

    logger.info(f"[MCP TOOL] calcular_nps_comparativo: survey={survey_id} {fecha_inicio}→{fecha_fin}")

    responses = _exportar_respuestas(survey_id)
    if isinstance(responses, str):
        return responses

    # Filtrar por FECHA_DE_VISITA del ticket
    by_date = _filtrar_por_fecha_visita(responses, fecha_inicio, fecha_fin)

    if not by_date:
        return f"No se encontraron encuestas con FECHA_DE_VISITA entre {fecha_inicio} y {fecha_fin}."

    # Agrupar por EMPRESA
    empresas: dict = {}
    for r in by_date:
        vals    = r.get("values", {})
        empresa = str(vals.get("EMPRESA", "SIN EMPRESA")).strip()
        if not empresa or empresa in ("None", "NULL", ""):
            empresa = "SIN EMPRESA"
        if empresa not in empresas:
            empresas[empresa] = {"promotores": 0, "pasivos": 0, "detractores": 0, "total": 0}
        grupo = vals.get("QID9_NPS_GROUP")
        empresas[empresa]["total"] += 1
        if grupo == 3:
            empresas[empresa]["promotores"] += 1
        elif grupo == 2:
            empresas[empresa]["pasivos"] += 1
        elif grupo == 1:
            empresas[empresa]["detractores"] += 1

    ranking = []
    for emp, d in empresas.items():
        t = d["total"]
        nps = round(((d["promotores"] - d["detractores"]) / t) * 100, 1) if t else 0
        ranking.append((emp, nps, d["promotores"], d["pasivos"], d["detractores"], t))
    ranking.sort(key=lambda x: x[1], reverse=True)

    total_global = len(by_date)
    lines = [
        f"RANKING NPS por CAS/Empresa | Fecha de visita: {fecha_inicio} → {fecha_fin}",
        f"(Filtrado por FECHA_DE_VISITA del ticket)",
        f"Total encuestas en período: {total_global}\n",
        f"{'#':<3} {'Empresa':<30} {'NPS':>6} {'Prom':>5} {'Pas':>5} {'Det':>5} {'Total':>6}",
        "-" * 65,
    ]
    for i, (emp, nps, prom, pas, det, tot) in enumerate(ranking, 1):
        lines.append(f"{i:<3} {emp:<30} {nps:>6.1f} {prom:>5} {pas:>5} {det:>5} {tot:>6}")

    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run(transport="stdio")
