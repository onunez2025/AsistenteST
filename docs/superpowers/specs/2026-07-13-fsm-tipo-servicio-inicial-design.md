# Corregir fuente del "tipo de servicio inicial" en analizar_cambio_tipo_servicio_cas — Spec

## Problema

`analizar_cambio_tipo_servicio_cas` (en `backend/mcp_sap_c4c.py`) existe para detectar
cuando un CAS cambia el tipo de servicio de un ticket (ej. de "Instalación" a
"Verificación de área") para evitar cerrar como SI-NO. Hoy compara:

- **Tipo FINAL** → SQL, columna `Servicio` de `[APPGAC].[ServiciosViewSQL]`.
- **Tipo INICIAL** → SAP C4C OData, campo `ServiceTermsServiceIssueName`.

El problema (confirmado en producción, root-caused con `systematic-debugging`): `ServiceTermsServiceIssueName`
**no es un valor de creación preservado** — se sobreescribe cuando el tipo del ticket
cambia. Es decir, la herramienta compara "tipo final" contra "tipo final" (con otro
nombre), por lo que casi nunca detecta un cambio real una vez que ya se propagó a C4C.
Esto se confirmó con 3 tickets reales reportados por el usuario (proveniente de un
cruce manual contra un Excel que él descarga al momento del despacho de ruta) donde
`ServiceTermsServiceIssueName` ya mostraba el tipo final en los tres casos.

## Fuente correcta descubierta

FSM (Field Service Management / Coresuite) guarda el informe técnico (checklist) que el
técnico llena al cerrar la visita. Se confirmó en vivo, vía la entidad
`ChecklistInstanceElement` (DTO versión **8**, no documentada — se determinó por fuerza
bruta contra el tenant real), que existe un campo con `title = "Categoría de servicio"`
cuyo valor **no se actualiza cuando C4C reclasifica el ticket después**.

Verificación realizada (real, contra producción):

| Ticket SQL | Tipo final (SQL `Servicio`) | "Categoría de servicio" (FSM checklist) |
|---|---|---|
| 1364497 | Verificación de área | **Instalación** |
| 1365488 | Verificación de área | **Instalación** |
| 1365566 | Verificación de área | **Instalación** |
| 1343258 (control negativo, sin cambio real) | Instalación | Instalación |

Los tres primeros coinciden exactamente con el reporte manual del usuario. El control
negativo (ticket que nunca cambió de tipo) confirma que el campo no es un valor fijo:
refleja el tipo real de cada caso.

Cadena de enlace en FSM: `Activity.code` (= columna `LlamadaFSM` de `ServiciosViewSQL`)
→ `ChecklistInstance.object.objectId` (= `Activity.id`) → `ChecklistInstanceElement.checklistInstance`
(= `ChecklistInstance.id`), filtrando por `title = 'Categoría de servicio'`.

Se confirmó que esto se puede resolver para muchos tickets **en una sola consulta
CoreSQL** vía JOIN, en vez de 3 llamadas HTTP por ticket:

```sql
SELECT a.code, e.value
FROM Activity a
JOIN ChecklistInstance ci ON ci.object = a
JOIN ChecklistInstanceElement e ON e.checklistInstance = ci
WHERE e.title = 'Categoría de servicio' AND a.code IN ('...', '...', ...)
```

Probado en vivo con 6 códigos de actividad reales (mezcla de "Instalación",
"Mantenimiento C/materiales", "Visita") — responde en <1s. Se prefiere filtrar por
`e.title` en vez de `e.elementId` (`textinput43`) porque el `elementId` es específico de
la plantilla de checklist usada (se confirmó que existen al menos 2 plantillas
distintas) y el filtro por título ya viene acotado por el JOIN con los códigos de
actividad, así que no repite el problema de timeout que sí ocurrió al filtrar por
título sin ese acotamiento (ver "Alternativas descartadas" abajo).

## Alternativas descartadas

- **3 llamadas secuenciales por ticket** (Activity → ChecklistInstance → Element sin
  JOIN): funciona, pero para 500 tickets serían ~1500 llamadas HTTP — demasiado lento.
- **Filtrar `ChecklistInstanceElement` por título/fecha sin acotar por actividad**: se
  intentó durante la investigación (`createDateTime` en un rango de 1 día) e hizo
  **timeout** — la tabla es demasiado grande para ese patrón de consulta. Por eso el
  diseño siempre pasa primero por `Activity.code IN (...)` conocido de antemano (viene
  de la fila SQL), nunca por un escaneo abierto de FSM.

