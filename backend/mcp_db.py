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

# Setup logging to stderr because stdout is used for MCP stdio protocol communication
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger("mcp-db")

# Load environment variables
if os.path.exists(".env"):
    load_dotenv(".env")
elif os.path.exists("../.env"):
    load_dotenv("../.env")
else:
    load_dotenv()

# SQL Azure Config
SQL_SERVER = os.getenv("SQL_SERVER")
SQL_DATABASE = os.getenv("SQL_DATABASE")
SQL_USER = os.getenv("SQL_USER")
SQL_PASSWORD = os.getenv("SQL_PASSWORD")

# Azure Blob Storage Config
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_STORAGE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER", "stecnico")

def upload_file_to_azure_blob(local_filepath: str, blob_name: str, content_type: str) -> Optional[str]:
    """Uploads a local file to Azure Blob Storage and returns its URL."""
    if not AZURE_STORAGE_CONNECTION_STRING:
        logger.warning("AZURE_STORAGE_CONNECTION_STRING no configurada. Retornando local path.")
        return None
    try:
        blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
        blob_client = blob_service_client.get_blob_client(container=AZURE_STORAGE_CONTAINER, blob=blob_name)
        
        # Upload the file
        with open(local_filepath, "rb") as data:
            blob_client.upload_blob(data, overwrite=True, content_settings=ContentSettings(content_type=content_type))
        
        # URL of the uploaded blob
        url = blob_client.url
        logger.info(f"Archivo subido exitosamente a Azure Blob Storage: {url}")
        return url
    except Exception as e:
        logger.error(f"Error subiendo archivo a Azure Blob Storage: {e}")
        return None

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
        
        limit = 100
        total_rows = len(df)
        if total_rows > limit:
            df_limited = df.head(limit)
            result_json = df_limited.to_json(orient="records", date_format="iso")
            return f"Resultados (Primeros {limit} de {total_rows} filas):\n{result_json}"
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
        
        df.to_excel(filepath, index=False, sheet_name="Reporte Chatbot")
        
        # Subir a Azure Blob Storage
        blob_name = f"generated/reports/{filename}"
        azure_url = upload_file_to_azure_blob(filepath, blob_name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        
        if azure_url:
            # Eliminar archivo local
            try:
                os.remove(filepath)
            except Exception as ex:
                logger.error(f"No se pudo eliminar el archivo temporal local: {ex}")
            url = azure_url
        else:
            # Fallback a URL local si falla Azure
            url = f"/api/download/reports/{filename}"
        
        return f"Reporte Excel generado con éxito. Descárgalo aquí: [Descargar Reporte Excel]({url})"
        
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
        tipo_grafico: Tipo de gráfico a generar. Valores: 'bar' (barras), 'line' (línea), 'pie' (torta), 'scatter' (dispersión).
        columna_x: Nombre de la columna para el eje X (o etiquetas en gráfico de torta).
        columna_y: Nombre de la columna para el eje Y (valores a graficar).
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
            fig = px.bar(df, x=columna_x, y=columna_y, title=titulo, template="plotly_dark")
        elif tipo_grafico == "line":
            fig = px.line(df, x=columna_x, y=columna_y, title=titulo, template="plotly_dark")
        elif tipo_grafico == "pie":
            fig = px.pie(df, names=columna_x, values=columna_y, title=titulo, template="plotly_dark")
        elif tipo_grafico == "scatter":
            fig = px.scatter(df, x=columna_x, y=columna_y, title=titulo, template="plotly_dark")
        else:
            fig = px.bar(df, x=columna_x, y=columna_y, title=titulo, template="plotly_dark")
            
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
        azure_url = upload_file_to_azure_blob(filepath, blob_name, "text/html")
        
        if azure_url:
            # Eliminar archivo local
            try:
                os.remove(filepath)
            except Exception as ex:
                logger.error(f"No se pudo eliminar el archivo temporal local: {ex}")
            url = azure_url
        else:
            # Fallback a URL local si falla Azure
            url = f"/api/download/charts/{filename}"
        
        return f"Gráfico interactivo generado con éxito. [EmbedChart:{url}]"
        
    except Exception as e:
        logger.error(f"Error generando gráfico en MCP: {e}")
        return f"Error al generar el gráfico: {str(e)}"

if __name__ == "__main__":
    mcp.run()
