import os
import re
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import pandas as pd
import pyodbc
import requests
from requests.auth import HTTPBasicAuth
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
import plotly.express as px

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("chatbot-st")

# Load environment variables
# Look in the current folder first, then parent
if os.path.exists(".env"):
    load_dotenv(".env")
elif os.path.exists("../.env"):
    load_dotenv("../.env")
else:
    load_dotenv()

# Debug: Log present environment keys (safely, without printing their secret values)
present_keys = [k for k in os.environ.keys() if k.startswith(("SQL_", "SAP_", "GEMINI_"))]
logger.info(f"Variables de entorno detectadas al inicio: {present_keys}")

# Gemini Config
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
logger.info(f"GEMINI_API_KEY debug - type: {type(GEMINI_API_KEY)}, length: {len(GEMINI_API_KEY) if GEMINI_API_KEY else 0}, repr: {repr(GEMINI_API_KEY)}")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    logger.info("Gemini API Key cargada correctamente.")
else:
    logger.warning("GEMINI_API_KEY not found in environment variables. Gemini calls will fail.")

# SQL Azure Config
SQL_SERVER = os.getenv("SQL_SERVER")
SQL_DATABASE = os.getenv("SQL_DATABASE")
SQL_USER = os.getenv("SQL_USER")
SQL_PASSWORD = os.getenv("SQL_PASSWORD")

# SAP C4C Config
SAP_BASE_URL = os.getenv("SAP_BASE_URL")
SAP_USER = os.getenv("SAP_USER")
SAP_PASSWORD = os.getenv("SAP_PASSWORD")

# Create FastAPI app
app = FastAPI(title="Asistente Inteligente ST - API")

# Enable CORS for frontend local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories for static files
STATIC_DIR = "static"
REPORTS_DIR = os.path.join(STATIC_DIR, "reports")
CHARTS_DIR = os.path.join(STATIC_DIR, "charts")

os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(CHARTS_DIR, exist_ok=True)

# Mount static folder
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# --- DATABASE CONNECTION HELPER ---
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
    try:
        return pyodbc.connect(conn_str)
    except Exception as e:
        logger.error(f"Error conectando a SQL: {e}")
        raise HTTPException(status_code=500, detail=f"Error de conexión a base de datos: {str(e)}")


# --- SECURITY CHECK ---
def is_query_safe(query: str) -> bool:
    """Verifies that the query is read-only (SELECT)."""
    clean_query = query.strip().upper()
    # Permitir consultas SELECT o expresiones CTE (WITH)
    if not (clean_query.startswith("SELECT") or clean_query.startswith("WITH")):
        return False
    # Rechazar comandos peligrosos
    dangerous_keywords = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "EXEC", "EXECUTE", "GRANT", "REVOKE"]
    for kw in dangerous_keywords:
        # Usar regex para buscar palabras completas y evitar rechazar palabras como "CreationDateTime" o "Executive"
        pattern = r"\b" + re.escape(kw) + r"\b"
        if re.search(pattern, clean_query):
            return False
    return True


# --- GEMINI TOOLS ---

def ejecutar_consulta_sql(sql_query: str) -> str:
    """
    Ejecuta una consulta SQL de solo lectura (SELECT) en la base de datos de Azure SQL 
    y devuelve los resultados en formato JSON. Esta herramienta sirve para obtener datos,
    hacer sumatorias, promedios, listados de técnicos, estados de órdenes o detalles
    específicos guardados en la tabla 'APPGAC.ServiciosViewSQL'.
    
    Args:
        sql_query: La consulta SQL SELECT a ejecutar. Debe ser válida para Microsoft SQL Server.
    """
    logger.info(f"[TOOL] ejecutar_consulta_sql: {sql_query}")
    
    if not is_query_safe(sql_query):
        return "Error: Solo se permiten consultas de lectura (SELECT o WITH). No se permiten operaciones de modificación."
    
    try:
        conn = get_db_connection()
        # Usar pandas para leer el query y transformarlo a JSON de forma limpia
        df = pd.read_sql(sql_query, conn)
        conn.close()
        
        # Limitar para no sobrecargar el contexto de Gemini
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
        return f"Error al ejecutar la consulta SQL: {str(e)}"


