# Token & Cost Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar al usuario cuántos tokens consumió cada consulta y su costo en USD, con un badge debajo de cada respuesta del asistente y un panel desplegable con el acumulado de la conversación activa.

**Architecture:** El backend acumula el `usage` de todas las llamadas a DeepSeek dentro del loop de iteraciones y emite un evento SSE `{"type":"usage",...}` antes del evento `done`. El frontend captura ese evento, lo adjunta al objeto del mensaje del asistente en el estado de React, y lo renderiza en dos lugares: badge debajo del mensaje y panel flotante en el header.

**Tech Stack:** Python 3 / FastAPI (backend), React / Vite (frontend), DeepSeek API vía OpenAI client.

## Global Constraints

- Modelo DeepSeek: `deepseek-chat`. Precios: cache hit input $0.07/M tokens, cache miss input $0.27/M tokens, output $1.10/M tokens.
- Los campos de usage de DeepSeek en el objeto `response.usage`: `prompt_cache_hit_tokens`, `prompt_cache_miss_tokens`, `completion_tokens`. Usar `getattr(..., 0)` para defensividad.
- Solo mostrar en USD. Sin conversión a PEN.
- Los mensajes cargados de localStorage antes del feature no tienen `usage` — el badge simplemente no se renderiza.
- CSS usa variables: `--text-muted`, `--text-secondary`, `--bg-surface`, `--bg-hover`, `--border`, `--shadow-md`, `--radius-sm`, `--radius-md`, `--transition`.

---

## File Map

| Archivo | Cambio |
|---------|--------|
| `backend/main.py` | Acumular usage en loop, calcular costo, emitir evento SSE `usage` |
| `frontend/src/App.jsx` | Añadir `lastUsageRef`, capturar evento `usage`, adjuntar al mensaje en `done` |
| `frontend/src/components/ChatArea.jsx` | Badge bajo mensajes asistente, botón + panel de acumulado |
| `frontend/src/App.css` | Estilos para `.msg-usage-badge`, `.cost-panel`, `.cost-panel-row` |

---

## Task 1: Backend — Acumular usage y emitir evento SSE

**Files:**
- Modify: `backend/main.py` (función `stream_chat_response`, líneas ~671–804)

**Interfaces:**
- Produces: nuevo evento SSE `{"type":"usage","prompt_cache_hit_tokens":int,"prompt_cache_miss_tokens":int,"completion_tokens":int,"total_tokens":int,"cost_usd":float}`

- [ ] **Step 1: Agregar acumuladores antes del loop**

En `stream_chat_response`, justo antes de la línea `for iteration in range(max_iters):` (línea ~712), insertar:

```python
        acc_cache_hit  = 0
        acc_cache_miss = 0
        acc_completion = 0
```

- [ ] **Step 2: Acumular usage después de cada llamada a DeepSeek**

Dentro del loop, después de la línea `response = client.chat.completions.create(...)` y antes de `resp_msg = response.choices[0].message`, insertar:

```python
            if response.usage:
                acc_cache_hit  += getattr(response.usage, 'prompt_cache_hit_tokens',  0) or 0
                acc_cache_miss += getattr(response.usage, 'prompt_cache_miss_tokens', 0) or 0
                acc_completion += getattr(response.usage, 'completion_tokens',        0) or 0
```

- [ ] **Step 3: Crear helper inline para calcular y emitir el evento usage**

Agregar una función interna dentro de `stream_chat_response`, justo antes del loop, después de la línea `def sse(data: dict) -> str:`:

```python
        def emit_usage():
            cost = (
                acc_cache_hit  * 0.07 +
                acc_cache_miss * 0.27 +
                acc_completion * 1.10
            ) / 1_000_000
            return sse({
                "type": "usage",
                "prompt_cache_hit_tokens":  acc_cache_hit,
                "prompt_cache_miss_tokens": acc_cache_miss,
                "completion_tokens":        acc_completion,
                "total_tokens":             acc_cache_hit + acc_cache_miss + acc_completion,
                "cost_usd":                 round(cost, 8)
            })
```

**Importante:** `emit_usage` referencia `acc_cache_hit`, `acc_cache_miss`, `acc_completion` que son variables del scope enclosing, por lo que debe definirse DESPUÉS de esas variables o simplemente definirla justo antes del `yield sse({"type":"done"})` como una lambda. Si hay problemas con el closure en Python, usar una función con argumentos explícitos:

