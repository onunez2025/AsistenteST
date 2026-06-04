import os
import sys
import logging
import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv
from fastmcp import FastMCP

# Setup logging to stderr because stdout is used for MCP stdio protocol communication
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger("mcp-sap-c4c")

# Load environment variables
if os.path.exists(".env"):
    load_dotenv(".env")
elif os.path.exists("../.env"):
    load_dotenv("../.env")
else:
    load_dotenv()

SAP_BASE_URL = os.getenv("SAP_BASE_URL")
SAP_USER = os.getenv("SAP_USER")
SAP_PASSWORD = os.getenv("SAP_PASSWORD")

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

if __name__ == "__main__":
    mcp.run()
