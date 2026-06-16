import os
import sys
import re
import logging
import pyodbc
import pandas as pd
import plotly.express as px
from datetime import datetime
from dotenv import load_dotenv
from fastmcp import FastMCP
from azure.storage.blob import BlobServiceClient, ContentSettings
from typing import Optional
import json
from openpyxl.styles import PatternFill, Font, Alignment
from openpyxl.utils import get_column_letter

# Setup logging to stderr because stdout is used for MCP stdio protocol communication
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger("mcp-db")

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

# SQL Azure Config
SQL_SERVER = os.getenv("SQL_SERVER")
SQL_DATABASE = os.getenv("SQL_DATABASE")
SQL_USER = os.getenv("SQL_USER")
SQL_PASSWORD = os.getenv("SQL_PASSWORD")

# Azure Blob Storage Config
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_STORAGE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER", "stecnico")

def upload_file_to_azure_blob(local_filepath: str, blob_name: str, content_type: str) -> tuple[Optional[str], Optional[str]]:
    """Uploads a local file to Azure Blob Storage and returns a tuple (url, error_message)."""
    if not AZURE_STORAGE_CONNECTION_STRING:
        logger.warning("AZURE_STORAGE_CONNECTION_STRING no configurada. Retornando local path.")
        return None, "AZURE_STORAGE_CONNECTION_STRING no configurada en las variables de entorno."
    try:
        blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
        blob_client = blob_service_client.get_blob_client(container=AZURE_STORAGE_CONTAINER, blob=blob_name)
        
        # Upload the file
        with open(local_filepath, "rb") as data:
            blob_client.upload_blob(data, overwrite=True, content_settings=ContentSettings(content_type=content_type))
        
        # URL of the uploaded blob
        url = blob_client.url
        logger.info(f"Archivo subido exitosamente a Azure Blob Storage: {url}")
        return url, None
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Error subiendo archivo a Azure Blob Storage: {err_msg}")
        return None, err_msg


# Define directories relative to this file's location to ensure correctness
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BACKEND_DIR, "static")
REPORTS_DIR = os.path.join(STATIC_DIR, "reports")
CHARTS_DIR = os.path.join(STATIC_DIR, "charts")

os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(CHARTS_DIR, exist_ok=True)

# Initialize FastMCP Server
mcp = FastMCP("Azure SQL Database Server")

def get_db_connection():
    """Establishes connection to Azure SQL Database."""
    conn_str = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={SQL_SERVER};"
        f"DATABASE={SQL_DATABASE};"
        f"UID={SQL_USER};"
        f"PWD={SQL_PASSWORD};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
    )
    return pyodbc.connect(conn_str)

def is_query_safe(query: str) -> bool:
    """Verifies that the query is read-only (SELECT or WITH)."""
    clean_query = query.strip().upper()
    if not (clean_query.startswith("SELECT") or clean_query.startswith("WITH")):
        return False
    dangerous_keywords = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "EXEC", "EXECUTE", "GRANT", "REVOKE"]
    for kw in dangerous_keywords:
        pattern = r"\b" + re.escape(kw) + r"\b"
        if re.search(pattern, clean_query):
            return False
    return True