```python
        def emit_usage(hit, miss, comp):
            cost = (hit * 0.07 + miss * 0.27 + comp * 1.10) / 1_000_000
            return sse({
                "type": "usage",
                "prompt_cache_hit_tokens":  hit,
                "prompt_cache_miss_tokens": miss,
                "completion_tokens":        comp,
                "total_tokens":             hit + miss + comp,
                "cost_usd":                 round(cost, 8)
            })
```

- [ ] **Step 4: Emitir usage antes del done en el bloque de respuesta final**

Dentro del loop, en el bloque `if not tool_calls:` (línea ~749), justo antes de `yield sse({"type": "done"})`, agregar:

```python
                yield emit_usage(acc_cache_hit, acc_cache_miss, acc_completion)
                yield sse({"type": "done"})
                return
```

El bloque completo queda así:

```python
            if not tool_calls:
                if content_txt:
                    clean = remove_dsml_blocks(content_txt)
                    if clean:
                        yield sse({"type": "status", "message": "Redactando respuesta..."})
                        chunk_size = 20
                        for i in range(0, len(clean), chunk_size):
                            yield sse({"type": "token", "content": clean[i:i + chunk_size]})
                yield emit_usage(acc_cache_hit, acc_cache_miss, acc_completion)
                yield sse({"type": "done"})
                return
```

- [ ] **Step 5: Emitir usage antes del done en el fallback de iteraciones**

Al final de `stream_chat_response` (líneas ~799–800), cambiar:

```python
    # ANTES:
    yield sse({"type": "token", "content": "La consulta requirió demasiadas operaciones consecutivas. Por favor, simplifica la pregunta o solicita un reporte Excel para datos masivos."})
    yield sse({"type": "done"})

    # DESPUÉS:
    yield sse({"type": "token", "content": "La consulta requirió demasiadas operaciones consecutivas. Por favor, simplifica la pregunta o solicita un reporte Excel para datos masivos."})
    yield emit_usage(acc_cache_hit, acc_cache_miss, acc_completion)
    yield sse({"type": "done"})
```

- [ ] **Step 6: Verificar manualmente que el evento se emite**

Reiniciar el backend y hacer una consulta sencilla (ej. "hola"). En los logs del servidor o en las DevTools del navegador (Network → `/api/chat/stream` → Preview), verificar que aparece un evento `data: {"type":"usage",...}` antes del `data: {"type":"done"}`.

Ejemplo de salida esperada en DevTools:
```
data: {"type": "status", "message": "Analizando tu consulta..."}
data: {"type": "token", "content": "Hola..."}
data: {"type": "usage", "prompt_cache_hit_tokens": 0, "prompt_cache_miss_tokens": 1240, "completion_tokens": 38, "total_tokens": 1278, "cost_usd": 0.00037706}
data: {"type": "done"}
```

- [ ] **Step 7: Commit**

```bash
git add backend/main.py
git commit -m "feat: emit usage SSE event with token counts and cost per query"
```

---

## Task 2: Frontend App.jsx — Capturar evento usage y adjuntar al mensaje

**Files:**
- Modify: `frontend/src/App.jsx` (líneas ~84, ~260–292)

**Interfaces:**
- Consumes: evento SSE `{"type":"usage","prompt_cache_hit_tokens":int,"prompt_cache_miss_tokens":int,"completion_tokens":int,"total_tokens":int,"cost_usd":float}` (de Task 1)
- Produces: mensajes del asistente con campo `usage: { prompt_cache_hit_tokens, prompt_cache_miss_tokens, completion_tokens, total_tokens, cost_usd }` en el estado `chats`

- [ ] **Step 1: Agregar ref para almacenar el último evento usage**

En `App.jsx`, en la sección donde están los otros `useRef` (línea ~84, junto a `fileInputRef` y `abortControllerRef`), agregar:

```js
  const lastUsageRef = useRef(null);
```

- [ ] **Step 2: Capturar el evento usage en el switch del SSE reader**

En `handleSendMessage`, dentro del `switch (event.type)` (línea ~264), agregar el nuevo case ANTES del `case 'done'`:

```js
            case 'usage':
              lastUsageRef.current = event;
              break;
```

