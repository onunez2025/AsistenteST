import os
import sys
import logging
import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv
from fastmcp import FastMCP
from azure.storage.blob import BlobServiceClient, ContentSettings

# Setup logging to stderr because stdout is used for MCP stdio protocol communication
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger("mcp-sap-c4c")

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

SAP_BASE_URL = os.getenv("SAP_BASE_URL")
SAP_USER     = os.getenv("SAP_USER")
SAP_PASSWORD = os.getenv("SAP_PASSWORD")

AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_STORAGE_CONTAINER         = os.getenv("AZURE_STORAGE_CONTAINER", "stecnico")

# Initialize FastMCP Server
mcp = FastMCP("SAP C4C Server")

@mcp.tool()
def obtener_ticket_c4c_tiempo_real(ticket_id: str) -> str:
    """
    Consulta en tiempo real el estado de un ticket específico directamente en SAP C4C
    utilizando el API OData. Útil para verificar estados actuales, fechas de creación
    o prioridades directamente de la fuente de origen en SAP.
    
    Args:
        ticket_id: El ID numérico del ticket de SAP C4C (ej. '123456').
    """
    logger.info(f"[MCP TOOL] obtener_ticket_c4c_tiempo_real para ticket: {ticket_id}")
    
    if not SAP_BASE_URL or not SAP_USER or not SAP_PASSWORD:
        return "Error: Las credenciales de SAP C4C no están configuradas en el servidor MCP."
        
    try:
        url = f"{SAP_BASE_URL}/ServiceRequestCollection?$format=json&$filter=ID eq '{ticket_id}'"
        
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        resp = requests.get(
            url, 
            auth=HTTPBasicAuth(SAP_USER, SAP_PASSWORD), 
            headers=headers,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("d", {}).get("results", [])
            if results:
                ticket_data = results[0]
                # Filtrar campos relevantes para evitar sobrecargar el contexto
                filtered_data = {
                    "ID": ticket_data.get("ID"),
                    "Name": ticket_data.get("Name"),
                    "ServiceRequestLifeCycleStatusCode": ticket_data.get("ServiceRequestLifeCycleStatusCode"),
                    "ServiceRequestLifeCycleStatusCodeText": ticket_data.get("ServiceRequestLifeCycleStatusCodeText"),
                    "CreationDateTime": ticket_data.get("CreationDateTime"),
                    "LastChangeDateTime": ticket_data.get("LastChangeDateTime"),
                    "ServicePriorityCode": ticket_data.get("ServicePriorityCode"),
                    "ServicePriorityCodeText": ticket_data.get("ServicePriorityCodeText"),
                    "RequestedFulfillmentPeriodStartDateTime": ticket_data.get("RequestedFulfillmentPeriodStartDateTime"),
                    "RequestedFulfillmentPeriodEndDateTime": ticket_data.get("RequestedFulfillmentPeriodEndDateTime"),
                }
                return f"Datos del Ticket {ticket_id} en SAP C4C en tiempo real:\n{filtered_data}"
            else:
                return f"No se encontró el ticket '{ticket_id}' en SAP C4C."
        else:
            return f"Error al conectar con SAP C4C OData: {resp.status_code} - {resp.text}"
            
    except Exception as e:
        logger.error(f"Error en obtener_ticket_c4c_tiempo_real: {e}")
        return f"Error al consultar SAP C4C en el servidor MCP: {str(e)}"

@mcp.tool()
def consultar_tickets_c4c_por_tienda_y_fecha(tienda_abreviatura: str, fecha_inicio: str, fecha_fin: str) -> str:
    """
    Consulta tickets en SAP C4C vía OData para un lugar de compra/tienda y un rango de fechas de creación.
    Utiliza esta herramienta siempre que te pregunten por tickets de una tienda (ej. Promart, Sodimac, Hiraoka, etc.)
    creados en un rango de fechas.

    Args:
        tienda_abreviatura: Nombre o abreviatura del lugar de compra (ej. 'Promart', 'Sodimac', 'Hiraoka').
        fecha_inicio: Fecha de inicio en formato 'YYYY-MM-DD' (ej. '2026-05-01').
        fecha_fin: Fecha de fin en formato 'YYYY-MM-DD' (ej. '2026-05-31').
    """
    from datetime import datetime
    logger.info(f"[MCP TOOL] consultar_tickets_c4c_por_tienda_y_fecha: {tienda_abreviatura} de {fecha_inicio} a {fecha_fin}")

    if not SAP_BASE_URL or not SAP_USER or not SAP_PASSWORD:
        return "Error: Las credenciales de SAP C4C no están configuradas."

    STORE_MAP = {
        "promart": ["2540", "4"],
        "sodimac": ["3", "3348"],
        "hiraoka": ["3", "2220", "46"],
        "maestro": ["1311", "743", "1498", "2268", "3005", "3008", "3034", "3032"],
        "falabella": ["144", "177", "3101", "3807", "1527", "321", "1389", "1529", "171"],
        "cassinelli": ["2458", "3381", "2457", "309", "293", "303"],
        "ripley": ["3414", "3413", "180", "2548", "181"],
        "calidda": ["3977"],
        "tottus": ["3030", "934", "3046", "2444", "926"],
        "oechsle": ["529", "487", "1836", "3452"],
        "plaza vea": ["511", "149", "131", "143", "133", "3827"]
    }

    name_lower = tienda_abreviatura.lower().strip()
    matched_codes = []
    
    # 1. Look up in predefined map
    for key, codes in STORE_MAP.items():
        if key in name_lower or name_lower in key:
            matched_codes.extend(codes)

    # 2. Dynamic lookup fallback using non-forbidden table GAC_APP_TB_TICKETS
    if not matched_codes:
        logger.info(f"Store '{tienda_abreviatura}' not in predefined map. Performing fallback database lookup...")
        try:
            import pyodbc
            SQL_SERVER = os.getenv("SQL_SERVER")
            SQL_DATABASE = os.getenv("SQL_DATABASE")
            SQL_USER = os.getenv("SQL_USER")
            SQL_PASSWORD = os.getenv("SQL_PASSWORD")
            
            if SQL_SERVER and SQL_DATABASE and SQL_USER and SQL_PASSWORD:
                conn_str = (
                    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                    f"SERVER={SQL_SERVER};"
                    f"DATABASE={SQL_DATABASE};"
                    f"UID={SQL_USER};"
                    f"PWD={SQL_PASSWORD};"
                    f"Encrypt=yes;"
                    f"TrustServerCertificate=no;"
                )
                conn = pyodbc.connect(conn_str)
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT TOP 10 ID_Ticket FROM dbo.GAC_APP_TB_TICKETS WHERE TIENDA LIKE ? AND ID_Ticket IS NOT NULL",
                    (f"%{tienda_abreviatura}%",)
                )
                rows = cursor.fetchall()
                conn.close()

                if rows:
                    headers = {"Accept": "application/json"}
                    auth = HTTPBasicAuth(SAP_USER, SAP_PASSWORD)
                    for r in rows:
                        tid = r[0]
                        url = f"{SAP_BASE_URL}/ServiceRequestCollection?$filter=ID eq '{tid}'&$select=zIDLugarCompra_SDK&$format=json"
                        try:
                            resp = requests.get(url, auth=auth, headers=headers, timeout=5)
                            if resp.status_code == 200:
                                res = resp.json().get('d', {}).get('results', [])
                                if res and res[0].get('zIDLugarCompra_SDK'):
                                    code = res[0].get('zIDLugarCompra_SDK').lstrip('0') or '0'
                                    if code not in matched_codes:
                                        matched_codes.append(code)
                        except Exception as ex:
                            logger.error(f"Error querying OData for ticket {tid}: {ex}")
        except Exception as e:
            logger.error(f"Error in dynamic store lookup: {e}")

    if not matched_codes:
        return f"No se pudo determinar el código de SAP C4C para la tienda/lugar de compra '{tienda_abreviatura}'."

    try:
        # Build filter
        padded_codes = [code.zfill(60) for code in matched_codes]
        lugar_filter = " or ".join([f"zIDLugarCompra_SDK eq '{c}'" for c in padded_codes])
        
        start_dt = f"{fecha_inicio}T00:00:00Z"
        end_dt = f"{fecha_fin}T23:59:59Z"
        
        filter_query = f"CreationDateTime ge datetimeoffset'{start_dt}' and CreationDateTime le datetimeoffset'{end_dt}' and ({lugar_filter})"
        
        url = f"{SAP_BASE_URL}/ServiceRequestCollection?$filter={filter_query}&$select=ID,Name,ServiceRequestLifeCycleStatusCodeText,CreationDateTime,zIDLugarCompra_SDK,zIDEmpresa_SDK,ServicePriorityCodeText&$top=200&$format=json"
        
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        resp = requests.get(
            url,
            auth=HTTPBasicAuth(SAP_USER, SAP_PASSWORD),
            headers=headers,
            timeout=15
        )
        
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("d", {}).get("results", [])
            if results:
                # Format output nicely
                output = [f"Tickets para '{tienda_abreviatura}' ({fecha_inicio} al {fecha_fin}) - Total encontrados en esta vista: {len(results)}:"]
                for t in results:
                    raw_date = t.get("CreationDateTime")
                    date_str = raw_date
                    if raw_date and "/Date(" in raw_date:
                        try:
                            timestamp = int(raw_date.split("(")[1].split(")")[0]) / 1000.0
                            date_str = datetime.utcfromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
                        except:
                            pass
                    
                    output.append(
                        f"- Ticket ID: {t.get('ID')} | Asunto: {t.get('Name')} | Estado: {t.get('ServiceRequestLifeCycleStatusCodeText')} | Creado: {date_str} | Empresa: {t.get('zIDEmpresa_SDK')} | Prioridad: {t.get('ServicePriorityCodeText')}"
                    )
                return "\n".join(output)
            else:
                return f"No se encontraron tickets en SAP C4C para la tienda '{tienda_abreviatura}' en el rango de fechas {fecha_inicio} al {fecha_fin}."
        else:
            return f"Error al conectar con SAP C4C OData: {resp.status_code} - {resp.text}"
            
    except Exception as e:
        logger.error(f"Error en consultar_tickets_c4c_por_tienda_y_fecha: {e}")
        return f"Error al realizar la consulta en SAP C4C: {str(e)}"

