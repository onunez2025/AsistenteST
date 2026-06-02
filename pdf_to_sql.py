import os
import re
import logging
import pyodbc
import fitz  # PyMuPDF
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- CONFIGURATION ---
DOWNLOAD_ROOT = "Descargas_FSM_Febrero"
LOG_FILE = "log_pdf_parsing.txt"

# SQL Azure Configuration
SQL_SERVER = os.getenv("SQL_SERVER")
SQL_DATABASE = os.getenv("SQL_DATABASE")
SQL_USER = os.getenv("SQL_USER")
SQL_PASSWORD = os.getenv("SQL_PASSWORD")

# --- LOGGING SETUP ---
def log_message(message, level="INFO"):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{level}] {message}"
    print(log_line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_line + "\n")

# --- PDF PARSING LOGIC ---
def extract_data_from_pdf(pdf_path):
    """Extracts required fields from a technical report PDF."""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()

        # Extract Ticket ID (Starts with digits in the filename)
        filename = os.path.basename(pdf_path)
        ticket_match = re.search(r"^(\d+)", filename)
        ticket = ticket_match.group(1) if ticket_match else None

        if not ticket:
            log_message(f"No se pudo extraer el Ticket del nombre de archivo: {filename}", "WARNING")
            return None

        # Helper to extract value after a label
        def get_value(label, default=None):
            pattern = re.escape(label) + r"\s*\n\s*(.*)"
            match = re.search(pattern, text)
            return match.group(1).strip() if match else default

        visita = get_value("Visita realizada ?")
        trabajo = get_value("Trabajo efectuado ?")
        solicita = get_value("Solicita nueva visita ?")
        motivo = get_value("Motivo de no atención")

        comentario = None
        obs_match = re.search(r"Observaciones del técnico\s*\n\s*(.*?)(?=\n\s*(Aut\. uso|Firma|Fotos|$))", text, re.DOTALL)
        if obs_match:
            comentario = obs_match.group(1).strip()

        # Convert to 'true'/'false'
        visita_bool = "true" if visita == "SI" else ("false" if visita == "NO" else None)
        trabajo_bool = "true" if trabajo == "SI" else ("false" if trabajo == "NO" else None)
        solicita_bool = "true" if solicita == "SI_VISITA" else ("false" if solicita == "NO_VISITA" else None)

        return {
            'Ticket': ticket,
            'VisitaRealizada': visita_bool,
            'TrabajoRealizado': trabajo_bool,
            'SolicitaNuevaVisita': solicita_bool,
            'MotivoNuevaVisita': motivo,
            'ComentarioTecnico': comentario
        }
    except Exception as e:
        log_message(f"Error parseando PDF {pdf_path}: {e}", "ERROR")
        return None

# --- DATABASE OPERATIONS ---
def batch_upsert_to_sql(records, batch_size=100):
    """Upserts records to SQL View [APPGAC].[ServiciosViewSQL]."""
    if not records:
        return 0

    conn = connect_to_sql()
    if not conn:
        return 0

    cursor = conn.cursor()
    total = len(records)
    total_affected = 0
    
    for i in range(0, total, batch_size):
        batch = records[i:i + batch_size]
        
        # Build a dynamic MERGE statement (Targeting View)
        values_clauses = ["(?, ?, ?, ?, ?, ?)"] * len(batch)
        sql = f"""
            MERGE [APPGAC].[ServiciosViewSQL] AS target
            USING (VALUES {", ".join(values_clauses)}) 
            AS source (Ticket, Visita, Trabajo, Solicita, Motivo, Comentario)
            ON (target.Ticket = source.Ticket)
            WHEN MATCHED THEN
                UPDATE SET 
                    VisitaRealizada = source.Visita,
                    TrabajoRealizado = source.Trabajo,
                    SolicitaNuevaVisita = source.Solicita,
                    MotivoNuevaVisita = source.Motivo,
                    ComentarioTecnico = source.Comentario,
                    FechaModificacionIT = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (Ticket, VisitaRealizada, TrabajoRealizado, SolicitaNuevaVisita, MotivoNuevaVisita, ComentarioTecnico, FechaModificacionIT)
                VALUES (source.Ticket, source.Visita, source.Trabajo, source.Solicita, source.Motivo, source.Comentario, GETDATE());
        """
        
        params = []
        for r in batch:
            params.extend([
                r['Ticket'], r['VisitaRealizada'], r['TrabajoRealizado'],
                r['SolicitaNuevaVisita'], r['MotivoNuevaVisita'], r['ComentarioTecnico']
            ])
            
        try:
            cursor.execute(sql, params)
            total_affected += cursor.rowcount
            conn.commit()
            print(f"  [SQL] Procesados {min(i + batch_size, total)}/{total} registros...", end="\r")
        except Exception as e:
            conn.rollback()
            log_message(f"Error en el lote que empieza en {i}: {e}", "ERROR")
            raise

    print()
    cursor.close()
    conn.close()
    return total_affected

def connect_to_sql():
    """Connects to Azure SQL Database."""
    conn_str = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={SQL_SERVER};"
        f"DATABASE={SQL_DATABASE};"
        f"UID={SQL_USER};"
        f"PWD={SQL_PASSWORD};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
    )
    try:
        conn = pyodbc.connect(conn_str)
        return conn
    except Exception as e:
        log_message(f"Error de conexión SQL: {e}", "ERROR")
        return None

# --- MAIN ---
def main():
    print("=" * 60)
    print("  PDF TO SQL (RECURSIVE SEARCH & TARGET VIEW)")
    print("=" * 60)
    print()

    if not os.path.exists(DOWNLOAD_ROOT):
        log_message(f"Carpeta raíz '{DOWNLOAD_ROOT}' no encontrada.", "ERROR")
        return

    # Find all PDFs recursively in subfolders
    log_message(f"Buscando archivos PDF en '{DOWNLOAD_ROOT}' y sus subcarpetas...")
    pdf_paths = []
    for root, dirs, files in os.walk(DOWNLOAD_ROOT):
        for file in files:
            if file.lower().endswith(".pdf"):
                pdf_paths.append(os.path.join(root, file))

    total_pdfs = len(pdf_paths)
    if total_pdfs == 0:
        log_message("No se encontraron archivos PDF.", "ERROR")
        return

    log_message(f"Se encontraron {total_pdfs} archivos PDF para procesar.")

    records = []
    for i, path in enumerate(pdf_paths):
        data = extract_data_from_pdf(path)
        if data:
            records.append(data)

    if not records:
        log_message("No se pudieron extraer datos de los PDFs.", "WARNING")
        return

    log_message(f"Iniciando carga de {len(records)} registros en SQL...")
    try:
        affected = batch_upsert_to_sql(records)
        log_message(f"Proceso finalizado. Total filas afectadas: {affected}")
    except Exception as e:
        log_message(f"Proceso interrumpido por error: {e}", "ERROR")

if __name__ == "__main__":
    main()
