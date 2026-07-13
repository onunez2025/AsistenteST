# Corregir fuente del tipo de servicio inicial (FSM checklist) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que `analizar_cambio_tipo_servicio_cas` detecte correctamente cuando un
CAS cambió el tipo de servicio de un ticket, leyendo el tipo INICIAL desde el checklist
técnico de FSM (que no se sobreescribe) en vez de SAP C4C (que sí se sobreescribe y por
eso la herramienta casi nunca detectaba nada).

**Architecture:** Se agrega la entidad `ChecklistInstanceElement` (DTO versión 8,
determinada empíricamente) al registro de entidades conocidas de `mcp_fsm.py`. Luego se
reemplaza, dentro de `analizar_cambio_tipo_servicio_cas` (en `mcp_sap_c4c.py`), la
llamada a SAP C4C OData por una consulta CoreSQL batcheada a FSM
(`Activity JOIN ChecklistInstance JOIN ChecklistInstanceElement`, filtrando por
`a.code IN (...)` y `e.title='Categoría de servicio'`), reusando la autenticación OAuth
ya existente en `mcp_fsm.py`. Se actualizan las dos referencias a esta herramienta en
`main.py` para reflejar el nuevo flujo de datos.

**Tech Stack:** Python, `requests`, `pyodbc`, FastMCP, SAP FSM/Coresuite Query API
(CoreSQL), SQL Server (`APPGAC.ServiciosViewSQL`).

## Global Constraints

- No se crea ninguna herramienta nueva — se modifica `analizar_cambio_tipo_servicio_cas`
  en el mismo archivo, con el mismo nombre y la misma firma
  (`tipo_servicio_final_like, tipo_servicio_inicial_like, cas_nombre="", fecha_inicio="", fecha_fin=""`).
- No se toca `buscar_tickets_c4c`, `obtener_ticket_c4c_tiempo_real`, ni ninguna otra
  función de `mcp_sap_c4c.py` fuera de `analizar_cambio_tipo_servicio_cas`.
- La autenticación OAuth contra FSM se reusa de `backend/mcp_fsm.py`
  (`_get_access_token`, `_fsm_headers`, `FSM_QUERY_URL`, `FSM_ACCOUNT`, `FSM_COMPANY`) —
  no se duplica la carga de credenciales ni el manejo de token.
- El DTO version de `ChecklistInstanceElement` es **8** (confirmado empíricamente contra
  el tenant real — no está documentado por SAP).
- El campo del checklist a usar es `e.title='Categoría de servicio'` — **no**
  `e.elementId='textinput43'`, porque el `elementId` varía según la plantilla de
  checklist usada (se confirmaron al menos 2 plantillas distintas con el mismo título
  pero distinto elementId).
- Tamaño de lote para las consultas batcheadas: 30 (mismo valor que el patrón existente
  que se reemplaza).
- Los tickets sin dato de tipo inicial disponible en FSM se reportan aparte (conteo
  visible en el reporte), nunca se tratan silenciosamente como "sin cambio".
- El fix ya presente en el working tree (rango `FechaVisita <= fecha_fin` con hora
  `23:59:59`) debe conservarse tal cual — no revertirlo ni tocarlo salvo por los cambios
  de esta plan.

---

### Task 1: Registrar ChecklistInstanceElement en mcp_fsm.py

**Files:**
- Modify: `backend/mcp_fsm.py:46-61` (diccionario `DTO_VERSIONS`)
- Modify: `backend/mcp_fsm.py:147-150` (docstring de `ejecutar_consulta_fsm`, lista de entidades)

**Interfaces:**
- Produces: `DTO_VERSIONS["ChecklistInstanceElement"] == 8`, consumido directamente
  (como string literal `"ChecklistInstanceElement.8"`) por el nuevo código de Task 2 —
  Task 2 NO importa `DTO_VERSIONS`, solo necesita que la entidad quede documentada y
  disponible para `ejecutar_consulta_fsm` en el futuro.

- [ ] **Step 1: Agregar la entidad al diccionario `DTO_VERSIONS`**

Reemplazar:

```python
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
```

por:

```python
DTO_VERSIONS = {
    "Activity":                39,
    "ActivityCode":             14,
    "Address":                  21,
    "Attachment":               18,
    "BusinessPartner":          23,
    "ChecklistInstance":        18,
    # Version determinada empiricamente (no documentada por SAP): se probo cada
    # version del 1 al 40 contra el tenant real hasta obtener HTTP 200 en vez de
    # "CA-17: Invalid DTO" / "CA-19: No resource found".
    "ChecklistInstanceElement": 8,
    "Contact":                  17,
    "Equipment":                23,
    "Person":                   24,
    "PurchaseOrder":            14,
    "ServiceCall":              26,
    "ServiceCallStatus":        15,
    "ServiceCallType":          15,
    "Skill":                    9,
}
```

- [ ] **Step 2: Agregar la entidad a la lista documentada en el docstring de `ejecutar_consulta_fsm`**

Reemplazar (líneas 147-150 de `backend/mcp_fsm.py`):

```
    Entidades (DTOs) disponibles y su versión actual (usa el nombre SIN el número en 'entidades',
    la herramienta agrega la versión automáticamente): Activity, ActivityCode, Address, Attachment,
    BusinessPartner, ChecklistInstance, Contact, Equipment, Person, PurchaseOrder, ServiceCall,
    ServiceCallStatus, ServiceCallType, Skill.
```

por:

```
    Entidades (DTOs) disponibles y su versión actual (usa el nombre SIN el número en 'entidades',
    la herramienta agrega la versión automáticamente): Activity, ActivityCode, Address, Attachment,
    BusinessPartner, ChecklistInstance, ChecklistInstanceElement, Contact, Equipment, Person,
    PurchaseOrder, ServiceCall, ServiceCallStatus, ServiceCallType, Skill.
```

- [ ] **Step 3: Verificar sintaxis**

Run: `cd backend && python -m py_compile mcp_fsm.py`
Expected: sin salida (sin errores).

- [ ] **Step 4: Verificar en vivo que la entidad resuelve y responde**

Crear un script temporal `backend/_verify_dto_checklist.py`:

```python
import sys
sys.path.insert(0, ".")
from mcp_fsm import DTO_VERSIONS, _resolve_dtos, ejecutar_consulta_fsm

assert DTO_VERSIONS.get("ChecklistInstanceElement") == 8, DTO_VERSIONS.get("ChecklistInstanceElement")
assert _resolve_dtos("Activity,ChecklistInstance,ChecklistInstanceElement") == "Activity.39;ChecklistInstance.18;ChecklistInstanceElement.8"

resultado = ejecutar_consulta_fsm(
    "SELECT e.value FROM ChecklistInstanceElement e WHERE e.elementId='textinput43' LIMIT 1",
    "ChecklistInstanceElement",
)
print(resultado)
assert "Error" not in resultado, resultado
print("TODO OK")
```

Run: `cd backend && python _verify_dto_checklist.py`
Expected: imprime un resultado con `data` conteniendo al menos un valor, termina con
`TODO OK`, sin `AssertionError`.

- [ ] **Step 5: Borrar el script temporal**

Run: `rm backend/_verify_dto_checklist.py`

- [ ] **Step 6: Commit**

```bash
git add backend/mcp_fsm.py
git commit -m "feat: registrar ChecklistInstanceElement como DTO conocido de FSM"
```

---

### Task 2: Reemplazar la fuente del tipo inicial en analizar_cambio_tipo_servicio_cas

**Files:**
- Modify: `backend/mcp_sap_c4c.py:9` (imports — agregar import de `mcp_fsm`)
- Modify: `backend/mcp_sap_c4c.py:465-650` (función completa `analizar_cambio_tipo_servicio_cas`)

**Interfaces:**
- Consumes: `_get_access_token() -> Optional[str]`, `_fsm_headers(token: str) -> dict`,
  `FSM_QUERY_URL: str`, `FSM_ACCOUNT: str`, `FSM_COMPANY: str` — todos ya definidos en
  `backend/mcp_fsm.py` (Task 1 no cambia estas firmas, solo agrega una entrada al
  diccionario `DTO_VERSIONS` que esta task no consume directamente).
- Produces: sin cambios en la firma pública de `analizar_cambio_tipo_servicio_cas`
  (mismos parámetros, mismo tipo de retorno `str`).

- [ ] **Step 1: Agregar el import de las funciones de autenticación FSM**

En `backend/mcp_sap_c4c.py`, después de la línea:

```python
from typing import List, Dict, Any, Optional
```

agregar:

```python

# Autenticación OAuth contra FSM (reusada, no duplicada) para el lookup del tipo de
# servicio inicial en analizar_cambio_tipo_servicio_cas.
from mcp_fsm import _get_access_token as _fsm_get_access_token, _fsm_headers, FSM_QUERY_URL, FSM_ACCOUNT, FSM_COMPANY
```

- [ ] **Step 2: Verificar que el import no rompe la carga del módulo**

Run: `cd backend && python -c "import mcp_sap_c4c"`
Expected: sin errores (puede imprimir logs de inicialización, eso es normal).

- [ ] **Step 3: Reemplazar la función completa**

Ubicar la función `analizar_cambio_tipo_servicio_cas` (empieza en la línea `def
analizar_cambio_tipo_servicio_cas(` y termina justo antes de `if __name__ ==
"__main__":`). Reemplazar TODO su cuerpo (docstring incluido) por:

```python
def analizar_cambio_tipo_servicio_cas(
    tipo_servicio_final_like: str,
    tipo_servicio_inicial_like: str,
    cas_nombre: str = "",
    fecha_inicio: str = "",
    fecha_fin: str = "",
) -> str:
    """
    Detecta tickets donde el tipo de servicio fue cambiado entre su valor inicial
    (al momento de la visita, según el informe técnico/checklist de FSM) y su valor
    final (SQL/FSM). Útil para identificar malas prácticas de un CAS que cambia el
    tipo de servicio para cerrar tickets como SI-SI cuando no corresponde (ej. cambiar
    INSTALACIÓN a VERIFICACIÓN DE ÁREA).

    Cruza dos fuentes:
    - Tipo de servicio FINAL   → SQL: campo 'Servicio' en ServiciosViewSQL.
    - Tipo de servicio INICIAL → FSM: campo 'Categoría de servicio' del checklist
      técnico (ChecklistInstanceElement), que se llena al cerrar la visita y NO se
      sobreescribe si el ticket se reclasifica después en C4C.

    Devuelve conteo por día (y por CAS, si se consultan todos) y muestra de tickets
    afectados con técnico asignado. Los tickets sin dato de tipo inicial disponible en
    FSM se reportan aparte (no se cuentan como "sin cambio").

    Args:
        tipo_servicio_final_like:   Patrón del tipo FINAL en SQL/FSM (ej. 'VERIF').
        tipo_servicio_inicial_like: Patrón del tipo INICIAL en el checklist FSM (ej. 'INSTAL').
        cas_nombre: Nombre o parte del CAS (ej. 'FAZZIO'). Vacío (por defecto) = todos los CAS
            combinados, con desglose de casos por CAS en el reporte.
        fecha_inicio: Fecha de visita inicio 'YYYY-MM-DD'. Vacío = sin límite inferior.
        fecha_fin:    Fecha de visita fin   'YYYY-MM-DD'. Vacío = sin límite superior.
    """
    if not SAP_BASE_URL or not SAP_USER or not SAP_PASSWORD:
        return "Error: credenciales SAP C4C no configuradas."

    logger.info(f"[MCP TOOL] analizar_cambio_tipo_servicio_cas: cas={cas_nombre or 'TODOS'} final~{tipo_servicio_final_like} inicial~{tipo_servicio_inicial_like} {fecha_inicio}→{fecha_fin}")

    cas_label = cas_nombre if cas_nombre else "todos los CAS"

    # ── PASO 1: SQL → tickets (de un CAS, o de todos) con tipo de servicio FINAL coincidente ──
    import pyodbc
    SQL_SERVER_   = os.getenv("SQL_SERVER")
    SQL_DATABASE_ = os.getenv("SQL_DATABASE")
    SQL_USER_     = os.getenv("SQL_USER")
    SQL_PASSWORD_ = os.getenv("SQL_PASSWORD")

    if not all([SQL_SERVER_, SQL_DATABASE_, SQL_USER_, SQL_PASSWORD_]):
        return "Error: credenciales SQL no configuradas."

    try:
        conn_str = (
            f"DRIVER={{{os.getenv('SQL_ODBC_DRIVER', 'ODBC Driver 17 for SQL Server')}}};"
            f"SERVER={SQL_SERVER_};DATABASE={SQL_DATABASE_};"
            f"UID={SQL_USER_};PWD={SQL_PASSWORD_};"
            f"Encrypt=yes;TrustServerCertificate=no;"
        )
        conn   = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        where_clauses = ["Servicio LIKE ?", "Ticket IS NOT NULL", "Ticket <> ''"]
        params = [f"%{tipo_servicio_final_like}%"]
        if cas_nombre:
            where_clauses.insert(0, "CAS LIKE ?")
            params.insert(0, f"%{cas_nombre}%")
        if fecha_inicio:
            where_clauses.append("FechaVisita >= ?")
            params.append(fecha_inicio)
        if fecha_fin:
            # FechaVisita es datetime (incluye hora), no solo fecha. Comparar contra
            # "YYYY-MM-DD" a secas equivale a "YYYY-MM-DD 00:00:00" y excluye
            # practicamente todas las visitas del dia final (que ocurren despues de
            # medianoche) — confirmado en produccion: con fecha_fin='2026-07-10' el
            # filtro roto devolvia 0 resultados donde el correcto devuelve 120.
            where_clauses.append("FechaVisita <= ?")
            params.append(f"{fecha_fin} 23:59:59")
        where_sql = " AND ".join(where_clauses)

        sql = f"""
            SELECT TOP 500
                Ticket,
                CAS,
                Servicio            AS ServicioFSM,
                CAST(FechaVisita AS DATE) AS FechaVisita,
                ISNULL(NombreTecnico,'') + ' ' + ISNULL(ApellidoTecnico,'') AS Tecnico,
                ISNULL(LlamadaFSM,'')     AS LlamadaFSM
            FROM [APPGAC].[ServiciosViewSQL]
            WHERE {where_sql}
            ORDER BY FechaVisita DESC
        """
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        return f"Error al consultar SQL: {str(e)}"

    if not rows:
        return (
            f"No se encontraron tickets de {cas_label} con tipo de servicio FSM LIKE '%{tipo_servicio_final_like}%' "
            f"en el período indicado."
        )

    # ── PASO 2: FSM (checklist técnico) → tipo de servicio INICIAL por lotes de 30 ──
    ticket_map = {
        str(r[0]).strip(): {
            "cas": r[1], "fsm": r[2], "fecha": str(r[3]), "tecnico": r[4].strip(),
            "codigo_fsm": r[5].strip(),
        }
        for r in rows
    }

    # Códigos de actividad FSM (LlamadaFSM) únicos y no vacíos, listos para el lookup batched.
    codigos_fsm = sorted({info["codigo_fsm"] for info in ticket_map.values() if info["codigo_fsm"]})

    fsm_token = _fsm_get_access_token()
    tipo_inicial_por_codigo: dict = {}  # código de actividad FSM → "Categoría de servicio"

    if fsm_token and codigos_fsm:
        fsm_headers_ = _fsm_headers(fsm_token)
        dtos = "Activity.39;ChecklistInstance.18;ChecklistInstanceElement.8"
        BATCH = 30
        for i in range(0, len(codigos_fsm), BATCH):
            lote = codigos_fsm[i : i + BATCH]
            codigos_in = "','".join(c.replace("'", "''") for c in lote)
            query = (
                "SELECT a.code, e.value FROM Activity a "
                "JOIN ChecklistInstance ci ON ci.object=a "
                "JOIN ChecklistInstanceElement e ON e.checklistInstance=ci "
                f"WHERE e.title='Categoría de servicio' AND a.code IN ('{codigos_in}') "
                f"LIMIT {BATCH * 3}"
            )
            try:
                resp = requests.post(
                    FSM_QUERY_URL,
                    params={"account": FSM_ACCOUNT, "company": FSM_COMPANY, "dtos": dtos},
                    headers=fsm_headers_,
                    json={"query": query},
                    timeout=25,
                )
                if resp.status_code == 200:
                    for item in resp.json().get("data", []):
                        codigo = str(item.get("a", {}).get("code", "")).strip()
                        valor  = item.get("e", {}).get("value")
                        # Si un código aparece más de una vez (múltiples instancias de
                        # checklist para la misma actividad), se queda con el primer
                        # valor no nulo encontrado.
                        if codigo and codigo not in tipo_inicial_por_codigo and valor:
                            tipo_inicial_por_codigo[codigo] = valor
                else:
                    logger.error(f"Error consultando lote FSM (checklist): HTTP {resp.status_code} - {resp.text[:300]}")
            except Exception as e:
                logger.error(f"Error consultando lote FSM (checklist): {e}")

    # ── PASO 3: cruzar — separar los que cambiaron de los que no tienen dato disponible ──
    inicial_lower = tipo_servicio_inicial_like.lower()
    cambios = []
    sin_dato_fsm = []
    for tid, info in ticket_map.items():
        tipo_inicial = tipo_inicial_por_codigo.get(info["codigo_fsm"], "")
        if not tipo_inicial:
            sin_dato_fsm.append(tid)
            continue
        if inicial_lower in tipo_inicial.lower():
            cambios.append({
                "ticket":         tid,
                "cas":            info["cas"],
                "fecha":          info["fecha"],
                "tipo_inicial":   tipo_inicial,
                "tipo_final":     info["fsm"],
                "tecnico":        info["tecnico"],
            })

    if not cambios:
        return (
            f"No se encontraron tickets de {cas_label} que hayan cambiado de "
            f"'{tipo_servicio_inicial_like}' (FSM checklist) a '{tipo_servicio_final_like}' (SQL/FSM) "
            f"en el período indicado.\n"
            f"Tickets evaluados con tipo final coincidente: {len(ticket_map)} | "
            f"Tipos iniciales recuperados de FSM: {len(tipo_inicial_por_codigo)} | "
            f"Sin dato de tipo inicial en FSM: {len(sin_dato_fsm)}"
        )

    # ── PASO 4: agrupar por día (y por CAS, si se consultaron todos) ──
    por_dia: dict = {}
    for c in cambios:
        por_dia.setdefault(c["fecha"], []).append(c)

    lines = [
        f"CAMBIOS DE TIPO DE SERVICIO — {cas_label.upper()}",
        f"  FSM checklist (inicial) LIKE '%{tipo_servicio_inicial_like}%'  →  SQL/FSM (final) LIKE '%{tipo_servicio_final_like}%'",
        f"  Período: {fecha_inicio or 'inicio'} → {fecha_fin or 'hoy'}",
        f"  Total casos detectados: {len(cambios)} de {len(ticket_map)} tickets evaluados"
        + (" (máx. 500 evaluados por consulta)" if len(ticket_map) == 500 else "") + "\n",
        f"  Tickets sin dato de tipo inicial en FSM: {len(sin_dato_fsm)} (no se pudo verificar su tipo original)\n",
    ]

    if not cas_nombre:
        por_cas: dict = {}
        for c in cambios:
            por_cas[c["cas"]] = por_cas.get(c["cas"], 0) + 1
        lines.append("Casos por CAS:")
        for cas, count in sorted(por_cas.items(), key=lambda x: -x[1]):
            lines.append(f"  {cas:<45} {count:>5}")
        lines.append("")

    lines.append(f"{'Fecha':<12} {'Casos':>5}   Tickets")
    lines.append("─" * 70)
    for fecha in sorted(por_dia.keys(), reverse=True):
        casos = por_dia[fecha]
        ids_str = ", ".join(c["ticket"] for c in casos[:8])
        sufijo  = f"  (+{len(casos)-8} más)" if len(casos) > 8 else ""
        lines.append(f"{fecha:<12} {len(casos):>5}   {ids_str}{sufijo}")

    lines.append("\nDetalle de casos (primeros 20):")
    lines.append(f"{'Ticket':<10} {'CAS':<30} {'Fecha':<12} {'Tipo FSM inicial (checklist)':<30} {'Tipo final (SQL/FSM)':<25} Técnico")
    lines.append("─" * 130)
    for c in cambios[:20]:
        lines.append(
            f"{c['ticket']:<10} {c['cas'][:29]:<30} {c['fecha']:<12} {c['tipo_inicial'][:29]:<30} {c['tipo_final'][:24]:<25} {c['tecnico']}"
        )
    if len(cambios) > 20:
        lines.append(f"... y {len(cambios) - 20} caso(s) más.")

    return "\n".join(lines)
```

