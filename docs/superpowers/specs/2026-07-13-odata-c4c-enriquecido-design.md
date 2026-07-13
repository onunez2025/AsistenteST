# Enriquecer el uso de OData/SAP C4C — Diseño

## Contexto

`backend/mcp_sap_c4c.py` consulta SAP C4C vía OData con 4 herramientas, todas con un `$select`/proyección de campos fija, decidida al escribir el código. El caso más claro: `obtener_ticket_c4c_tiempo_real` trae el ticket completo desde SAP pero descarta casi todo en Python, quedándose solo con 10 campos (ID, estado, fechas, prioridad) — con un comentario explícito en el código: "Filtrar campos relevantes para evitar sobrecargar el contexto". Esto significa que, aunque SAP C4C expone muchísima más información por ticket (datos del cliente, ubicación del servicio, descripción real del caso, garantía del producto), la IA nunca puede acceder a ella porque no está en la lista fija.

El lado de SQL (`ejecutar_consulta_sql`) sí tiene este patrón resuelto: la IA puede explorar `INFORMATION_SCHEMA.COLUMNS` y armar su propia consulta libremente. El lado de OData no tiene equivalente.

## Objetivo

Que la IA pueda:
1. Traer el detalle completo y real de un ticket puntual (cliente, ubicación, producto/garantía, descripción del caso), no solo los 10 campos actuales.
2. Buscar/contar tickets filtrando por muchos campos distintos (estado, cliente, producto, producto registrado, tipo de servicio, prioridad, empresa/CAS, tienda, fecha) — no solo tienda+fecha como hoy.

## Explícitamente fuera de alcance

- **Informe técnico / checklist de cierre del técnico**: se obtendrá después desde la API de FSM (tabla `ChecklistInstanceElement`), no desde OData de SAP C4C. No tocar en este plan.
- **Historial de cambios ("Modificaciones")**: investigado durante el diseño — la entidad `ServiceRequestHistoricalVersion` de OData es un mecanismo de versiones históricas (snapshots), no coincide con el registro campo-por-campo ("Atributo / Valor modificado de / Valor modificado a") que muestra la UI de SAP. No se encontró la entidad correcta en el `$metadata` completo del servicio (2.3 MB). Queda pendiente de investigación futura, no bloquea este diseño.

## Campos confirmados (verificados contra un ticket real, ID 1367167, julio 2026)

### Ya disponibles como campos planos en `ServiceRequestCollection` (sin `$expand`)
- Producto: `ProductID`, `ProductDescription`, `InstallationPointID` (= "Productos registrados" en la UI)
- Garantía: `WarrantyFrom`, `WarrantyTo`, `WarrantyStartdatetimeContent`, `WarrantyGoodwillCodeText`
- Cliente (parcial): `BuyerPartyID`, `BuyerPartyName` — alcanza para filtrar búsquedas por nombre de cliente, pero NO trae teléfono/celular/email (ver abajo)
- Categoría: `ServiceTermsServiceIssueName` (tipo de servicio)
- Empresa/CAS: `zIDEmpresa_SDK`
- Tienda/lugar de compra: `zIDLugarCompra_SDK` (ya usado hoy)
- Estado: `ServiceRequestLifeCycleStatusCode` / `...CodeText`
- Prioridad: `ServicePriorityCode` / `...CodeText`
- Fechas: `CreationDateTime`, `LastChangeDateTime` (ya usado hoy)

### Requieren `$expand` (confirmado con datos reales)
- **Contacto del cliente** (teléfono, celular, email): `$expand=ServiceRequestParty`, filtrar el array resultante por `RoleCode eq '1001'` (rol "Cliente"). Campos: `PartyName`, `Phone`, `Mobile`, `Email`.
- **Ubicación de servicio**: `$expand=ServiceRequestServicePointLocation/ServiceRequestServicePointLocationAddress`. Campos confirmados: `Country`, `CountryText`, `State`, `StateText`, `District`, `Street`, `AddressLine2`, `PostalCode`, `City`.
- **Descripción del caso**: `$expand=ServiceRequestTextCollection`. Es un array de textos con `TypeCodeText`; el que interesa tiene `TypeCodeText eq 'Descripción del caso'`, campo `Text`.

## Diseño

### 1. `obtener_ticket_c4c_tiempo_real` (modificada)

Una sola llamada OData, con `$expand` a las tres propiedades navegables necesarias (confirmado que las tres pueden expandirse juntas en una misma petición):

