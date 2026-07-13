# Enriquecer el uso de OData/SAP C4C — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la IA tenga acceso real a la información de tickets de SAP C4C que hoy descarta (cliente, ubicación de servicio, descripción real del caso, producto/garantía), y pueda buscar/contar tickets filtrando por muchos más campos que solo tienda+fecha.

**Architecture:** Se modifica `backend/mcp_sap_c4c.py`: (1) `obtener_ticket_c4c_tiempo_real` pasa de devolver 10 campos a devolver ~25, usando `$expand` de OData para traer datos de partes involucradas, ubicación y texto del caso en una sola llamada; (2) `consultar_tickets_c4c_por_tienda_y_fecha` se reemplaza por `buscar_tickets_c4c`, que agrega un mecanismo de filtros por campo (validados contra una lista cerrada) y un modo de solo-conteo vía `$inlinecount`. Se actualiza el system prompt en `backend/main.py` para documentar las herramientas nuevas.

**Tech Stack:** Python, `requests` + `HTTPBasicAuth` (ya en uso), OData v2 contra SAP C4C. Sin dependencias nuevas.

## Global Constraints

- Ninguna herramienta gana capacidad de escritura — todo sigue siendo HTTP GET de solo lectura.
- Los filtros de `buscar_tickets_c4c` solo aceptan campos de una lista cerrada (`_ALLOWED_SEARCH_FIELDS`) — nunca un nombre de propiedad OData arbitrario.
- Todo valor insertado en un filtro OData debe pasar por `_escape_odata_value` primero (comillas simples escapadas como `''`).
- Este proyecto no tiene suite de pruebas persistente (no hay `pytest`/`tests/`); las verificaciones se hacen con scripts temporales (`python -c "..."` o un archivo temporal que se borra al terminar), siguiendo el patrón ya usado en el resto del proyecto.
- No hay entorno sandbox de SAP C4C — las verificaciones en vivo se hacen contra el sistema real, siempre con operaciones de solo lectura (GET), usando el ticket real `1367167` (usado durante el diseño) como referencia conocida.
- El "informe técnico" (cierre del técnico) y el "historial de cambios" (Modificaciones) quedan fuera de este plan — ver la spec para el porqué.

---

### Task 1: Helpers de filtro OData (lista de campos permitidos + escapado + armado de filtro)

**Files:**
- Modify: `backend/mcp_sap_c4c.py:1-38` (imports y sección de configuración inicial)
- Test: script temporal `backend/_verify_odata_filter.py` (se borra al final del task)

**Interfaces:**
- Produce: `_ALLOWED_SEARCH_FIELDS: Dict[str, tuple]`, `_escape_odata_value(value: str) -> str`, `_build_odata_filter_from_filtros(filtros: Optional[List[Dict[str, str]]]) -> tuple[str, Optional[str]]` — usados por el Task 3.

- [ ] **Step 1: Agregar el import de `typing`**

En `backend/mcp_sap_c4c.py`, busca esta línea (es la línea 8 del archivo actual, antes de cualquier cambio de este plan):

```python
from azure.storage.blob import BlobServiceClient, ContentSettings
```

Agrega inmediatamente después:

```python
from typing import List, Dict, Any, Optional
```

- [ ] **Step 2: Agregar los helpers de filtro**

Busca esta línea:

```python
AZURE_STORAGE_CONTAINER         = os.getenv("AZURE_STORAGE_CONTAINER", "stecnico")
```

Agrega inmediatamente después (antes de `# Initialize FastMCP Server`):