@mcp.tool()
def obtener_adjuntos_ticket_c4c(ticket_id: str) -> str:
    """
    Obtiene los archivos adjuntos (PDFs, imágenes, documentos) de un ticket de SAP C4C
    vía OData. Descarga cada archivo usando las credenciales SAP y devuelve enlaces
    públicos directos (sin requerir login de SAP al usuario).
    Úsala cuando el usuario pida el informe técnico, reporte, PDF o cualquier adjunto
    asociado a un ticket de SAP C4C.

    Args:
        ticket_id: El ID numérico del ticket de SAP C4C (ej. '123456').
    """
    logger.info(f"[MCP TOOL] obtener_adjuntos_ticket_c4c para ticket: {ticket_id}")

    if not SAP_BASE_URL or not SAP_USER or not SAP_PASSWORD:
        return "Error: Las credenciales de SAP C4C no están configuradas en el servidor MCP."

    try:
        url = (
            f"{SAP_BASE_URL}/ServiceRequestCollection"
            f"?$filter=ID eq '{ticket_id}'"
            f"&$expand=ServiceRequestAttachmentFolder"
            f"&$format=json"
        )
        headers = {"Accept": "application/json"}
        resp = requests.get(url, auth=HTTPBasicAuth(SAP_USER, SAP_PASSWORD), headers=headers, timeout=15)

        if resp.status_code != 200:
            return f"Error al conectar con SAP C4C OData: {resp.status_code} - {resp.text}"

        results = resp.json().get("d", {}).get("results", [])
        if not results:
            return f"No se encontró el ticket '{ticket_id}' en SAP C4C."

        attachments = results[0].get("ServiceRequestAttachmentFolder", {}).get("results", [])
        if not attachments:
            return f"El ticket '{ticket_id}' no tiene adjuntos registrados en SAP C4C."

        auth      = HTTPBasicAuth(SAP_USER, SAP_PASSWORD)
        lines     = [f"Adjuntos del ticket {ticket_id} ({len(attachments)} archivo(s)):"]

        for a in attachments:
            name     = a.get("Name") or a.get("FileName") or f"adjunto_{ticket_id}"
            mime     = a.get("MimeType") or "application/octet-stream"
            doc_link = a.get("DocumentLink") or a.get("URI") or a.get("FileURL")

            if not doc_link:
                lines.append(f"- **{name}**: sin enlace disponible en OData.")
                continue

            # Descargar el archivo usando credenciales SAP
            try:
                file_resp = requests.get(doc_link, auth=auth, timeout=30)
                if file_resp.status_code != 200:
                    lines.append(f"- **{name}**: error al descargar desde SAP C4C ({file_resp.status_code}).")
                    continue
                file_bytes = file_resp.content
            except Exception as dl_err:
                logger.error(f"Error descargando adjunto '{name}': {dl_err}")
                lines.append(f"- **{name}**: error al descargar — {dl_err}")
                continue

            # Subir a Azure Blob y devolver link público
            if AZURE_STORAGE_CONNECTION_STRING:
                try:
                    safe_name = name.replace(" ", "_")
                    blob_name = f"generated/adjuntos_c4c/{ticket_id}/{safe_name}"
                    blob_client = BlobServiceClient.from_connection_string(
                        AZURE_STORAGE_CONNECTION_STRING
                    ).get_blob_client(container=AZURE_STORAGE_CONTAINER, blob=blob_name)
                    blob_client.upload_blob(
                        file_bytes, overwrite=True,
                        content_settings=ContentSettings(content_type=mime)
                    )
                    public_url = blob_client.url
                    lines.append(f"- **{name}**: [Abrir PDF]({public_url})")
                except Exception as up_err:
                    logger.error(f"Error subiendo adjunto '{name}' a Azure Blob: {up_err}")
                    lines.append(f"- **{name}**: descargado pero error al publicar — {up_err}")
            else:
                # Sin Azure: devolver el link original como fallback
                lines.append(f"- **{name}** ({mime}): {doc_link}  *(requiere sesión SAP activa)*")

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"Error en obtener_adjuntos_ticket_c4c: {e}")
        return f"Error al consultar adjuntos en SAP C4C: {str(e)}"


if __name__ == "__main__":
    mcp.run()