El switch completo queda:
```js
          switch (event.type) {
            case 'status':
              setProgressLabel(event.message || '');
              break;
            case 'tool_start':
              setProgressLabel(event.label || `Ejecutando ${event.tool}...`);
              break;
            case 'tool_end':
              setProgressLabel('Procesando resultados...');
              break;
            case 'usage':
              lastUsageRef.current = event;
              break;
            case 'token':
              accumulated += event.content || '';
              setStreamingContent(accumulated);
              break;
            case 'done':
              // ver step 3
              break;
            case 'error':
              throw new Error(event.message || 'Error desconocido del servidor');
          }
```

- [ ] **Step 3: Adjuntar usage al mensaje del asistente en el case 'done'**

Reemplazar el bloque `case 'done':` existente (línea ~278) con:

```js
            case 'done':
              setChats(prev => {
                const updated = [...prev];
                const chat    = updated.find(c => c.id === currentChatId);
                if (chat) {
                  chat.messages.push({
                    role: 'assistant',
                    content: accumulated,
                    usage: lastUsageRef.current || undefined
                  });
                }
                return updated;
              });
              lastUsageRef.current = null;
              setStreamingContent('');
              setProgressLabel('');
              setIsLoading(false);
              abortControllerRef.current = null;
              break;
```

- [ ] **Step 4: Verificar en React DevTools**

Con React DevTools abierto en el navegador, después de enviar un mensaje, buscar en el estado del componente `App` → `chats` → el chat activo → último mensaje. Debe tener:

```js
{
  role: "assistant",
  content: "...",
  usage: {
    type: "usage",
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: 1240,
    completion_tokens: 38,
    total_tokens: 1278,
    cost_usd: 0.00037706
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: capture usage SSE event and store on assistant messages"
```

---

## Task 3: Frontend ChatArea.jsx — Badge por mensaje y panel de acumulado

**Files:**
- Modify: `frontend/src/components/ChatArea.jsx`

**Interfaces:**
- Consumes: `msg.usage` en cada mensaje asistente (de Task 2) — objeto con `{ prompt_cache_hit_tokens, prompt_cache_miss_tokens, completion_tokens, total_tokens, cost_usd }`
- Consumes: `activeMessages` prop (ya existente) — array de mensajes del chat activo
- Produces: UI — badge de tokens/costo bajo cada mensaje + botón 💰 en topbar + panel flotante con acumulado

- [ ] **Step 1: Agregar state y memo al componente ChatArea**

Al inicio de la función `ChatArea`, junto a los otros `useState` (línea ~25), agregar:

```js
  const [showCostPanel, setShowCostPanel] = useState(false);

  const conversationUsage = React.useMemo(() => {
    return (activeMessages || []).reduce((acc, msg) => {
      if (!msg.usage) return acc;
      return {
        messages:   acc.messages + 1,
        cache_hit:  acc.cache_hit  + (msg.usage.prompt_cache_hit_tokens  || 0),
        cache_miss: acc.cache_miss + (msg.usage.prompt_cache_miss_tokens || 0),
        completion: acc.completion + (msg.usage.completion_tokens        || 0),
        total:      acc.total      + (msg.usage.total_tokens             || 0),
        cost_usd:   acc.cost_usd   + (msg.usage.cost_usd                || 0),
      };
    }, { messages: 0, cache_hit: 0, cache_miss: 0, completion: 0, total: 0, cost_usd: 0 });
  }, [activeMessages]);
```

- [ ] **Step 2: Agregar botón 💰 y panel flotante en el topbar**

En la función `ChatArea`, en el bloque `<div className="topbar-actions">` (línea ~360), agregar DESPUÉS del botón de tema existente:

```jsx
          {conversationUsage.messages > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                className="topbar-icon-btn"
                onClick={() => setShowCostPanel(prev => !prev)}
                title="Ver costo de la conversación"
                style={{ fontSize: '16px' }}
              >
                💰
              </button>

              {showCostPanel && (
                <div className="cost-panel">
                  <div className="cost-panel-title">Costo de esta conversación</div>
                  <div className="cost-panel-divider" />
                  <div className="cost-panel-row">
                    <span>Mensajes analizados</span>
                    <span>{conversationUsage.messages}</span>
                  </div>
                  <div className="cost-panel-row">
                    <span>Input (cache hit)</span>
                    <span>{conversationUsage.cache_hit.toLocaleString()} tokens</span>
                  </div>
                  <div className="cost-panel-row">
                    <span>Input (cache miss)</span>
                    <span>{conversationUsage.cache_miss.toLocaleString()} tokens</span>
                  </div>
                  <div className="cost-panel-row">
                    <span>Output</span>
                    <span>{conversationUsage.completion.toLocaleString()} tokens</span>
                  </div>
                  <div className="cost-panel-divider" />
                  <div className="cost-panel-row cost-panel-total">
                    <span>Total tokens</span>
                    <span>{conversationUsage.total.toLocaleString()}</span>
                  </div>
                  <div className="cost-panel-row cost-panel-total">
                    <span>Costo total</span>
                    <span>${conversationUsage.cost_usd.toFixed(6)} USD</span>
                  </div>
                </div>
              )}
            </div>
          )}
```

El bloque `topbar-actions` completo queda:

```jsx
        <div className="topbar-actions">
          <button className="topbar-icon-btn" onClick={toggleTheme} title="Cambiar tema">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {conversationUsage.messages > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                className="topbar-icon-btn"
                onClick={() => setShowCostPanel(prev => !prev)}
                title="Ver costo de la conversación"
                style={{ fontSize: '16px' }}
              >
                💰
              </button>
              {showCostPanel && (
                <div className="cost-panel">
                  <div className="cost-panel-title">Costo de esta conversación</div>
                  <div className="cost-panel-divider" />
                  <div className="cost-panel-row">
                    <span>Mensajes analizados</span>
                    <span>{conversationUsage.messages}</span>
                  </div>
                  <div className="cost-panel-row">
                    <span>Input (cache hit)</span>
                    <span>{conversationUsage.cache_hit.toLocaleString()} tokens</span>
                  </div>
                  <div className="cost-panel-row">
                    <span>Input (cache miss)</span>
                    <span>{conversationUsage.cache_miss.toLocaleString()} tokens</span>
                  </div>
                  <div className="cost-panel-row">
                    <span>Output</span>
                    <span>{conversationUsage.completion.toLocaleString()} tokens</span>
                  </div>
                  <div className="cost-panel-divider" />
                  <div className="cost-panel-row cost-panel-total">
                    <span>Total tokens</span>
                    <span>{conversationUsage.total.toLocaleString()}</span>
                  </div>
                  <div className="cost-panel-row cost-panel-total">
                    <span>Costo total</span>
                    <span>${conversationUsage.cost_usd.toFixed(6)} USD</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
```

- [ ] **Step 3: Agregar badge de usage debajo de cada mensaje del asistente**

En `renderMessages()`, dentro del bloque `if (msg.role === 'assistant')` (línea ~297), después del componente `<MessageActions ... />`, agregar:

```jsx
                    {msg.usage && (
                      <div className="msg-usage-badge">
                        🔢 {msg.usage.total_tokens.toLocaleString()} tokens
                        &nbsp;·&nbsp;
                        ${msg.usage.cost_usd.toFixed(6)} USD
                      </div>
                    )}
```

El bloque del mensaje asistente queda:

```jsx
          if (msg.role === 'assistant') {
            return (
              <div key={index} className="message-container message-ai">
                <div className="message-ai-inner">
                  <div className="message-ai-avatar"><BotSparkleIcon /></div>
                  <div className="message-ai-body">
                    <div className="message-ai-name">SIATC.IA</div>
                    <div className="message-ai-text">
                      {renderMessageContent(msg.content, index)}
                    </div>
                    <MessageActions
                      messageContent={msg.content || ''}
                      onRegenerate={handleRegenerate}
                      isLastAiMessage={index === lastAiIndex}
                    />
                    {msg.usage && (
                      <div className="msg-usage-badge">
                        🔢 {msg.usage.total_tokens.toLocaleString()} tokens
                        &nbsp;·&nbsp;
                        ${msg.usage.cost_usd.toFixed(6)} USD
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }
```

- [ ] **Step 4: Verificar visualmente en el navegador**

