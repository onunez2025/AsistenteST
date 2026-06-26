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
            logger.error(f"Qualtrics GET {response_id} -> HTTP {r.status_code}: {r.text[:200]}")
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