@mcp.tool()
def ejecutar_consulta_sql(sql_query: str) -> str:
    """
    Ejecuta una consulta SQL de solo lectura (SELECT) en la base de datos de Azure SQL 
    y devuelve los resultados en formato JSON. Esta herramienta sirve para obtener datos,
    hacer sumatorias, promedios, listados de técnicos, estados de órdenes o detalles
    específicos guardados en la tabla 'APPGAC.ServiciosViewSQL'.
    
    Args:
        sql_query: La consulta SQL SELECT a ejecutar. Debe ser válida para Microsoft SQL Server.
    """
    logger.info(f"[MCP DB] ejecutar_consulta_sql: {sql_query}")
    
    if not is_query_safe(sql_query):
        return "Error: Solo se permiten consultas de lectura (SELECT o WITH). No se permiten operaciones de modificación."
    
    try:
        conn = get_db_connection()
        df = pd.read_sql(sql_query, conn)
        conn.close()
        
        limit = 500
        total_rows = len(df)
        if total_rows > limit:
            df_limited = df.head(limit)
            result_json = df_limited.to_json(orient="records", date_format="iso")
            return f"Resultados (Primeros {limit} de {total_rows} filas totales):\n{result_json}"
        else:
            return df.to_json(orient="records", date_format="iso")
            
    except Exception as e:
        logger.error(f"Error en ejecutar_consulta_sql: {e}")
        return f"Error al ejecutar la consulta SQL en el servidor MCP: {str(e)}"

