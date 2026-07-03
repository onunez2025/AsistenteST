import os
import sys
import time
import logging
import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv
from fastmcp import FastMCP
from typing import Optional

# Setup logging to stderr because stdout is used for MCP stdio protocol communication
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger("mcp-fsm")

# Load environment variables dynamically using absolute paths
current_dir = os.path.dirname(os.path.abspath(__file__))
env_in_backend = os.path.join(current_dir, ".env")
env_in_root = os.path.join(os.path.dirname(current_dir), ".env")

if os.path.exists(env_in_backend):
    load_dotenv(env_in_backend, override=True)
elif os.path.exists(env_in_root):
    load_dotenv(env_in_root, override=True)
else:
    load_dotenv(override=True)

FSM_TOKEN_URL    = os.getenv("FSM_TOKEN_URL", "")
FSM_QUERY_URL    = os.getenv("FSM_QUERY_URL", "")
FSM_CLIENT_ID    = os.getenv("FSM_CLIENT_ID", "")
FSM_CLIENT_SECRET = os.getenv("FSM_CLIENT_SECRET", "")
FSM_ACCOUNT      = os.getenv("FSM_ACCOUNT", "")
FSM_COMPANY      = os.getenv("FSM_COMPANY", "")

mcp = FastMCP("FSM Server")

# ---------------------------------------------------------------------------
# Versiones conocidas de entidades (DTOs) de FSM. La Query API exige indicar
# la versión exacta de cada entidad usada en la consulta (ej. "Activity.39").
# Si el modelo pide una entidad que no está aquí, se le informa el error
# para que use una de las conocidas o pida ayuda al usuario.
# ---------------------------------------------------------------------------
DTO_VERSIONS = {
    "Activity":            39,
    "ActivityCode":        14,
    "Address":             21,
    "Attachment":          18,
    "BusinessPartner":     23,
    "ChecklistInstance":   18,
    "Contact":             17,
    "Equipment":           23,
    "Person":              24,
    "PurchaseOrder":       14,
    "ServiceCall":         26,
    "ServiceCallStatus":   15,
    "ServiceCallType":     15,
    "Skill":               9,
}

# ---------------------------------------------------------------------------
# Autenticación OAuth2 (client_credentials) con caché en memoria del token
# ---------------------------------------------------------------------------
_token_cache = {"access_token": None, "expires_at": 0}