1. Enviar un mensaje al asistente.
2. Verificar que debajo de la respuesta aparece un texto gris pequeño con los tokens y costo (aunque sin CSS del Task 4 se verá sin estilos, debe estar visible).
3. Verificar que aparece el ícono 💰 en el topbar.
4. Click en 💰 → debe aparecer el panel con el desglose.
5. Click de nuevo → el panel debe cerrarse.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatArea.jsx
git commit -m "feat: render token/cost badge on messages and cost summary panel in header"
```

---

## Task 4: CSS — Estilos para badge y panel

**Files:**
- Modify: `frontend/src/App.css` (agregar al final del archivo)

**Interfaces:**
- Produces: clases `.msg-usage-badge`, `.cost-panel`, `.cost-panel-title`, `.cost-panel-divider`, `.cost-panel-row`, `.cost-panel-total`

- [ ] **Step 1: Agregar estilos al final de App.css**

Agregar al final de `frontend/src/App.css`:

```css
/* ═══════════════════════════════════════════════
   TOKEN & COST DISPLAY
═══════════════════════════════════════════════ */

.msg-usage-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 0.72rem;
  color: var(--text-muted);
  font-family: 'Courier New', monospace;
  letter-spacing: 0.02em;
  opacity: 0.85;
}

.cost-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 200;
  min-width: 280px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 14px 16px;
  animation: fadeInDown 150ms ease;
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.cost-panel-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
}

.cost-panel-divider {
  height: 1px;
  background: var(--border);
  margin: 8px 0;
}

.cost-panel-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 0.82rem;
  color: var(--text-secondary);
  padding: 3px 0;
}

.cost-panel-row span:last-child {
  font-family: 'Courier New', monospace;
  color: var(--text-primary);
}

.cost-panel-total {
  font-weight: 600;
  color: var(--text-primary);
}

.cost-panel-total span:last-child {
  color: var(--color-primary);
}
```

- [ ] **Step 2: Verificar estilos en modo claro y oscuro**

1. Enviar un mensaje y verificar que el badge de tokens aparece gris y pequeño debajo del mensaje.
2. Abrir el panel 💰 y verificar que el panel tiene fondo correcto, bordes y tipografía legible.
3. Cambiar al tema claro (botón Sol/Luna) y repetir → los colores deben adaptarse via CSS variables.
4. En móvil (DevTools → viewport 375px), verificar que el panel no se sale de pantalla.

Si el panel se sale del viewport en móvil, ajustar el `right` en `.cost-panel` a `right: 0; max-width: calc(100vw - 32px);`.

- [ ] **Step 3: Commit final**

```bash
git add frontend/src/App.css
git commit -m "feat: styles for token/cost badge and cost summary panel"
```

---

## Self-Review

### Spec coverage

| Requisito del spec | Task que lo implementa |
|--------------------|------------------------|
| Acumular usage de todas las iteraciones del loop | Task 1, Steps 1–2 |
| Calcular costo con precios exactos (cache hit/miss) | Task 1, Step 3 |
| Emitir evento SSE `usage` antes de `done` | Task 1, Steps 4–5 |
| Emitir en el fallback de iteraciones también | Task 1, Step 5 |
| `lastUsageRef` en App.jsx | Task 2, Step 1 |
| Capturar `case 'usage'` en switch SSE | Task 2, Step 2 |
| Adjuntar `usage` al mensaje en `case 'done'` | Task 2, Step 3 |
| Reset de `lastUsageRef` tras uso | Task 2, Step 3 |
| Badge `🔢 X tokens · $Y USD` bajo cada mensaje | Task 3, Step 3 |
| Botón 💰 en topbar solo cuando hay mensajes con usage | Task 3, Step 2 |
| Panel desplegable con desglose completo | Task 3, Step 2 |
| Acumulado calculado con `useMemo` sobre `activeMessages` | Task 3, Step 1 |
| Estilos adaptativos a tema claro/oscuro | Task 4 |

### Tipos y nombres consistentes

- `lastUsageRef.current` → objeto `event` completo del SSE (tiene `type`, `prompt_cache_hit_tokens`, `prompt_cache_miss_tokens`, `completion_tokens`, `total_tokens`, `cost_usd`)
- `msg.usage` en el estado de chats → mismo objeto (incluyendo `type: "usage"` — inerte en el frontend, solo se usan los campos numéricos)
- `conversationUsage.cache_hit` / `cache_miss` / `completion` / `total` / `cost_usd` → usados consistentemente en el panel y en el memo

### Sin placeholders

Verificado — todos los steps tienen código exacto.
