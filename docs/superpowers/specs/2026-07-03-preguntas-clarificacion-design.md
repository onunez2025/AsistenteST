# Diseño: Preguntas de clarificación antes de operaciones costosas

**Fecha:** 2026-07-03
**Origen:** durante pruebas reales del chat, una pregunta sobre "fugas de gas confirmadas" disparó un análisis masivo de 15,467 tickets sin que el asistente advirtiera el volumen ni ofreciera acotar el alcance primero.

---

## Objetivo

Dar al asistente una forma de pausar y preguntarle al usuario — con opciones concretas, como un formulario de selección — **antes** de ejecutar una operación lenta o costosa, en vez de lanzarla a ciegas. Limitado a tres disparadores conocidos:

1. Análisis masivo (`iniciar_analisis_masivo`) con volumen grande o incierto.
2. Exportación completa de una encuesta de Qualtrics sin filtro de ticket/fecha.
3. Consultas SQL claramente amplias y sin acotar (ej. "todos los tickets abiertos").

Fuera de estos tres casos, el asistente **no** debe usar esta capacidad — no es un mecanismo general de resolución de ambigüedad, es específicamente para evitar lanzar trabajo caro sin confirmar alcance.

---

## Arquitectura

**Enfoque elegido: la pregunta termina el turno; la respuesta es un mensaje nuevo normal.**

No hay pausa real de la conexión ni estado "a medias" guardado en el servidor. El modelo llama a una herramienta nueva, el backend la detecta, emite un evento y cierra el stream como si fuera una respuesta final. Cuando el usuario hace clic en una opción (o escribe su propia respuesta), eso viaja al backend **exactamente como cualquier mensaje de chat nuevo** — mismo endpoint, mismo flujo de guardado, mismo loop de herramientas. El modelo retoma con el historial completo de la conversación como contexto.

Se descartó pausar el loop de verdad (guardar el estado exacto de tool_calls a medias y reanudarlo) por requerir una pieza nueva de estado en el servidor (memoria o tabla nueva) que no sobrevive a un reinicio del backend y no encaja con el resto del sistema, que hoy es completamente stateless entre requests.

```
Usuario pregunta algo ambiguo/costoso
        │
        ▼
Modelo llama preguntar_usuario(pregunta, opciones, permite_texto_libre)
        │
        ▼
Backend detecta el nombre de la herramienta ANTES de despacharla a un MCP server
        │
        ▼
Emite SSE {"type": "question", ...} y cierra el stream (equivalente a "done")
        │
        ▼
Frontend renderiza tarjeta con botones dentro del mensaje del asistente
        │
        ▼
Usuario hace clic (o escribe texto libre)
        │
        ▼
Se envía como mensaje de usuario normal → mismo flujo de chat de siempre
```

---

## 1. Herramienta nueva

Se define directamente en `backend/main.py`, junto al resto de `openai_tools` — no es una herramienta de datos real, así que no necesita un servidor MCP propio.

```json
{
  "type": "function",
  "function": {
    "name": "preguntar_usuario",
    "description": "Pausa para preguntarle al usuario ANTES de ejecutar una operación lenta o costosa (análisis masivo, exportación completa de Qualtrics, consulta SQL sin filtros que traerá miles de filas). Úsala para confirmar alcance, no para dudas triviales. Máximo una vez por turno; nunca repitas una pregunta ya respondida en la misma conversación.",
    "parameters": {
      "type": "object",
      "properties": {
        "pregunta":            { "type": "string",  "description": "La pregunta, breve y clara. Incluye números concretos cuando existan (ej. cantidad de filas, tiempo estimado)." },
        "opciones":            { "type": "array", "items": { "type": "string" }, "minItems": 2, "maxItems": 4, "description": "2 a 4 opciones concretas de respuesta." },
        "permite_texto_libre": { "type": "boolean", "description": "Si además debe mostrarse un campo para que el usuario escriba su propia respuesta." }
      },
      "required": ["pregunta", "opciones"]
    }
  }
}
```

---

## 2. Backend (`stream_chat_response` en `main.py`)

**Nuevo evento SSE**, agregado a los ya existentes (`status`, `tool_start`, `tool_end`, `token`, `usage`, `done`, `error`):

```json
{"type": "question", "pregunta": "...", "opciones": ["...", "..."], "permite_texto_libre": true}
```

En el loop que hoy itera sobre `tool_calls` (justo antes de resolver `tool_to_srv.get(fn_name)`), se agrega un caso especial que corta el flujo normal:

```python
for tc in tool_calls:
    fn_name = tc.function.name
    fn_args = json.loads(tc.function.arguments)

    if fn_name == "preguntar_usuario":
        opciones = fn_args.get("opciones") or []
        if not fn_args.get("pregunta") or not (2 <= len(opciones) <= 4):
            # Args inválidos: se trata como error de herramienta normal, el modelo reintenta
            result = "Error: 'pregunta' es obligatoria y 'opciones' debe tener entre 2 y 4 elementos."
            messages.append({"role": "tool", "tool_call_id": tc.id, "name": fn_name, "content": result})
            continue

        yield sse({"type": "question", **fn_args})
        yield emit_usage(acc_cache_hit, acc_cache_miss, acc_completion)
        yield sse({"type": "done"})
        return   # cierra el generador; no se vuelve a llamar a DeepSeek en este turno

    # ... resto del loop sin cambios (tool_start, call_mcp_tool, tool_end) ...
```

Si `preguntar_usuario` aparece junto con otras tool_calls en la misma respuesta del modelo, tiene prioridad — el `return` corta el procesamiento del resto antes de llegar a ellas.

**Persistencia:** el mensaje del asistente que contiene la pregunta se guarda en el historial (vía el POST a `/api/conversations/{id}/messages` que ya existe hoy) con el siguiente formato de texto, sin cambios de esquema en la base de datos:

````
```pregunta-usuario
{"pregunta": "...", "opciones": ["...", "..."], "permite_texto_libre": true}
```
````

---

## 3. Frontend

**`App.jsx`** — nuevo `case 'question':` en el switch de eventos SSE (junto a `token`, `done`, etc.): guarda el mensaje del asistente con el bloque `pregunta-usuario`, limpia `streamingContent`/`isLoading` igual que `done`, y termina el turno. No dispara ninguna llamada nueva.

**`ChatArea.jsx`** — al renderizar un mensaje del asistente, si el contenido incluye un bloque ` ```pregunta-usuario `, se extrae el JSON y se muestra una tarjeta con:
- El texto de la pregunta.
- Un botón por cada opción (mismo estilo visual que los chips de sugerencias iniciales — `SuggestionChips.jsx`).
- Si `permite_texto_libre` es `true`, un campo de texto adicional con botón "Enviar".

Al hacer clic en una opción, o enviar el texto libre, se llama a la **misma función `handleSendMessage` que ya se usa para cualquier mensaje** con el texto de la opción elegida — no hay lógica nueva de envío.

**Regla de interactividad:** los botones solo se muestran activos si ese mensaje es el último de la conversación y no hay ningún mensaje de usuario después. Preguntas ya respondidas en el historial se muestran de forma legible (pregunta + opciones listadas) pero sin botones clickeables.

**Markdown:** se agrega una excepción de una línea en el renderizador de bloques de código para que `pregunta-usuario` no se intente resaltar como un lenguaje de programación.

---

## 4. Reglas para el modelo (system prompt)

Nueva sección en `build_system_prompt`, acotada a los tres disparadores:

- **Antes de `iniciar_analisis_masivo`**: si el volumen no está claro, correr primero un `COUNT(*)` liviano. Menos de ~2,000 filas → proceder sin preguntar. Más que eso → preguntar con el número real y el tiempo estimado, ofreciendo acotar por CAS, técnico o rango de fechas.
- **Antes de exportar una encuesta completa de Qualtrics** sin ticket ni fecha específicos.
- **Antes de una consulta SQL amplia y sin acotar.**
- Máximo una pregunta por turno. Nunca repetir una pregunta ya respondida en la conversación. Si el usuario ya dio alcance suficiente (fechas, CAS, etc.), no preguntar — solo cuando el volumen/costo real es lo ambiguo.

---

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `backend/main.py` | Nueva entrada en `openai_tools`, caso especial en el loop de `tool_calls`, nuevo evento SSE, sección nueva en `build_system_prompt` |
| `frontend/src/App.jsx` | Nuevo `case 'question'` en el manejo de eventos SSE |
| `frontend/src/components/ChatArea.jsx` | Detección del bloque `pregunta-usuario` y renderizado de la tarjeta con botones |
| `frontend/src/utils/markdown.js` | Excepción para no resaltar `pregunta-usuario` como código |

Ningún cambio de base de datos, ningún endpoint nuevo.

---

## Limitaciones conocidas (v1)

- Si el modelo ya había explorado algo (ej. revisó categorías de materiales) antes de preguntar, esa exploración no se conserva literalmente — el modelo la vuelve a derivar en el siguiente turno a partir del historial de la conversación. Es rápido y barato, no un problema real en la práctica observada.
- El límite "menos de ~2,000 filas → no preguntar" es una heurística inicial en el prompt, no una regla dura del código. Puede necesitar ajuste con uso real.
- Esta capacidad está deliberadamente acotada a los tres disparadores descritos. Ampliarla a resolución general de ambigüedad es una decisión futura separada, no parte de este diseño.