```python

# Diccionario cerrado de campos permitidos como filtro en buscar_tickets_c4c.
# campo (nombre natural que usa la IA) -> (propiedad OData real, tipo de coincidencia)
_ALLOWED_SEARCH_FIELDS = {
    "estado":               ("ServiceRequestLifeCycleStatusCodeText", "exact"),
    "cliente":               ("BuyerPartyName", "substring"),
    "producto":              ("ProductDescription", "substring"),
    "producto_registrado":   ("InstallationPointID", "exact"),
    "tipo_servicio":         ("ServiceTermsServiceIssueName", "substring"),
    "prioridad":             ("ServicePriorityCodeText", "exact"),
    "empresa":               ("zIDEmpresa_SDK", "exact"),
}


def _escape_odata_value(value: str) -> str:
    """Escapa comillas simples para uso seguro dentro de un literal string de OData."""
    return value.replace("'", "''")


def _build_odata_filter_from_filtros(filtros):
    """Convierte una lista de {"campo": ..., "valor": ...} en un fragmento de filtro
    OData, validando cada campo contra _ALLOWED_SEARCH_FIELDS.

    Devuelve (filtro_str, error). Si error no es None, filtro_str es "".
    """
    if not filtros:
        return "", None
    partes = []
    for f in filtros:
        campo = f.get("campo", "")
        valor = f.get("valor", "")
        if campo not in _ALLOWED_SEARCH_FIELDS:
            disponibles = ", ".join(sorted(_ALLOWED_SEARCH_FIELDS.keys()))
            return "", f"Campo de filtro '{campo}' no permitido. Campos disponibles: {disponibles}."
        propiedad, tipo = _ALLOWED_SEARCH_FIELDS[campo]
        valor_escapado = _escape_odata_value(str(valor))
        if tipo == "substring":
            partes.append(f"substringof('{valor_escapado}', {propiedad})")
        else:
            partes.append(f"{propiedad} eq '{valor_escapado}'")
    return " and ".join(partes), None
```

- [ ] **Step 3: Escribir y correr el script de verificación**

Crea `backend/_verify_odata_filter.py`:

```python
from mcp_sap_c4c import _build_odata_filter_from_filtros

filtro_str, error = _build_odata_filter_from_filtros([{"campo": "inventado", "valor": "x"}])
assert filtro_str == "", filtro_str
assert error is not None and "no permitido" in error, error

filtro_str, error = _build_odata_filter_from_filtros([{"campo": "estado", "valor": "Cerrado"}])
assert error is None, error
assert filtro_str == "ServiceRequestLifeCycleStatusCodeText eq 'Cerrado'", filtro_str

filtro_str, error = _build_odata_filter_from_filtros([{"campo": "cliente", "valor": "CLAROS"}])
assert error is None, error
assert filtro_str == "substringof('CLAROS', BuyerPartyName)", filtro_str

filtro_str, error = _build_odata_filter_from_filtros([{"campo": "cliente", "valor": "O'Brien"}])
assert error is None, error
assert filtro_str == "substringof('O''Brien', BuyerPartyName)", filtro_str

filtro_str, error = _build_odata_filter_from_filtros([
    {"campo": "estado", "valor": "Cerrado"},
    {"campo": "producto", "valor": "COCINA"},
])
assert error is None, error
assert filtro_str == "ServiceRequestLifeCycleStatusCodeText eq 'Cerrado' and substringof('COCINA', ProductDescription)", filtro_str

filtro_str, error = _build_odata_filter_from_filtros([])
assert filtro_str == "" and error is None

filtro_str, error = _build_odata_filter_from_filtros(None)
assert filtro_str == "" and error is None

print("TODO OK")
```

Run: `cd backend && python _verify_odata_filter.py`
Expected: `TODO OK` (sin errores de `AssertionError`)

- [ ] **Step 4: Borrar el script temporal y verificar sintaxis**

```bash
rm backend/_verify_odata_filter.py
cd backend && python -m py_compile mcp_sap_c4c.py
```

Expected: sin salida (compila limpio).

- [ ] **Step 5: Commit**

```bash
git add backend/mcp_sap_c4c.py
git commit -m "feat: helpers de filtro OData para busqueda flexible de tickets C4C"
```

---

### Task 2: Enriquecer `obtener_ticket_c4c_tiempo_real`

**Files:**
- Modify: `backend/mcp_sap_c4c.py` (función completa `obtener_ticket_c4c_tiempo_real` — su número de línea exacto se corrió por los cambios del Task 1; ubícala por el nombre de la función, no por número de línea)