- [ ] **Step 4: Verificar sintaxis**

Run: `cd backend && python -m py_compile mcp_sap_c4c.py`
Expected: sin salida (sin errores).

- [ ] **Step 5: Verificación en vivo — casos positivos conocidos**

Crear un script temporal `backend/_verify_tipo_inicial_fsm.py`:

```python
import sys
sys.path.insert(0, ".")
from mcp_sap_c4c import analizar_cambio_tipo_servicio_cas

# Los 3 tickets siguientes fueron confirmados manualmente por el usuario (via un
# Excel de despacho de ruta) como INSTALACION -> VERIFICACION DE AREA:
# 1364497, 1365488, 1365566 (visita 2026-07-10).
resultado = analizar_cambio_tipo_servicio_cas(
    tipo_servicio_final_like="Verific",
    tipo_servicio_inicial_like="Instal",
    cas_nombre="",
    fecha_inicio="2026-07-10",
    fecha_fin="2026-07-10",
)
print(resultado)

for ticket in ("1364497", "1365488", "1365566"):
    assert ticket in resultado, f"Ticket {ticket} no aparece en el resultado — regresion"

print("\nTODO OK")
```

Run: `cd backend && python _verify_tipo_inicial_fsm.py`
Expected: el reporte impreso incluye los tres tickets `1364497`, `1365488`, `1365566`
en la tabla de detalle, con `Tipo FSM inicial (checklist)` = "Instalación" y `Tipo
final (SQL/FSM)` = "Verificación de área" (o similar); termina imprimiendo `TODO OK`
sin `AssertionError`.

