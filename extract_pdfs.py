import requests
import os
import time
import base64
import pyodbc
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- CONFIGURATION ---
BASE_URL = os.getenv("SAP_BASE_URL", "https://my361897.crm.ondemand.com/sap/c4c/odata/v1/c4codataapi")
USER = os.getenv("SAP_USER")
PASSWORD = os.getenv("SAP_PASSWORD")
DOWNLOAD_ROOT = "Descargas_FSM_Febrero"
LOG_FILE = "log_errores.txt"
TICKETS_FILE = "tickets.txt"

# SQL Azure Configuration
SQL_SERVER = os.getenv("SQL_SERVER")
SQL_DATABASE = os.getenv("SQL_DATABASE")
SQL_USER = os.getenv("SQL_USER")
SQL_PASSWORD = os.getenv("SQL_PASSWORD")

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json"
}

def setup():
    if not os.path.exists(DOWNLOAD_ROOT):
        os.makedirs(DOWNLOAD_ROOT)
    
    if not USER or not PASSWORD:
        print("[ERROR] Credenciales SAP no encontradas en el archivo .env")
        return False
    return True

def get_sql_mapping():
    """Fetches Ticket, Servicio, NumeroCalle, and Calle (for folder name) from SQL View."""
    mapping = {}
    conn_str = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={SQL_SERVER};"
        f"DATABASE={SQL_DATABASE};"
        f"UID={SQL_USER};"
        f"PWD={SQL_PASSWORD};"
    )
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        print("[*] Obteniendo mapeo de nombres y carpetas (por Calle) desde [APPGAC].[ServiciosViewSQL]...")
        cursor.execute("SELECT Ticket, Servicio, NumeroCalle, Calle FROM [APPGAC].[ServiciosViewSQL]")
        for row in cursor.fetchall():
            ticket = str(row.Ticket).strip()
            servicio = str(row.Servicio or "").strip()
            numero_calle = str(row.NumeroCalle or "").strip()
            calle_folder = str(row.Calle or "Sin_Calle").strip()
            
            # Clean filename-unsafe characters for the file
            filename = f"{ticket}{servicio}{numero_calle}".replace("/", "-").replace("\\", "-").replace(":", "-").replace("*", "").replace("?", "").replace("\"", "").replace("<", "").replace(">", "").replace("|", "")
            
            # Clean filename-unsafe characters for the folder
            folder_clean = calle_folder.replace("/", "-").replace("\\", "-").replace(":", "-").replace("*", "").replace("?", "").replace("\"", "").replace("<", "").replace(">", "").replace("|", "")
            
            mapping[ticket] = {
                "filename": filename,
                "folder": folder_clean
            }
            
        cursor.close()
        conn.close()
        print(f"[*] Mapeo cargado para {len(mapping)} tickets.")
    except Exception as e:
        print(f"[ERROR] No se pudo obtener el mapeo SQL: {e}")
    return mapping

def log_error(ticket_id, message):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Ticket {ticket_id}: {message}\n")
    print(f"[ERROR] Ticket {ticket_id}: {message}")

def get_attachments(session, ticket_id):
    url = f"{BASE_URL}/ServiceRequestCollection?$filter=ID eq '{ticket_id}'&$expand=ServiceRequestAttachmentFolder&$format=json"
    try:
        response = session.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        results = response.json().get("d", {}).get("results", [])
        
        if results:
            raw_folder = results[0].get("ServiceRequestAttachmentFolder", [])
            if isinstance(raw_folder, dict):
                return raw_folder.get("results", [])
            return raw_folder
        return None
    except Exception as e:
        log_error(ticket_id, f"Fallo al obtener adjuntos: {str(e)}")
        return None

def download_pdf(attachments, ticket_id, mapping_data):
    try:
        custom_filename = mapping_data["filename"]
        target_folder = os.path.join(DOWNLOAD_ROOT, mapping_data["folder"])
        
        if not os.path.exists(target_folder):
            os.makedirs(target_folder)

        pdf_found = False
        for att in attachments:
            name = att.get("Name", "")
            mime = att.get("MimeType", "")
            
            if ".pdf" in name.lower() or "pdf" in mime.lower():
                binary_data = att.get("Binary")
                
                if not binary_data and "__metadata" in att:
                    media_url = att["__metadata"].get("media_src")
                    if media_url:
                        media_resp = requests.get(media_url, auth=HTTPBasicAuth(USER, PASSWORD), headers=HEADERS)
                        media_resp.raise_for_status()
                        binary_data = base64.b64encode(media_resp.content).decode('utf-8')

                if binary_data:
                    file_path = os.path.join(target_folder, f"{custom_filename}.pdf")
                    with open(file_path, "wb") as f:
                        f.write(base64.b64decode(binary_data))
                    print(f"[OK] Ticket {ticket_id}: Guardado en /{mapping_data['folder']}/{custom_filename}.pdf")
                    pdf_found = True
                    break 
        
        if not pdf_found:
            log_error(ticket_id, "No se encontró archivo PDF adjunto.")
            
    except Exception as e:
        log_error(ticket_id, f"Error al descargar: {str(e)}")

def main():
    print("--- SCRAPER DE INFORMES TÉCNICOS SAP C4C (ORGANIZADO POR CALLE) ---")
    if not setup():
        return

    mapping = get_sql_mapping()

    with open(TICKETS_FILE, "r", encoding="utf-8-sig") as f:
        tickets = [line.strip() for line in f if line.strip() and not line.startswith("#")]

    if not tickets:
        print("[!] No se encontraron IDs de tickets en " + TICKETS_FILE)
        return

    print(f"[*] Iniciando extracción de {len(tickets)} tickets...")
    
    session = requests.Session()
    session.auth = HTTPBasicAuth(USER, PASSWORD)

    for i, ticket_id in enumerate(tickets):
        print(f"[{i+1}/{len(tickets)}] Procesando Ticket: {ticket_id}...", end="\r")
        
        # Get mapping data or fallback
        m_data = mapping.get(ticket_id)
        if not m_data:
            # Fallback if ticket not in view
            m_data = {"filename": f"Ticket_{ticket_id}", "folder": "Sin_Mapeo"}
            
        file_path = os.path.join(DOWNLOAD_ROOT, m_data["folder"], f"{m_data['filename']}.pdf")
        
        if os.path.exists(file_path):
            continue
            
        attachments = get_attachments(session, ticket_id)
        if attachments:
            download_pdf(attachments, ticket_id, m_data)
        else:
            log_error(ticket_id, "Sin adjuntos encontrados o Ticket no existe.")
        
        time.sleep(0.3)
    
    print("\n--- PROCESO FINALIZADO ---")

if __name__ == "__main__":
    main()