**Interfaces:**
- Consumes: nada del Task 1 (esta función no usa los helpers de filtro).
- Produce: nueva forma del texto devuelto por la herramienta — un diccionario con claves `ID, Nombre, Estado, Prioridad, TipoServicio, Empresa, FechaCreacion, UltimaModificacion, FechaProgramadaInicio, FechaProgramadaFin, Cliente, Ubicacion, Producto, DescripcionDelCaso`. El Task 4 (system prompt) referencia estas claves nuevas.

- [ ] **Step 1: Reemplazar la función completa**

Ubica la función `obtener_ticket_c4c_tiempo_real` (empieza en el `@mcp.tool()` inmediatamente anterior a `def obtener_ticket_c4c_tiempo_real`) y reemplázala completa — desde ese `@mcp.tool()` hasta el `return f"Error al consultar SAP C4C en el servidor MCP: {str(e)}"` que la cierra, justo antes del `@mcp.tool()` de `consultar_tickets_c4c_por_tienda_y_fecha` — por:

```python
@mcp.tool()
def obtener_ticket_c4c_tiempo_real(ticket_id: str) -> str:
    """
    Consulta en tiempo real el detalle completo de un ticket específico directamente en
    SAP C4C utilizando el API OData: datos generales, contacto del cliente, ubicación
    del servicio, producto/garantía y la descripción real del caso reportado por el
    cliente. Útil para responder cualquier pregunta sobre un ticket puntual.

    Args:
        ticket_id: El ID numérico del ticket de SAP C4C (ej. '123456').
    """
    logger.info(f"[MCP TOOL] obtener_ticket_c4c_tiempo_real para ticket: {ticket_id}")

    if not SAP_BASE_URL or not SAP_USER or not SAP_PASSWORD:
        return "Error: Las credenciales de SAP C4C no están configuradas en el servidor MCP."

    try:
        expand = "ServiceRequestParty,ServiceRequestServicePointLocation/ServiceRequestServicePointLocationAddress,ServiceRequestTextCollection"
        url = f"{SAP_BASE_URL}/ServiceRequestCollection?$format=json&$filter=ID eq '{ticket_id}'&$expand={expand}"

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
            if not results:
                return f"No se encontró el ticket '{ticket_id}' en SAP C4C."

            ticket_data = results[0]

            # Cliente: filtrar el array de partes involucradas por rol "Cliente" (RoleCode 1001)
            cliente = {}
            parties = ticket_data.get("ServiceRequestParty", {}).get("results", [])
            for p in parties:
                if p.get("RoleCode") == "1001":
                    cliente = {
                        "Nombre": p.get("PartyName"),
                        "Telefono": p.get("Phone"),
                        "Celular": p.get("Mobile"),
                        "Email": p.get("Email"),
                    }
                    break

            # Ubicación de servicio (propiedad navegable 0..1, no viene envuelta en "results")
            ubicacion = {}
            loc = ticket_data.get("ServiceRequestServicePointLocation") or {}
            addr = loc.get("ServiceRequestServicePointLocationAddress") or {}
            if addr:
                ubicacion = {
                    "Pais": addr.get("CountryText"),
                    "Departamento": addr.get("StateText"),
                    "Distrito": addr.get("District"),
                    "Direccion": addr.get("AddressLine2"),
                    "CodigoPostal": addr.get("PostalCode"),
                }

            # Descripción real del caso (array de textos, se busca el tipo correcto)
            descripcion = ""
            textos = ticket_data.get("ServiceRequestTextCollection", {}).get("results", [])
            for t in textos:
                if t.get("TypeCodeText") == "Descripción del caso":
                    descripcion = t.get("Text", "")
                    break

            filtered_data = {
                "ID": ticket_data.get("ID"),
                "Nombre": ticket_data.get("Name"),
                "Estado": ticket_data.get("ServiceRequestLifeCycleStatusCodeText"),
                "Prioridad": ticket_data.get("ServicePriorityCodeText"),
                "TipoServicio": ticket_data.get("ServiceTermsServiceIssueName"),
                "Empresa": ticket_data.get("zIDEmpresa_SDK"),
                "FechaCreacion": ticket_data.get("CreationDateTime"),
                "UltimaModificacion": ticket_data.get("LastChangeDateTime"),
                "FechaProgramadaInicio": ticket_data.get("RequestedFulfillmentPeriodStartDateTime"),
                "FechaProgramadaFin": ticket_data.get("RequestedFulfillmentPeriodEndDateTime"),
                "Cliente": cliente,
                "Ubicacion": ubicacion,
                "Producto": {
                    "ID": ticket_data.get("ProductID"),
                    "Descripcion": ticket_data.get("ProductDescription"),
                    "ProductoRegistrado": ticket_data.get("InstallationPointID"),
                    "GarantiaDesde": ticket_data.get("WarrantyFrom"),
                    "GarantiaHasta": ticket_data.get("WarrantyTo"),
                    "TipoGarantia": ticket_data.get("WarrantyGoodwillCodeText"),
                },
                "DescripcionDelCaso": descripcion,
            }
            return f"Datos del Ticket {ticket_id} en SAP C4C en tiempo real:\n{filtered_data}"
        else:
            return f"Error al conectar con SAP C4C OData: {resp.status_code} - {resp.text}"

    except Exception as e:
        logger.error(f"Error en obtener_ticket_c4c_tiempo_real: {e}")
        return f"Error al consultar SAP C4C en el servidor MCP: {str(e)}"
```