@mcp.tool()
def generar_reporte_excel(sql_query: str, nombre_reporte: str) -> str:
    """
    Ejecuta una consulta SQL y genera un archivo Excel (.xlsx) descargable con los datos.
    Debe llamarse cuando el usuario pida explícitamente descargar, exportar, o crear un reporte
    en Excel/CSV. Devuelve el enlace de descarga del archivo.
    
    Args:
        sql_query: Consulta SQL SELECT para obtener los datos del reporte. NUNCA uses SELECT *.
        nombre_reporte: Nombre de archivo para el reporte (ej. 'servicios_mayo_2026').
    """
    logger.info(f"[MCP DB] generar_reporte_excel: {nombre_reporte}")
    if not is_query_safe(sql_query):
        return "Error: Solo se permiten consultas SELECT de lectura para generar reportes."
        
    try:
        conn = get_db_connection()
        df = pd.read_sql(sql_query, conn)
        conn.close()
        
        if df.empty:
            return "La consulta no devolvió datos. No se generó el archivo Excel."
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = re.sub(r"[^\w\-]", "_", nombre_reporte).lower()
        filename = f"{safe_name}_{timestamp}.xlsx"
        filepath = os.path.join(REPORTS_DIR, filename)

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Reporte")
            ws = writer.sheets["Reporte"]

            # Estilo de encabezados
            header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
            header_font = Font(color="FFFFFF", bold=True, size=11)
            header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
            for col_idx in range(1, len(df.columns) + 1):
                cell = ws.cell(row=1, column=col_idx)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = header_align
            ws.row_dimensions[1].height = 22

            # Auto-ancho de columnas
            for col in ws.columns:
                col_letter = get_column_letter(col[0].column)
                max_len = max((len(str(cell.value)) for cell in col if cell.value is not None), default=8)
                ws.column_dimensions[col_letter].width = min(max_len + 4, 55)

            # Fijar primera fila
            ws.freeze_panes = "A2"
        
        # Subir a Azure Blob Storage
        blob_name = f"generated/reports/{filename}"
        azure_url, upload_error = upload_file_to_azure_blob(filepath, blob_name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        
        if azure_url:
            # Eliminar archivo local
            try:
                os.remove(filepath)
            except Exception as ex:
                logger.error(f"No se pudo eliminar el archivo temporal local: {ex}")
            url = azure_url
            return f"Reporte Excel generado con éxito. Descárgalo aquí: [Descargar Reporte Excel]({url})"
        else:
            # Fallback a URL local si falla Azure
            url = f"/api/download/reports/{filename}"
            return f"Reporte Excel generado con éxito localmente. Nota: La subida a Azure falló ({upload_error}). Descárgalo aquí: [Descargar Reporte Excel]({url})"

        
    except Exception as e:
        logger.error(f"Error generando Excel en MCP: {e}")
        return f"Error al generar el reporte Excel: {str(e)}"

@mcp.tool()
def generar_grafico(sql_query: str, tipo_grafico: str, columna_x: str, columna_y: str, titulo: str) -> str:
    """
    Ejecuta una consulta SQL, analiza los datos y genera un gráfico interactivo en formato HTML
    (usando Plotly). Devuelve el enlace de visualización para incrustar el gráfico en el chat.

    Args:
        sql_query: Consulta SQL SELECT para obtener los datos del gráfico.
        tipo_grafico: Tipo de gráfico: 'bar' (barras verticales), 'bar_h' (barras horizontales — ideal para rankings de técnicos/CAS), 'line' (línea de tendencia), 'pie' (torta/porcentajes), 'scatter' (dispersión), 'funnel' (embudo — para pipelines), 'histogram' (distribución de frecuencia de columna_x).
        columna_x: Columna para el eje X (categorías). En bar_h: es el eje Y (categorías). En histogram: columna a analizar.
        columna_y: Columna para el eje Y (valores numéricos). En bar_h: es el eje X (valores). En histogram: se ignora.
        titulo: Título del gráfico.
    """
    logger.info(f"[MCP DB] generar_grafico: {tipo_grafico} | {titulo}")
    if not is_query_safe(sql_query):
        return "Error: Solo se permiten consultas SELECT de lectura para generar gráficos."
        
    try:
        conn = get_db_connection()
        df = pd.read_sql(sql_query, conn)
        conn.close()
        
        if df.empty:
            return "La consulta no devolvió datos. No se pudo generar el gráfico."
            
        if columna_x not in df.columns or columna_y not in df.columns:
            return f"Error: Las columnas '{columna_x}' o '{columna_y}' no existen. Disponibles: {list(df.columns)}"
            
        fig = None
        tipo_grafico = tipo_grafico.lower().strip()

        if tipo_grafico == "bar":
            fig = px.bar(df, x=columna_x, y=columna_y, title=titulo, template="plotly_dark", text_auto=True)
        elif tipo_grafico == "bar_h":
            fig = px.bar(df, y=columna_x, x=columna_y, title=titulo, template="plotly_dark",
                         orientation="h", text_auto=True)
        elif tipo_grafico == "line":
            fig = px.line(df, x=columna_x, y=columna_y, title=titulo, template="plotly_dark", markers=True)
        elif tipo_grafico == "pie":
            fig = px.pie(df, names=columna_x, values=columna_y, title=titulo, template="plotly_dark")
        elif tipo_grafico == "scatter":
            fig = px.scatter(df, x=columna_x, y=columna_y, title=titulo, template="plotly_dark")
        elif tipo_grafico == "funnel":
            fig = px.funnel(df, x=columna_y, y=columna_x, title=titulo, template="plotly_dark")
        elif tipo_grafico == "histogram":
            fig = px.histogram(df, x=columna_x, title=titulo, template="plotly_dark")
        else:
            fig = px.bar(df, x=columna_x, y=columna_y, title=titulo, template="plotly_dark", text_auto=True)
            
        fig.update_layout(
            paper_bgcolor="rgba(24, 24, 28, 0.95)",
            plot_bgcolor="rgba(0, 0, 0, 0)",
            title_font=dict(size=18, family="Outfit, sans-serif", color="#ffffff"),
            font=dict(family="Inter, sans-serif", color="#a1a1aa"),
        )
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_title = re.sub(r"[^\w\-]", "_", titulo).lower()
        filename = f"chart_{safe_title}_{timestamp}.html"
        filepath = os.path.join(CHARTS_DIR, filename)
        
        fig.write_html(filepath, include_plotlyjs="cdn", full_html=True)
        
        # Subir a Azure Blob Storage
        blob_name = f"generated/charts/{filename}"
        azure_url, upload_error = upload_file_to_azure_blob(filepath, blob_name, "text/html")
        
        if azure_url:
            # Eliminar archivo local
            try:
                os.remove(filepath)
            except Exception as ex:
                logger.error(f"No se pudo eliminar el archivo temporal local: {ex}")
            url = azure_url
            return f"Gráfico interactivo generado con éxito. [EmbedChart:{url}]"
        else:
            # Fallback a URL local si falla Azure
            url = f"/api/download/charts/{filename}"
            return f"Gráfico interactivo generado con éxito localmente. Nota: La subida a Azure falló ({upload_error}). [EmbedChart:{url}]"

        
    except Exception as e:
        logger.error(f"Error generando gráfico en MCP: {e}")
        return f"Error al generar el gráfico: {str(e)}"

SHARED_KNOWLEDGE_FILE = os.path.join(BACKEND_DIR, "shared_knowledge.json")

@mcp.tool()
def guardar_regla_negocio(tema: str, explicacion: str, consulta_sql: Optional[str] = None) -> str:
    """
    Guarda una regla de negocio, fórmula, cruce de tablas, método de cálculo de indicador 
    o instrucción enseñada por el usuario para que el asistente pueda recordarla y usarla 
    en el futuro en cualquier conversación.
    
    Args:
        tema: El nombre del indicador, regla o tema (ej. 'Cálculo de NPS', 'Join de técnicos propios').
        explicacion: La explicación detallada de la regla, fórmula o lógica.
        consulta_sql: Un ejemplo de consulta SQL opcional que represente la regla.
    """
    logger.info(f"[MCP DB] guardar_regla_negocio: {tema}")
    try:
        data = []
        if os.path.exists(SHARED_KNOWLEDGE_FILE):
            try:
                with open(SHARED_KNOWLEDGE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = []
        
        nueva_regla = {
            "tema": tema,
            "explicacion": explicacion,
            "consulta_sql": consulta_sql,
            "fecha_creacion": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # Avoid duplicate topics (update if already exists)
        exists = False
        for i, item in enumerate(data):
            if item["tema"].lower().strip() == tema.lower().strip():
                data[i] = nueva_regla
                exists = True
                break
        
        if not exists:
            data.append(nueva_regla)
            
        with open(SHARED_KNOWLEDGE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        return f"Regla de negocio sobre '{tema}' guardada exitosamente en la memoria compartida."
    except Exception as e:
        logger.error(f"Error en guardar_regla_negocio: {e}")
        return f"Error al guardar la regla de negocio: {str(e)}"

@mcp.tool()
def buscar_reglas_negocio(termino_busqueda: Optional[str] = None) -> str:
    """
    Busca e investiga en la memoria compartida las reglas de negocio, fórmulas o lógicas 
    que los usuarios han enseñado previamente al asistente. Úsala siempre que te pregunten 
    por un cálculo, indicador personalizado o cruce de tablas del cual no recuerdes la lógica exacta.
    
    Args:
        termino_busqueda: Término de búsqueda opcional para filtrar los temas. Si es vacío, devuelve todas las reglas.
    """
    logger.info(f"[MCP DB] buscar_reglas_negocio: {termino_busqueda}")
    try:
        if not os.path.exists(SHARED_KNOWLEDGE_FILE):
            return "No hay ninguna regla de negocio guardada en la memoria compartida aún."
            
        with open(SHARED_KNOWLEDGE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        if not data:
            return "No hay ninguna regla de negocio registrada en la memoria."
            
        if termino_busqueda:
            term = termino_busqueda.lower().strip()
            filtrados = [
                item for item in data 
                if term in item["tema"].lower() or term in item["explicacion"].lower() or (item["consulta_sql"] and term in item["consulta_sql"].lower())
            ]
            if not filtrados:
                return f"No se encontraron reglas de negocio asociadas al término '{termino_busqueda}'."
            return json.dumps(filtrados, ensure_ascii=False, indent=2)
        else:
            return json.dumps(data, ensure_ascii=False, indent=2)
            
    except Exception as e:
        logger.error(f"Error en buscar_reglas_negocio: {e}")
        return f"Error al buscar reglas de negocio: {str(e)}"

if __name__ == "__main__":
    mcp.run()