- [ ] **Step 6: Verificación en vivo — control negativo (ticket que NO cambió)**

Agregar al mismo script `backend/_verify_tipo_inicial_fsm.py` (antes del `print("\nTODO
OK")` final):

```python
# Control negativo: 1343258 nunca cambio de tipo (sigue Instalacion en ambas fuentes),
# no debe aparecer como caso de cambio Instalacion->Verificacion.
resultado_control = analizar_cambio_tipo_servicio_cas(
    tipo_servicio_final_like="Verific",
    tipo_servicio_inicial_like="Instal",
    cas_nombre="",
    fecha_inicio="2026-07-10",
    fecha_fin="2026-07-10",
)
assert "1343258" not in resultado_control, "Control negativo fallo: 1343258 no debio aparecer"
```

Run: `cd backend && python _verify_tipo_inicial_fsm.py`
Expected: sigue terminando en `TODO OK` sin `AssertionError` (el ticket de control
negativo no aparece en el resultado, porque nunca cambió de tipo).

- [ ] **Step 7: Borrar el script temporal**

Run: `rm backend/_verify_tipo_inicial_fsm.py`

- [ ] **Step 8: Commit**

```bash
git add backend/mcp_sap_c4c.py
git commit -m "fix: usar checklist tecnico de FSM como fuente del tipo de servicio inicial"
```