def obtener_ticket_c4c_tiempo_real(ticket_id: str) -> str:
    """
    Consulta en tiempo real el estado de un ticket específico directamente en SAP C4C
    utilizando el API OData. Útil para verificar estados actuales, fechas de creación
    o prioridades directamente de la fuente de origen en SAP.
    
    Args:
        ticket_id: El ID numérico del ticket de SAP C4C (ej. '123456').
    """
    logger.info(f"[TOOL] obtener_ticket_c4c_tiempo_real: {ticket_id}")
    if not SAP_BASE_URL or not SAP_USER or not SAP_PASSWORD:
        return "Error: Las credenciales de SAP C4C no están configuradas en el servidor."
        
    try:
        # En C4C, el ID del ticket es la clave principal de la colección o se puede filtrar.
        # Intentaremos filtrar por ID para evitar errores de codificación de claves.
        url = f"{SAP_BASE_URL}/ServiceRequestCollection?$format=json&$filter=ID eq '{ticket_id}'"
        
        resp = requests.get(url, auth=HTTPBasicAuth(SAP_USER, SAP_PASSWORD), timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("d", {}).get("results", [])
            if results:
                ticket_data = results[0]
                # Filtrar campos relevantes para evitar sobrecargar con metadatos del OData
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
        return f"Error al consultar SAP C4C: {str(e)}"


def generar_reporte_excel(sql_query: str, nombre_reporte: str) -> str:
    """
    Ejecuta una consulta SQL y genera un archivo Excel (.xlsx) descargable con los datos.
    Debe llamarse cuando el usuario pida explícitamente descargar, exportar, o crear un reporte
    en Excel/CSV. Devuelve el enlace de descarga del archivo.
    
    Args:
        sql_query: Consulta SQL SELECT para obtener los datos del reporte.
        nombre_reporte: Nombre descriptivo para el archivo final (ej. 'servicios_mayo_2026').
    """
    logger.info(f"[TOOL] generar_reporte_excel: {nombre_reporte}")
    if not is_query_safe(sql_query):
        return "Error: Solo se permiten consultas SELECT de lectura para generar reportes."
        
    try:
        conn = get_db_connection()
        df = pd.read_sql(sql_query, conn)
        conn.close()
        
        if df.empty:
            return "La consulta no devolvió datos. No se generó el archivo Excel."
            
        # Generar nombre único de archivo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = re.sub(r"[^\w\-]", "_", nombre_reporte).lower()
        filename = f"{safe_name}_{timestamp}.xlsx"
        filepath = os.path.join(REPORTS_DIR, filename)
        
        # Guardar en Excel
        df.to_excel(filepath, index=False, sheet_name="Reporte Chatbot")
        
        # Devolver URL de descarga
        url = f"/static/reports/{filename}"
        return f"Reporte Excel generado con éxito. Descárgalo aquí: [Descargar Reporte Excel]({url})"
        
    except Exception as e:
        logger.error(f"Error generando Excel: {e}")
        return f"Error al generar el reporte Excel: {str(e)}"


def generar_grafico(sql_query: str, tipo_grafico: str, columna_x: str, columna_y: str, titulo: str) -> str:
    """
    Ejecuta una consulta SQL, analiza los datos y genera un gráfico interactivo en formato HTML 
    (usando Plotly). Devuelve el enlace de visualización para incrustar el gráfico en el chat.
    
    Args:
        sql_query: Consulta SQL SELECT para obtener los datos del gráfico.
        tipo_grafico: Tipo de gráfico a generar. Valores permitidos: 'bar' (barras), 'line' (línea), 'pie' (torta), 'scatter' (dispersión).
        columna_x: Nombre de la columna para el eje X (o etiquetas en gráfico de torta).
        columna_y: Nombre de la columna para el eje Y (valores a graficar).
        titulo: Título del gráfico.
    """
    logger.info(f"[TOOL] generar_grafico: {tipo_grafico} | {titulo}")
    if not is_query_safe(sql_query):
        return "Error: Solo se permiten consultas SELECT de lectura para generar gráficos."
        
    try:
        conn = get_db_connection()
        df = pd.read_sql(sql_query, conn)
        conn.close()
        
        if df.empty:
            return "La consulta no devolvió datos. No se pudo generar el gráfico."
            
        # Asegurar tipos de columnas correctos
        if columna_x not in df.columns or columna_y not in df.columns:
            return f"Error: Las columnas '{columna_x}' o '{columna_y}' no existen en los resultados. Columnas disponibles: {list(df.columns)}"
            
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
            # Por defecto gráfico de barras
            fig = px.bar(df, x=columna_x, y=columna_y, title=titulo, template="plotly_dark")
            
        # Aplicar estilo moderno al layout
        fig.update_layout(
            paper_bgcolor="rgba(24, 24, 28, 0.95)",
            plot_bgcolor="rgba(0, 0, 0, 0)",
            title_font=dict(size=18, family="Outfit, sans-serif", color="#ffffff"),
            font=dict(family="Inter, sans-serif", color="#a1a1aa"),
        )
        
        # Generar nombre único
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_title = re.sub(r"[^\w\-]", "_", titulo).lower()
        filename = f"chart_{safe_title}_{timestamp}.html"
        filepath = os.path.join(CHARTS_DIR, filename)
        
        # Guardar como HTML
        fig.write_html(filepath, include_plotlyjs="cdn", full_html=True)
        
        url = f"/static/charts/{filename}"
        
        # Retornamos instrucciones especiales para que el frontend incruste el HTML
        return f"Gráfico interactivo generado con éxito. [EmbedChart:{url}]"
        
    except Exception as e:
        logger.error(f"Error generando gráfico: {e}")
        return f"Error al generar el gráfico: {str(e)}"


# --- CHAT ENDPOINT ---

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API Key no configurada en el backend.")
        
    try:
        # Inicializar el modelo con todas las herramientas registradas
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            tools=[ejecutar_consulta_sql, obtener_ticket_c4c_tiempo_real, generar_reporte_excel, generar_grafico]
        )
        
        # Iniciar chat de Gemini
        chat = model.start_chat(enable_automatic_function_calling=True)
        
        # Configurar el contexto del sistema enviando un mensaje inicial de instrucción
        prompt_sistema = (
            "Eres el Asistente de Servicio Técnico (Chatbot ST) de MT Industrial. "
            "Tu misión es ayudar al Gerente y Jefaturas de Atención al Cliente a consultar "
            "y analizar la base de datos de servicios y SAP C4C.\n"
            "Reglas clave:\n"
            "1. Tienes acceso a la tabla/vista 'APPGAC.ServiciosViewSQL' en Azure SQL.\n"
            "2. Responde en español de manera profesional, clara y analítica.\n"
            "3. Cuando te pidan listados largos o reportes pesados, ofrece usar 'generar_reporte_excel'.\n"
            "4. Cuando te pidan gráficos, estadísticas comparativas o tendencias visuales, usa 'generar_grafico'.\n"
            "5. Si te preguntan por un ID de ticket específico, puedes consultar en tiempo real con 'obtener_ticket_c4c_tiempo_real'.\n"
            "6. Si la consulta SQL requiere filtros de fecha, recuerda que la base de datos almacena fechas. Asegúrate de formatear el rango de fechas en SQL (ej. YYYY-MM-DD).\n"
            "7. Escribe respuestas bien estructuradas con tablas en Markdown si es pertinente."
        )
        
        # Enviamos la instrucción inicial del sistema
        chat.send_message(prompt_sistema)
        
        # Cargar el historial en el chat de Gemini (excepto el último mensaje del usuario)
        # Esto ayuda a que el chat mantenga el contexto
        historial_previo = request.messages[:-1]
        ultimo_mensaje = request.messages[-1].content
        
        for msg in historial_previo:
            # NOTA: Gemini mantiene su propio historial internamente, pero para simular chats stateless
            # o cargas de historial, podemos alimentar los mensajes previos de forma ordenada.
            # En esta implementación, dado que `start_chat` maneja el estado de la sesión, 
            # alimentaremos el historial previo si es la primera interacción del cliente o si no está guardado.
            # Para simplificar y asegurar que Gemini tenga el contexto actual, enviamos los mensajes previos.
            try:
                # Simular historial
                chat.history.append(
                    genai.types.Content(
                        role="user" if msg.role == "user" else "model",
                        parts=[genai.types.Part.from_text(text=msg.content)]
                    )
                )
            except Exception as e:
                logger.warning(f"No se pudo anexar mensaje al historial de Gemini: {e}")
        
        # Enviar el último mensaje del usuario
        response = chat.send_message(ultimo_mensaje)
        
        # Extraer respuesta final de Gemini
        return {
            "role": "assistant",
            "content": response.text
        }
        
    except Exception as e:
        logger.error(f"Error procesando chat con Gemini: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar la solicitud: {str(e)}")


@app.get("/")
def read_root():
    return {"message": "API del Asistente Inteligente ST activa y funcionando correctamente."}


if __name__ == "__main__":
    import uvicorn
    # Leer puerto de variables de entorno (útil para Easypanel)
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