## Diseño

### Alcance

Se modifica `analizar_cambio_tipo_servicio_cas` en `backend/mcp_sap_c4c.py` **en el
mismo lugar** (mismo nombre, misma firma, mismo propósito) — no se crea una herramienta
nueva. Solo cambia de dónde sale el "tipo inicial".

### Cambios

1. **SQL (PASO 1):** agregar `LlamadaFSM` al `SELECT` existente (ya se consulta
   `ServiciosViewSQL`, solo falta esa columna). Tickets con `LlamadaFSM` vacío/nulo se
   cuentan directamente como "sin dato FSM" (no se puede ni intentar el lookup).

2. **PASO 2 (reemplaza la llamada a C4C OData):** batchear los códigos `LlamadaFSM`
   (lotes de 30, igual que el patrón existente) y ejecutar la consulta CoreSQL de
   arriba contra FSM, usando el mismo mecanismo de autenticación OAuth que ya existe en
   `backend/mcp_fsm.py` (`_get_access_token`, `_fsm_headers`) — se importan esas
   funciones y las constantes `FSM_QUERY_URL`, `FSM_ACCOUNT`, `FSM_COMPANY` en vez de
   duplicar la lógica de auth. Se agrega la entidad `ChecklistInstanceElement` (versión
   8) al diccionario `DTO_VERSIONS` de `mcp_fsm.py` (documentando cómo se determinó la
   versión), para que quede como fuente de verdad reusable también por
   `ejecutar_consulta_fsm` en el futuro.

   Si un `a.code` aparece más de una vez en la respuesta (más de una instancia de
   checklist para la misma actividad), se usa el primer valor no nulo encontrado.

3. **PASO 3 (cruce):** igual que hoy (`inicial_lower in tipo_inicial.lower()`), pero
   ahora `tipo_inicial` sale del nuevo diccionario FSM en vez de `c4c_types`. Los
   tickets cuyo código no aparezca en absoluto en la respuesta de FSM (checklist sin
   ese campo, plantilla no soportada, o sin checklist) se acumulan en una lista aparte
   `sin_dato_fsm` en vez de tratarse silenciosamente como "sin cambio".

4. **Reporte:** se agrega una línea visible con el conteo de `sin_dato_fsm` (ej.
   `Tickets sin dato de tipo inicial en FSM: 12 (no se pudo verificar su tipo original)`),
   inmediatamente después de la línea de "Total casos detectados". El resto del
   formato (agrupación por día, por CAS, tabla de detalle) no cambia. Se actualiza el
   encabezado de columna `"Tipo C4C (inicial)"` → `"Tipo FSM inicial (checklist)"` y el
   docstring de la función para reflejar las fuentes correctas.

5. **`backend/main.py`:** actualizar las dos referencias existentes a esta herramienta
   que describen el flujo como "C4C→FSM" (línea del diccionario `TOOL_LABELS` y línea
   del árbol de decisión del system prompt) para que digan "FSM (checklist) → SQL/FSM"
   en vez de "C4C→FSM", ya que la dirección de las fuentes se invierte.

### Fuera de alcance

- No se toca `buscar_tickets_c4c`, `obtener_ticket_c4c_tiempo_real` ni ninguna otra
  herramienta de `mcp_sap_c4c.py`.
- No se agrega una herramienta genérica de "consultar checklist de FSM" — solo se
  resuelve el caso puntual que necesita `analizar_cambio_tipo_servicio_cas`.
- El fix ya aplicado (no comiteado aún) de rango de fechas `FechaVisita <= fecha_fin`
  en esta misma función es un bug distinto e independiente; se mantiene tal cual está
  y se sube junto con este cambio (mismo archivo, sin conflicto).

## Testing / verificación

- Reejecutar el mismo script de verificación en vivo usado durante la investigación
  (tickets 1364497, 1365488, 1365566 con `tipo_servicio_inicial_like='Instal'`,
  `tipo_servicio_final_like='Verific'`) y confirmar que ahora los 3 aparecen como
  cambios detectados.
- Confirmar con el ticket de control negativo (1343258) que NO aparece como cambio.
- Confirmar que un ticket con `LlamadaFSM` vacío se cuenta en `sin_dato_fsm` y no
  interrumpe la consulta.