`ServiceRequestCollection?$filter=ID eq '{id}'&$expand=ServiceRequestParty,ServiceRequestServicePointLocation/ServiceRequestServicePointLocationAddress,ServiceRequestTextCollection&$format=json`

De la respuesta:
- Los campos planos del ticket se toman directo (producto, garantía, empresa, etc.)
- `ServiceRequestParty` es un array — se filtra en Python por `RoleCode == '1001'` (rol "Cliente") para sacar nombre, teléfono, celular y email.
- `ServiceRequestServicePointLocation.ServiceRequestServicePointLocationAddress` da los campos de ubicación directo.
- `ServiceRequestTextCollection` es un array de textos — se filtra por `TypeCodeText == 'Descripción del caso'` para sacar el texto real de la queja del cliente.

El diccionario que se devuelve a la IA pasa de 10 a ~25 campos, organizados por sección: datos generales, cliente, ubicación, producto/garantía, descripción del caso.

### 2. `buscar_tickets_c4c` (reemplaza a `consultar_tickets_c4c_por_tienda_y_fecha`)

Firma: `buscar_tickets_c4c(tienda: str = None, fecha_inicio: str = None, fecha_fin: str = None, filtros: list[dict] = None)`

- `tienda`/`fecha_inicio`/`fecha_fin`: igual que hoy, reutiliza la resolución de tienda existente (mapa + búsqueda de respaldo en SQL).
- `filtros`: lista de `{"campo": "...", "valor": "..."}`. Diccionario cerrado de campos permitidos (ampliable después sin rediseño):

| campo (para la IA) | propiedad OData | tipo de coincidencia |
|---|---|---|
| estado | ServiceRequestLifeCycleStatusCodeText | exacta |
| cliente | BuyerPartyName | substring |
| producto | ProductDescription | substring |
| producto_registrado | InstallationPointID | exacta |
| tipo_servicio | ServiceTermsServiceIssueName | substring |
| prioridad | ServicePriorityCodeText | exacta |
| empresa | zIDEmpresa_SDK | exacta |

- Si `filtros` referencia un campo fuera de esta lista, la herramienta devuelve un error claro indicando los campos disponibles, sin ejecutar nada.
- Cada valor se escapa duplicando comillas simples (`'` → `''`) antes de insertarse en el filtro OData, para que ningún valor de usuario pueda alterar la lógica del filtro.
- **Modo conteo**: si la pregunta es sobre cantidad ("¿cuántos tickets...?"), la herramienta usa `$inlinecount=allpages` para pedir el total a SAP sin traer los registros — más rápido y barato en tokens que traer 200 filas para contarlas.
- **Modo listado**: cada ticket devuelve una proyección liviana (ID, fecha, estado, cliente, producto, tienda) — no el detalle completo de la Sección 1. Si se necesita el detalle completo de un ticket específico de la lista, la IA llama `obtener_ticket_c4c_tiempo_real` para ese ID.
- Tope de resultados: `$top=200`, igual que la herramienta actual.

### 3. Actualización del system prompt

Se actualiza la sección que documenta SAP C4C (junto a las reglas 5/5b existentes en `main.py`) para que la IA sepa: qué campos nuevos trae el detalle de ticket, qué campos puede usar como filtro en `buscar_tickets_c4c`, y cuándo usar cada herramienta (detalle puntual vs. búsqueda/conteo).

## Seguridad

- Ambas herramientas siguen siendo de solo lectura (HTTP GET) — no hay superficie de escritura nueva.
- El diccionario cerrado de campos filtrables evita que se pueda filtrar por cualquier propiedad arbitraria de SAP.
- Escapado de comillas simples en los valores de filtro, para prevenir inyección en la sintaxis de `$filter` de OData (equivalente al problema de inyección SQL, pero para OData).

## Manejo de errores

- Campo de filtro no permitido → mensaje claro listando los campos disponibles, sin ejecutar la consulta.
- Error de SAP (credenciales, timeout, sintaxis) → se propaga el mensaje tal como ya hacen las herramientas actuales hoy.
- Ticket no encontrado → mensaje explícito, igual que hoy.

## Pruebas

1. Pruebas unitarias para la función que arma el filtro OData a partir de `filtros` (incluyendo el caso de escapado de comillas y el caso de campo no permitido).
2. Verificación manual contra SAP real: el ticket 1367167 usado en este diseño (para el detalle enriquecido) y una búsqueda real por tienda con al menos un filtro nuevo (para `buscar_tickets_c4c`), antes de dar por cerrada cada tarea de implementación.