def _get_access_token() -> Optional[str]:
    """Obtiene un access_token de FSM, reutilizando el cacheado si sigue vigente."""
    now = time.time()
    if _token_cache["access_token"] and now < _token_cache["expires_at"] - 60:
        return _token_cache["access_token"]

    if not all([FSM_TOKEN_URL, FSM_CLIENT_ID, FSM_CLIENT_SECRET, FSM_ACCOUNT, FSM_COMPANY]):
        return None

    try:
        resp = requests.post(
            FSM_TOKEN_URL,
            auth=HTTPBasicAuth(FSM_CLIENT_ID, FSM_CLIENT_SECRET),
            data={"grant_type": "client_credentials", "account": FSM_ACCOUNT, "company": FSM_COMPANY},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
        if resp.status_code != 200:
            logger.error(f"Error obteniendo token FSM: {resp.status_code} - {resp.text[:300]}")
            return None
        data = resp.json()
        _token_cache["access_token"] = data.get("access_token")
        _token_cache["expires_at"]   = now + int(data.get("expires_in", 3600))
        return _token_cache["access_token"]
    except Exception as e:
        logger.error(f"Error de conexión al autenticar en FSM: {e}")
        return None


def _fsm_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "X-Client-Id": "SIATC.IA",
        "X-Client-Version": "1.0.0",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _resolve_dtos(entidades: str) -> Optional[str]:
    """Convierte 'Activity,BusinessPartner' en 'Activity.39;BusinessPartner.23' para el parámetro dtos."""
    nombres = [e.strip() for e in entidades.split(",") if e.strip()]
    resueltas = []
    for nombre in nombres:
        version = DTO_VERSIONS.get(nombre)
        if version is None:
            return None
        resueltas.append(f"{nombre}.{version}")
    return ";".join(resueltas)


def is_select_query(query: str) -> bool:
    return query.strip().upper().startswith("SELECT")


@mcp.tool()
def ejecutar_consulta_fsm(consulta_coresql: str, entidades: str) -> str:
    """
    Ejecuta una consulta de solo lectura contra SAP FSM (Field Service Management / Coresuite)
    usando su lenguaje CoreSQL. Úsala para obtener datos de FSM que NO estén ya sincronizados
    en la base de datos SQL principal (ej. detalle en tiempo real de una actividad/servicio de FSM,
    comentarios del técnico, estado actual, técnico asignado, equipo usado).

    REGLAS DE SINTAXIS COREQL (obligatorias):
    - SIEMPRE usa un alias para la entidad principal: "FROM Activity a" (nunca "FROM Activity" solo).
    - Los nombres de campo son sensibles a MAYÚSCULAS/minúsculas y van en camelCase minúsculo
      (ej. a.id, a.subject, a.status, a.code, a.remarks, a.businessPartner, a.equipment,
      a.responsibles, a.startDateTime, a.endDateTime, a.dueDateTime, a.lastChanged,
      a.executionStage, a.statusChangeReason, a.checkedOut, a.object — object.objectId/objectType
      apunta al ServiceCall padre).
    - Usa "SELECT a FROM Activity a WHERE ..." (selecciona el objeto completo) SOLO cuando
      esperas 1 o pocos resultados (ej. filtrando por a.id o a.code). Para listas más largas,
      selecciona columnas específicas: "SELECT a.id, a.code, a.status FROM Activity a WHERE ...".
    - SIEMPRE agrega LIMIT al final para listas (ej. "LIMIT 50"). Nunca hagas SELECT sin WHERE
      ni LIMIT sobre listas completas — la respuesta puede ser gigante y fallar.
    - Fechas en WHERE se comparan como texto ISO: a.lastChanged>='2026-06-01T00:00:00Z'.
    - JOIN entre entidades: "FROM BusinessPartner bp JOIN ServiceCall sc ON bp=sc.businessPartner".
    - Solo se permiten consultas SELECT (de solo lectura). No hay forma de modificar datos por esta vía.

    Entidades (DTOs) disponibles y su versión actual (usa el nombre SIN el número en 'entidades',
    la herramienta agrega la versión automáticamente): Activity, ActivityCode, Address, Attachment,
    BusinessPartner, ChecklistInstance, Contact, Equipment, Person, PurchaseOrder, ServiceCall,
    ServiceCallStatus, ServiceCallType, Skill.

    Args:
        consulta_coresql: La consulta en formato CoreSQL (ver reglas arriba). Debe empezar con SELECT.
        entidades: Nombres de las entidades usadas en la consulta, separados por coma
                   (ej. 'Activity' o 'Activity,BusinessPartner'). Deben coincidir con las
                   entidades listadas en FROM/JOIN.
    """
    logger.info(f"[MCP FSM] ejecutar_consulta_fsm: {consulta_coresql} | entidades={entidades}")

    if not is_select_query(consulta_coresql):
        return "Error: Solo se permiten consultas SELECT de solo lectura en FSM."

    dtos = _resolve_dtos(entidades)
    if dtos is None:
        return (
            f"Error: una o más entidades en '{entidades}' no están en la lista de entidades conocidas "
            f"({', '.join(sorted(DTO_VERSIONS.keys()))}). Verifica el nombre exacto (sensible a mayúsculas)."
        )

    token = _get_access_token()
    if not token:
        return "Error: no se pudo autenticar contra FSM. Verifica las credenciales configuradas (FSM_*)."

    try:
        resp = requests.post(
            FSM_QUERY_URL,
            params={"account": FSM_ACCOUNT, "company": FSM_COMPANY, "dtos": dtos},
            headers=_fsm_headers(token),
            json={"query": consulta_coresql},
            timeout=25,
        )
        if resp.status_code != 200:
            return f"Error al consultar FSM: HTTP {resp.status_code} - {resp.text[:500]}"

        data = resp.json().get("data", [])
        if not data:
            return "La consulta no devolvió resultados en FSM."

        limit = 200
        if len(data) > limit:
            return (
                f"Resultados (primeros {limit} de {len(data)} filas totales — agrega LIMIT más bajo "
                f"o filtros WHERE más específicos):\n{data[:limit]}"
            )
        return str(data)

    except requests.exceptions.Timeout:
        return "Error: la consulta a FSM tardó demasiado (timeout). Intenta acotar más el filtro o el LIMIT."
    except Exception as e:
        logger.error(f"Error en ejecutar_consulta_fsm: {e}")
        return f"Error al ejecutar la consulta en FSM: {str(e)}"


@mcp.tool()
def obtener_actividad_fsm_por_codigo(codigo_actividad: str) -> str:
    """
    Obtiene el detalle completo de una actividad/servicio de FSM por su código visible
    (el número que aparece en el 'subject' de la actividad, ej. '92874', '69290').
    Úsala cuando el usuario pregunte por el estado o detalle en tiempo real de un servicio
    de FSM específico y ya tenga el código a mano. Si no lo encuentra, sugiere usar
    'ejecutar_consulta_fsm' para buscar por otro criterio (ej. cliente, técnico, fecha).

    Args:
        codigo_actividad: El código numérico de la actividad en FSM (campo 'code').
    """
    logger.info(f"[MCP FSM] obtener_actividad_fsm_por_codigo: {codigo_actividad}")

    codigo_limpio = codigo_actividad.strip().replace("'", "")
    query = f"SELECT a FROM Activity a WHERE a.code='{codigo_limpio}'"
    return ejecutar_consulta_fsm(query, "Activity")


if __name__ == "__main__":
    mcp.run()