- [ ] **Step 2: Verificar sintaxis**

```bash
cd backend && python -m py_compile mcp_sap_c4c.py
```

Expected: sin salida.

- [ ] **Step 3: Verificación en vivo contra un ticket real**

Crea un script temporal `backend/_verify_ticket_detalle.py`:

```python
import os
from dotenv import load_dotenv
load_dotenv()
from mcp_sap_c4c import obtener_ticket_c4c_tiempo_real

resultado = obtener_ticket_c4c_tiempo_real("1367167")
print(resultado)

assert "JUAN JOSE CLAROS ROQUE" in resultado, "falta el nombre del cliente"
assert "991705428" in resultado, "falta el celular del cliente"
assert "SANTIAGO DE SURCO" in resultado, "falta el distrito"
assert "REV NO ENCIENDE" in resultado, "falta la descripcion real del caso"
assert "ENCIMERA VID TEMP GAS 90CM" in resultado, "falta la descripcion del producto"
print("\nTODO OK")
```

Run: `cd backend && python _verify_ticket_detalle.py`
Expected: imprime el diccionario completo del ticket y termina con `TODO OK`. Si el ticket 1367167 ya no existe o cambió de estado en producción para cuando se corra esto, usa cualquier otro ID de ticket real y ajusta los `assert` según los datos que efectivamente traiga.

- [ ] **Step 4: Borrar el script temporal**

```bash
rm backend/_verify_ticket_detalle.py
```

- [ ] **Step 5: Commit**

```bash
git add backend/mcp_sap_c4c.py
git commit -m "feat: enriquecer obtener_ticket_c4c_tiempo_real con cliente, ubicacion y descripcion real"
```

---

### Task 3: Reemplazar `consultar_tickets_c4c_por_tienda_y_fecha` por `buscar_tickets_c4c`

**Files:**
- Modify: `backend/mcp_sap_c4c.py` (reemplaza la función completa `consultar_tickets_c4c_por_tienda_y_fecha`)

**Interfaces:**
- Consumes: `_build_odata_filter_from_filtros` del Task 1.
- Produce: la herramienta `buscar_tickets_c4c` que el Task 4 documenta en el system prompt, reemplazando toda referencia a `consultar_tickets_c4c_por_tienda_y_fecha`.

- [ ] **Step 1: Reemplazar la función completa**

Reemplaza toda la función `consultar_tickets_c4c_por_tienda_y_fecha` (desde `@mcp.tool()` que la precede hasta el `return f"Error al realizar la consulta en SAP C4C: {str(e)}"` que la cierra, justo antes de `@mcp.tool()` de `obtener_adjuntos_ticket_c4c`) por:

```python
@mcp.tool()
def buscar_tickets_c4c(
    tienda: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    filtros: Optional[List[Dict[str, str]]] = None,
    solo_contar: bool = False,
) -> str:
    """
    Busca o cuenta tickets en SAP C4C vía OData, combinando cualquiera de estos
    criterios: tienda/lugar de compra, rango de fechas de creación, y una lista de
    filtros adicionales por campo. Usa esta herramienta para cualquier pregunta de
    tipo "cuántos tickets..." o "qué tickets...".

    Args:
        tienda: Nombre o abreviatura del lugar de compra (ej. 'Promart', 'Sodimac'). Opcional.
        fecha_inicio: Fecha de inicio en formato 'YYYY-MM-DD'. Opcional.
        fecha_fin: Fecha de fin en formato 'YYYY-MM-DD'. Opcional.
        filtros: Lista de condiciones adicionales, cada una como
            {"campo": "estado"|"cliente"|"producto"|"producto_registrado"|"tipo_servicio"|"prioridad"|"empresa", "valor": "..."}.
            Opcional.
        solo_contar: Si es True, devuelve solo el total de tickets que cumplen los
            criterios (rápido, sin traer el detalle). Úsalo para preguntas de "cuántos".
    """
    from datetime import datetime
    logger.info(f"[MCP TOOL] buscar_tickets_c4c: tienda={tienda} fechas={fecha_inicio}..{fecha_fin} filtros={filtros} solo_contar={solo_contar}")

    if not SAP_BASE_URL or not SAP_USER or not SAP_PASSWORD:
        return "Error: Las credenciales de SAP C4C no están configuradas."

    partes_filtro = []

    if tienda:
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

        name_lower = tienda.lower().strip()
        matched_codes = []

        for key, codes in STORE_MAP.items():
            if key in name_lower or name_lower in key:
                matched_codes.extend(codes)

        if not matched_codes:
            logger.info(f"Store '{tienda}' not in predefined map. Performing fallback database lookup...")
            try:
                import pyodbc
                SQL_SERVER = os.getenv("SQL_SERVER")
                SQL_DATABASE = os.getenv("SQL_DATABASE")
                SQL_USER = os.getenv("SQL_USER")
                SQL_PASSWORD = os.getenv("SQL_PASSWORD")

                if SQL_SERVER and SQL_DATABASE and SQL_USER and SQL_PASSWORD:
                    conn_str = (
                        f"DRIVER={{{os.getenv('SQL_ODBC_DRIVER', 'ODBC Driver 17 for SQL Server')}}};"
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
                        (f"%{tienda}%",)
                    )
                    rows = cursor.fetchall()
                    conn.close()

                    if rows:
                        headers_lookup = {"Accept": "application/json"}
                        auth = HTTPBasicAuth(SAP_USER, SAP_PASSWORD)
                        for r in rows:
                            tid = r[0]
                            lookup_url = f"{SAP_BASE_URL}/ServiceRequestCollection?$filter=ID eq '{tid}'&$select=zIDLugarCompra_SDK&$format=json"
                            try:
                                lookup_resp = requests.get(lookup_url, auth=auth, headers=headers_lookup, timeout=5)
                                if lookup_resp.status_code == 200:
                                    res = lookup_resp.json().get('d', {}).get('results', [])
                                    if res and res[0].get('zIDLugarCompra_SDK'):
                                        code = res[0].get('zIDLugarCompra_SDK').lstrip('0') or '0'
                                        if code not in matched_codes:
                                            matched_codes.append(code)
                            except Exception as ex:
                                logger.error(f"Error querying OData for ticket {tid}: {ex}")
            except Exception as e:
                logger.error(f"Error in dynamic store lookup: {e}")

        if not matched_codes:
            return f"No se pudo determinar el código de SAP C4C para la tienda/lugar de compra '{tienda}'."

        padded_codes = [code.zfill(60) for code in matched_codes]
        lugar_filter = " or ".join([f"zIDLugarCompra_SDK eq '{c}'" for c in padded_codes])
        partes_filtro.append(f"({lugar_filter})")

    if fecha_inicio and fecha_fin:
        start_dt = f"{fecha_inicio}T00:00:00Z"
        end_dt = f"{fecha_fin}T23:59:59Z"
        partes_filtro.append(f"CreationDateTime ge datetimeoffset'{start_dt}' and CreationDateTime le datetimeoffset'{end_dt}'")

    filtro_extra, error = _build_odata_filter_from_filtros(filtros)
    if error:
        return f"Error: {error}"
    if filtro_extra:
        partes_filtro.append(f"({filtro_extra})")

    if not partes_filtro:
        return "Debes indicar al menos un criterio de búsqueda: tienda, rango de fechas, o filtros."

    filter_query = " and ".join(partes_filtro)

    try:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        if solo_contar:
            url = f"{SAP_BASE_URL}/ServiceRequestCollection?$filter={filter_query}&$inlinecount=allpages&$top=0&$format=json"
            resp = requests.get(url, auth=HTTPBasicAuth(SAP_USER, SAP_PASSWORD), headers=headers, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                total = data.get("d", {}).get("__count", "0")
                return f"Total de tickets que cumplen los criterios: {total}."
            else:
                return f"Error al conectar con SAP C4C OData: {resp.status_code} - {resp.text}"

        url = f"{SAP_BASE_URL}/ServiceRequestCollection?$filter={filter_query}&$select=ID,Name,ServiceRequestLifeCycleStatusCodeText,CreationDateTime,zIDLugarCompra_SDK,zIDEmpresa_SDK,ServicePriorityCodeText,BuyerPartyName,ProductDescription&$top=200&$format=json"

        resp = requests.get(url, auth=HTTPBasicAuth(SAP_USER, SAP_PASSWORD), headers=headers, timeout=15)

        if resp.status_code == 200:
            data = resp.json()
            results = data.get("d", {}).get("results", [])
            if results:
                output = [f"Tickets encontrados ({len(results)} en esta vista):"]
                for t in results:
                    raw_date = t.get("CreationDateTime")
                    date_str = raw_date
                    if raw_date and "/Date(" in raw_date:
                        try:
                            timestamp = int(raw_date.split("(")[1].split(")")[0]) / 1000.0
                            date_str = datetime.utcfromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
                        except Exception:
                            pass

                    output.append(
                        f"- Ticket ID: {t.get('ID')} | Asunto: {t.get('Name')} | Estado: {t.get('ServiceRequestLifeCycleStatusCodeText')} | "
                        f"Creado: {date_str} | Cliente: {t.get('BuyerPartyName')} | Producto: {t.get('ProductDescription')} | "
                        f"Empresa: {t.get('zIDEmpresa_SDK')} | Prioridad: {t.get('ServicePriorityCodeText')}"
                    )
                return "\n".join(output)
            else:
                return "No se encontraron tickets en SAP C4C para los criterios indicados."
        else:
            return f"Error al conectar con SAP C4C OData: {resp.status_code} - {resp.text}"

    except Exception as e:
        logger.error(f"Error en buscar_tickets_c4c: {e}")
        return f"Error al realizar la consulta en SAP C4C: {str(e)}"
```

