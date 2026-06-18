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
    Obtiene el informe técnico en PDF de un ticket de SAP C4C vía OData.
    Navega por ObjectID → ServiceRequestAttachmentFolder → Binary/$value para
    descargar el binario con credenciales SAP y devolver un enlace público directo.
    Úsala cuando el usuario pida el informe técnico, reporte, PDF o adjunto de un ticket C4C.

    Args:
        ticket_id: El ID numérico del ticket de SAP C4C (ej. '123456').
    """
    logger.info(f"[MCP TOOL] obtener_adjuntos_ticket_c4c para ticket: {ticket_id}")

    if not SAP_BASE_URL or not SAP_USER or not SAP_PASSWORD:
        return "Error: Las credenciales de SAP C4C no están configuradas en el servidor MCP."

    auth = HTTPBasicAuth(SAP_USER, SAP_PASSWORD)

    try:
        # 1. Obtener el ticket por ID para extraer su ObjectID
        search_url = f"{SAP_BASE_URL}/ServiceRequestCollection?$filter=ID eq '{ticket_id}'&$format=json"
        resp = requests.get(search_url, auth=auth, timeout=15)
        if resp.status_code != 200:
            return f"Error al conectar con SAP C4C OData: {resp.status_code} - {resp.text[:200]}"

        results = resp.json().get("d", {}).get("results", [])
        if not results:
            return f"No se encontró el ticket '{ticket_id}' en SAP C4C."

        ticket     = results[0]
        object_id  = ticket.get("ObjectID")
        if not object_id:
            return f"El ticket '{ticket_id}' no tiene ObjectID en SAP C4C."

        # 2. Obtener adjuntos navegando desde el ObjectID
        attachment_url = f"{SAP_BASE_URL}/ServiceRequestCollection('{object_id}')/ServiceRequestAttachmentFolder?$format=json"
        att_resp = requests.get(attachment_url, auth=auth, timeout=15)
        if att_resp.status_code != 200:
            return f"Error al obtener adjuntos de C4C: {att_resp.status_code} - {att_resp.text[:200]}"

        attachments = att_resp.json().get("d", {}).get("results", [])
        if not attachments:
            return f"El ticket '{ticket_id}' no tiene adjuntos registrados en SAP C4C."

        # 3. Priorizar PDF con "informe" o "report" en el nombre; fallback a cualquier PDF
        pdf_report = next(
            (a for a in attachments
             if a.get("MimeType") == "application/pdf"
             and ("informe" in (a.get("Name") or "").lower() or "report" in (a.get("Name") or "").lower())),
            None
        )
        if not pdf_report:
            pdf_report = next((a for a in attachments if a.get("MimeType") == "application/pdf"), None)
        if not pdf_report:
            names = [a.get("Name", "sin nombre") for a in attachments]
            return f"El ticket '{ticket_id}' tiene {len(attachments)} adjunto(s) pero ninguno es PDF. Archivos: {', '.join(names)}"

        att_object_id = pdf_report.get("ObjectID")
        att_name      = pdf_report.get("Name") or f"informe_{ticket_id}.pdf"

        # 4. Descargar el binario vía Binary/$value
        binary_url = f"{SAP_BASE_URL}/ServiceRequestAttachmentFolderCollection('{att_object_id}')/Binary/$value"
        pdf_resp   = requests.get(binary_url, auth=auth, timeout=30)
        if pdf_resp.status_code != 200:
            return f"Error al descargar el PDF desde C4C: {pdf_resp.status_code} - {pdf_resp.text[:200]}"

        file_bytes = pdf_resp.content

        # 5. Subir a Azure Blob y devolver link público
        if AZURE_STORAGE_CONNECTION_STRING:
            try:
                safe_name  = att_name.replace(" ", "_")
                blob_name  = f"generated/adjuntos_c4c/{ticket_id}/{safe_name}"
                blob_client = BlobServiceClient.from_connection_string(
                    AZURE_STORAGE_CONNECTION_STRING
                ).get_blob_client(container=AZURE_STORAGE_CONTAINER, blob=blob_name)
                blob_client.upload_blob(
                    file_bytes, overwrite=True,
                    content_settings=ContentSettings(content_type="application/pdf")
                )
                public_url = blob_client.url
                return f"Informe técnico del ticket {ticket_id} — **{att_name}**\n[EmbedPDF:{public_url}]"
            except Exception as up_err:
                logger.error(f"Error subiendo PDF a Azure Blob: {up_err}")
                return f"PDF descargado correctamente pero error al publicar en Azure: {up_err}"
        else:
            return f"PDF descargado ({len(file_bytes)} bytes) pero AZURE_STORAGE_CONNECTION_STRING no está configurada."

    except Exception as e:
        logger.error(f"Error en obtener_adjuntos_ticket_c4c: {e}")
        return f"Error al obtener el informe técnico de SAP C4C: {str(e)}"


@mcp.tool()
def analizar_cambio_tipo_servicio_cas(
    cas_nombre: str,
    tipo_servicio_final_like: str,
    tipo_servicio_inicial_like: str,
    fecha_inicio: str = "",
    fecha_fin: str = "",
) -> str:
    """
    Detecta tickets donde el tipo de servicio fue cambiado entre C4C (tipo inicial) y FSM (tipo final).
    Útil para identificar malas prácticas de un CAS que cambia el tipo de servicio para cerrar tickets
    como SI-SI cuando no corresponde (ej. cambiar INSTALACIÓN a VERIFICACIÓN DE ÁREA).

    Cruza dos fuentes:
    - Tipo de servicio FINAL → FSM/SQL: campo 'Servicio' en ServiciosViewSQL.
    - Tipo de servicio INICIAL → SAP C4C OData: campo 'ServiceTermsServiceIssueName'.

    Devuelve conteo por día y muestra de tickets afectados con técnico asignado.

    Args:
        cas_nombre:                 Nombre o parte del CAS (ej. 'FAZZIO').
        tipo_servicio_final_like:   Patrón del tipo FINAL en FSM  (ej. 'VERIF' para VERIFICACIÓN).
        tipo_servicio_inicial_like: Patrón del tipo INICIAL en C4C (ej. 'INSTAL' para INSTALACIÓN).
        fecha_inicio: Fecha de visita inicio 'YYYY-MM-DD'. Vacío = sin límite inferior.
        fecha_fin:    Fecha de visita fin   'YYYY-MM-DD'. Vacío = sin límite superior.
    """
    if not SAP_BASE_URL or not SAP_USER or not SAP_PASSWORD:
        return "Error: credenciales SAP C4C no configuradas."

    logger.info(f"[MCP TOOL] analizar_cambio_tipo_servicio_cas: cas={cas_nombre} final~{tipo_servicio_final_like} inicial~{tipo_servicio_inicial_like} {fecha_inicio}→{fecha_fin}")

    # ── PASO 1: SQL → tickets del CAS con tipo de servicio FINAL coincidente ──
    import pyodbc
    SQL_SERVER_   = os.getenv("SQL_SERVER")
    SQL_DATABASE_ = os.getenv("SQL_DATABASE")
    SQL_USER_     = os.getenv("SQL_USER")
    SQL_PASSWORD_ = os.getenv("SQL_PASSWORD")

    if not all([SQL_SERVER_, SQL_DATABASE_, SQL_USER_, SQL_PASSWORD_]):
        return "Error: credenciales SQL no configuradas."

    try:
        conn_str = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={SQL_SERVER_};DATABASE={SQL_DATABASE_};"
            f"UID={SQL_USER_};PWD={SQL_PASSWORD_};"
            f"Encrypt=yes;TrustServerCertificate=no;"
        )
        conn   = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        date_filter = ""
        params = [f"%{cas_nombre}%", f"%{tipo_servicio_final_like}%"]
        if fecha_inicio:
            date_filter += " AND FechaVisita >= ?"
            params.append(fecha_inicio)
        if fecha_fin:
            date_filter += " AND FechaVisita <= ?"
            params.append(fecha_fin)

        sql = f"""
            SELECT
                Ticket,
                Servicio            AS ServicioFSM,
                CAST(FechaVisita AS DATE) AS FechaVisita,
                ISNULL(NombreTecnico,'') + ' ' + ISNULL(ApellidoTecnico,'') AS Tecnico
            FROM [APPGAC].[ServiciosViewSQL]
            WHERE CAS LIKE ?
              AND Servicio LIKE ?
              AND Ticket IS NOT NULL
              AND Ticket <> ''
              {date_filter}
            ORDER BY FechaVisita DESC
        """
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        return f"Error al consultar SQL: {str(e)}"

    if not rows:
        return (
            f"No se encontraron tickets de '{cas_nombre}' con tipo de servicio FSM LIKE '%{tipo_servicio_final_like}%' "
            f"en el período indicado."
        )

    # ── PASO 2: C4C OData → tipo de servicio INICIAL por lotes de 30 ──
    ticket_map = {str(r[0]).strip(): {"fsm": r[1], "fecha": str(r[2]), "tecnico": r[3].strip()} for r in rows}
    ticket_ids = list(ticket_map.keys())

    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    auth    = HTTPBasicAuth(SAP_USER, SAP_PASSWORD)
    c4c_types: dict = {}  # ticket_id → ServiceTermsServiceIssueName

    BATCH = 30
    for i in range(0, len(ticket_ids), BATCH):
        lote = ticket_ids[i : i + BATCH]
        filter_expr = " or ".join(f"ID eq '{tid}'" for tid in lote)
        url = (
            f"{SAP_BASE_URL}/ServiceRequestCollection"
            f"?$filter={filter_expr}"
            f"&$select=ID,ServiceTermsServiceIssueName"
            f"&$format=json&$top={BATCH}"
        )
        try:
            resp = requests.get(url, auth=auth, headers=headers, timeout=15)
            if resp.status_code == 200:
                for item in resp.json().get("d", {}).get("results", []):
                    c4c_types[str(item.get("ID", "")).strip()] = item.get("ServiceTermsServiceIssueName", "")
        except Exception as e:
            logger.error(f"Error consultando lote C4C: {e}")

    # ── PASO 3: cruzar — quedarse solo con los que cambiaron ──
    inicial_lower = tipo_servicio_inicial_like.lower()
    cambios = []
    for tid, info in ticket_map.items():
        tipo_inicial = c4c_types.get(tid, "")
        if inicial_lower in tipo_inicial.lower():
            cambios.append({
                "ticket":         tid,
                "fecha":          info["fecha"],
                "tipo_inicial":   tipo_inicial,
                "tipo_final":     info["fsm"],
                "tecnico":        info["tecnico"],
            })

    if not cambios:
        return (
            f"No se encontraron tickets de '{cas_nombre}' que hayan cambiado de "
            f"'{tipo_servicio_inicial_like}' (C4C) a '{tipo_servicio_final_like}' (FSM) "
            f"en el período indicado.\n"
            f"Tickets evaluados con tipo FSM coincidente: {len(ticket_ids)} | "
            f"Tipos C4C recuperados: {len(c4c_types)}"
        )

    # ── PASO 4: agrupar por día ──
    por_dia: dict = {}
    for c in cambios:
        por_dia.setdefault(c["fecha"], []).append(c)

    lines = [
        f"CAMBIOS DE TIPO DE SERVICIO — {cas_nombre.upper()}",
        f"  C4C (inicial) LIKE '%{tipo_servicio_inicial_like}%'  →  FSM (final) LIKE '%{tipo_servicio_final_like}%'",
        f"  Período: {fecha_inicio or 'inicio'} → {fecha_fin or 'hoy'}",
        f"  Total casos detectados: {len(cambios)} de {len(ticket_ids)} tickets evaluados\n",
        f"{'Fecha':<12} {'Casos':>5}   Tickets",
        "─" * 70,
    ]
    for fecha in sorted(por_dia.keys(), reverse=True):
        casos = por_dia[fecha]
        ids_str = ", ".join(c["ticket"] for c in casos[:8])
        sufijo  = f"  (+{len(casos)-8} más)" if len(casos) > 8 else ""
        lines.append(f"{fecha:<12} {len(casos):>5}   {ids_str}{sufijo}")

    lines.append("\nDetalle de casos (primeros 20):")
    lines.append(f"{'Ticket':<10} {'Fecha':<12} {'Tipo C4C (inicial)':<35} {'Tipo FSM (final)':<30} Técnico")
    lines.append("─" * 110)
    for c in cambios[:20]:
        lines.append(
            f"{c['ticket']:<10} {c['fecha']:<12} {c['tipo_inicial'][:34]:<35} {c['tipo_final'][:29]:<30} {c['tecnico']}"
        )
    if len(cambios) > 20:
        lines.append(f"... y {len(cambios) - 20} caso(s) más.")

    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run()