(Este commit incluye también el fix de rango de fechas `FechaVisita <= fecha_fin` que
ya estaba en el working tree sin comitear — es del mismo archivo y no entra en
conflicto con este cambio.)

---

### Task 3: Actualizar referencias en el system prompt (main.py)

**Files:**
- Modify: `backend/main.py:506` (diccionario `TOOL_LABELS`)
- Modify: `backend/main.py:789` (árbol de decisión del system prompt)

**Interfaces:**
- Consumes: ninguna (cambio puramente textual, no afecta lógica de código).

- [ ] **Step 1: Actualizar la etiqueta en `TOOL_LABELS`**

Reemplazar:

```python
    "analizar_cambio_tipo_servicio_cas":       "Cruzando FSM y C4C para detectar cambios de tipo de servicio...",
```

por:

```python
    "analizar_cambio_tipo_servicio_cas":       "Cruzando FSM y SQL para detectar cambios de tipo de servicio...",
```

- [ ] **Step 2: Actualizar la línea del árbol de decisión**

Reemplazar:

```
   ▸ Cambio tipo servicio C4C→FSM    → analizar_cambio_tipo_servicio_cas(cas, tipo_final_like, tipo_inicial_like)
```

por:

```
   ▸ Cambio tipo servicio (inicial=checklist FSM, final=SQL/FSM) → analizar_cambio_tipo_servicio_cas(cas, tipo_final_like, tipo_inicial_like)
```

- [ ] **Step 3: Verificar sintaxis**

Run: `cd backend && python -m py_compile main.py`
Expected: sin salida (sin errores).

- [ ] **Step 4: Verificar que las referencias viejas ya no existen**

Run: `cd backend && grep -n "C4C→FSM\|C4C y FSM\|FSM y C4C" main.py`
Expected: sin coincidencias relacionadas a `analizar_cambio_tipo_servicio_cas` (si
aparece alguna otra coincidencia no relacionada, confírmalo antes de continuar).

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "docs: actualizar system prompt para reflejar fuente FSM del tipo inicial"
```