- [ ] **Step 2: Verificar sintaxis**

```bash
cd backend && python -m py_compile mcp_sap_c4c.py
```

Expected: sin salida.

- [ ] **Step 3: Verificación en vivo — búsqueda por tienda + filtro nuevo**

Crea un script temporal `backend/_verify_buscar_tickets.py`:

```python
import os
from dotenv import load_dotenv
load_dotenv()
from mcp_sap_c4c import buscar_tickets_c4c

# Busqueda con un filtro nuevo (estado) ademas de tienda+fecha
resultado = buscar_tickets_c4c(
    tienda="sodimac",
    fecha_inicio="2026-07-01",
    fecha_fin="2026-07-13",
    filtros=[{"campo": "estado", "valor": "Cerrado"}],
)
print("=== Busqueda con filtro ===")
print(resultado)
assert "Error" not in resultado.split("\n")[0], resultado

# Modo solo contar
resultado_conteo = buscar_tickets_c4c(
    tienda="sodimac",
    fecha_inicio="2026-07-01",
    fecha_fin="2026-07-13",
    solo_contar=True,
)
print("\n=== Solo contar ===")
print(resultado_conteo)
assert "Total de tickets" in resultado_conteo, resultado_conteo

# Campo de filtro invalido debe rechazarse sin llamar a SAP
resultado_invalido = buscar_tickets_c4c(tienda="sodimac", filtros=[{"campo": "no_existe", "valor": "x"}])
print("\n=== Filtro invalido ===")
print(resultado_invalido)
assert "no permitido" in resultado_invalido, resultado_invalido

print("\nTODO OK")
```

