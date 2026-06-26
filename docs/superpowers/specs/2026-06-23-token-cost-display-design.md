# Token & Cost Display — Design Spec
**Date:** 2026-06-23  
**Status:** Approved

## Overview

Mostrar a los usuarios cuántos tokens consumió cada consulta al asistente SIATC.IA y cuánto costó en USD, usando los datos de uso que devuelve la API de DeepSeek. Se muestra en dos lugares: un badge debajo de cada respuesta del asistente, y un panel desplegable con el acumulado de la conversación activa.

---

## Architecture

El flujo SSE existente (`/api/chat/stream`) se extiende con un nuevo evento `usage` que el backend emite justo antes del evento `done`. El frontend captura ese evento, lo adjunta al mensaje del asistente en el estado de React, y lo renderiza en dos vistas.

No se requiere cambio en base de datos ni endpoints nuevos.

---

## Backend — `backend/main.py`

### Acumulación de usage

Dentro del loop `for iteration in range(max_iters)` en `stream_chat_response`, después de cada llamada a `client.chat.completions.create(...)`, acumular los campos del objeto `response.usage`:

```python
# Variables acumuladoras (inicializar antes del loop)
acc_cache_hit   = 0
acc_cache_miss  = 0
acc_completion  = 0

# Dentro del loop, después de recibir la respuesta:
if response.usage:
    acc_cache_hit  += getattr(response.usage, 'prompt_cache_hit_tokens',  0)
    acc_cache_miss += getattr(response.usage, 'prompt_cache_miss_tokens', 0)
    acc_completion += response.usage.completion_tokens or 0
```

### Cálculo de costo

Al finalizar el loop (justo antes de emitir `done`), calcular el costo según precios DeepSeek:

| Tipo              | Precio         |
|-------------------|----------------|
| Input cache hit   | $0.07 / 1M tokens  |
| Input cache miss  | $0.27 / 1M tokens  |
| Output            | $1.10 / 1M tokens  |

```python
cost_usd = (
    acc_cache_hit  * 0.07 +
    acc_cache_miss * 0.27 +
    acc_completion * 1.10
) / 1_000_000
```

### Nuevo evento SSE `usage`

Emitir antes del evento `done` (y antes del `return`):

```python
yield sse({
    "type": "usage",
    "prompt_cache_hit_tokens":  acc_cache_hit,
    "prompt_cache_miss_tokens": acc_cache_miss,
    "completion_tokens":        acc_completion,
    "total_tokens":             acc_cache_hit + acc_cache_miss + acc_completion,
    "cost_usd":                 round(cost_usd, 8)
})
```

Este evento también debe emitirse en la rama del límite de iteraciones (el fallback al final del loop).

---

## Frontend — `frontend/src/App.jsx`

### Estado temporal de usage

Agregar un ref para almacenar el último evento `usage` recibido mientras llega el stream:

```js
const lastUsageRef = useRef(null);
```

### Captura del evento SSE

En el `switch(event.type)` de `handleSendMessage`, agregar:

```js
case 'usage':
  lastUsageRef.current = event;
  break;
```

### Adjuntar usage al mensaje del asistente

En el `case 'done'`, al hacer `push` del mensaje del asistente, adjuntar el usage capturado:

```js
chat.messages.push({
  role: 'assistant',
  content: accumulated,
  usage: lastUsageRef.current || undefined
});
lastUsageRef.current = null; // reset para el próximo mensaje
```

---

## Frontend — Badge por mensaje (`frontend/src/components/ChatArea.jsx`)

En el renderizado de cada mensaje del asistente, si el mensaje tiene `msg.usage`, renderizar debajo del contenido:

```jsx
{msg.usage && (
  <div className="msg-usage-badge">
    🔢 {msg.usage.total_tokens.toLocaleString()} tokens
    &nbsp;·&nbsp;
    ${msg.usage.cost_usd.toFixed(6)} USD
  </div>
)}
```

**Estilos:** texto pequeño, color gris discreto (`var(--text-muted)` o similar), alineado a la derecha del bloque del mensaje.

---

## Frontend — Panel desplegable de acumulado

### Ícono en el header

En `ChatArea.jsx`, en la barra superior del chat, agregar un botón con ícono (💰 o similar) junto a los botones existentes (tema, sidebar, etc.). Solo visible cuando el chat activo tiene al menos un mensaje con `usage`.

### Estado del panel

```js
const [showCostPanel, setShowCostPanel] = useState(false);
```

### Cálculo del acumulado

Derivado de los mensajes del chat activo:

```js
const conversationUsage = useMemo(() => {
  return activeMessages.reduce((acc, msg) => {
    if (!msg.usage) return acc;
    return {
      messages:  acc.messages + 1,
      cache_hit: acc.cache_hit + msg.usage.prompt_cache_hit_tokens,
      cache_miss: acc.cache_miss + msg.usage.prompt_cache_miss_tokens,
      completion: acc.completion + msg.usage.completion_tokens,
      total:     acc.total + msg.usage.total_tokens,
      cost_usd:  acc.cost_usd + msg.usage.cost_usd,
    };
  }, { messages: 0, cache_hit: 0, cache_miss: 0, completion: 0, total: 0, cost_usd: 0 });
}, [activeMessages]);
```

### Contenido del panel

Panel flotante (posición absoluta, z-index alto) que muestra:

```
Costo de esta conversación
──────────────────────────────
Mensajes analizados:    8
Input (cache hit):     12,400 tokens
Input (cache miss):     2,100 tokens
Output:                 3,200 tokens
──────────────────────────────
Total tokens:          17,700
Costo total:          $0.00541 USD
```

---

## Error Handling

- Si `response.usage` es `None` (edge case), `getattr` con valor por defecto `0` lo maneja silenciosamente.
- Si `msg.usage` no existe en un mensaje (mensajes cargados de localStorage antes del feature), el badge simplemente no se renderiza.
- El panel de acumulado muestra `$0.000000` si ningún mensaje tiene `usage` aún (no rompe la UI).

---

## Scope — Fuera de alcance

- Persistencia de tokens/costos en base de datos (analytics históricos).
- Conversión a soles PEN.
- Alertas o límites de gasto.
- Tokens de llamadas al endpoint `/api/chat/title` (generación de título).