Run: `cd backend && python _verify_buscar_tickets.py`
Expected: imprime resultados reales de SAP para las dos primeras llamadas, un mensaje de error claro para la tercera, y termina en `TODO OK`. Si "sodimac" no tiene tickets cerrados en ese rango de fechas para cuando se corra esto, ajusta el rango de fechas o la tienda usada en el script hasta obtener resultados no vacíos, sin cambiar la lógica de la función.

- [ ] **Step 4: Borrar el script temporal**

```bash
rm backend/_verify_buscar_tickets.py
```

- [ ] **Step 5: Commit**

```bash
git add backend/mcp_sap_c4c.py
git commit -m "feat: reemplazar consultar_tickets_c4c_por_tienda_y_fecha por buscar_tickets_c4c con filtros"
```

---

### Task 4: Actualizar el system prompt

**Files:**
- Modify: `backend/main.py` (regla 9, sección de reglas numeradas dentro de `build_system_prompt()`)

**Interfaces:**
- Consumes: los nombres de herramienta y campos de filtro definidos en los Tasks 1-3 (`buscar_tickets_c4c`, `obtener_ticket_c4c_tiempo_real`, campos de `_ALLOWED_SEARCH_FIELDS`).

- [ ] **Step 1: Reemplazar la regla 9**

En `backend/main.py`, busca la línea (dentro de `build_system_prompt()`):

```python
9. TICKETS POR TIENDA: Usa 'consultar_tickets_c4c_por_tienda_y_fecha'. Si no se especifica fecha, asume últimos 30 días.
```

Reemplázala por:

```python
9. TICKETS: Usa 'buscar_tickets_c4c' para buscar o contar tickets combinando tienda, rango de fechas, y/o filtros por estado, cliente, producto, producto_registrado, tipo_servicio, prioridad o empresa. Si no se especifica fecha, asume últimos 30 días. Para preguntas de "cuántos", usa solo_contar=True (mucho más rápido que traer el detalle). Usa 'obtener_ticket_c4c_tiempo_real' para el detalle completo de UN ticket puntual — incluye datos del cliente (nombre, teléfono, celular, email), ubicación del servicio, producto/garantía y la descripción real del caso reportado.
```

- [ ] **Step 2: Verificar que no quedó ninguna referencia a la herramienta vieja**

```bash
grep -n "consultar_tickets_c4c_por_tienda_y_fecha" backend/main.py backend/mcp_sap_c4c.py
```

Expected: sin resultados (0 coincidencias). Si aparece alguna, revisa que el Task 3 haya reemplazado la función completa y que este Step 1 haya reemplazado la referencia en el prompt.

- [ ] **Step 3: Verificar sintaxis y que el prompt se arma sin errores**

```bash
cd backend && python -m py_compile main.py
```

Luego, un script temporal `backend/_verify_prompt_c4c.py`:

```python
from main import build_system_prompt

prompt = build_system_prompt("2026-07-13", "12:00:00")
assert "buscar_tickets_c4c" in prompt
assert "consultar_tickets_c4c_por_tienda_y_fecha" not in prompt
print("TODO OK")
```

Run: `cd backend && python _verify_prompt_c4c.py`
Expected: `TODO OK`.

- [ ] **Step 4: Borrar el script temporal**

```bash
rm backend/_verify_prompt_c4c.py
```

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "docs: actualizar system prompt para buscar_tickets_c4c y ticket enriquecido"
```
