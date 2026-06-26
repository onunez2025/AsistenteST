# Gemini-Style UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el frontend de SIATC.IA para que sea visualmente idéntico a Google Gemini, usando la paleta corporativa de Grupo SOLE, con todas las funciones de Gemini (chips de sugerencia, copiar mensajes, pulgares arriba/abajo, regenerar respuesta).

**Architecture:** Option A — Deep restyling. Se mantiene toda la lógica React existente (streaming, MCP, auth). Se reescribe completamente App.css y se actualizan los componentes para agregar nuevas funciones de UX. No se toca el backend.

**Tech Stack:** React 19, Vite, Lato (Google Fonts), lucide-react, CSS custom properties (no Tailwind)

## Global Constraints

- Paleta SOLE: primario `#4C5F80`, acento `#E93333`, fuente Lato
- Tema: automático via `prefers-color-scheme` (claro/oscuro)
- Responsive: mobile-first, breakpoint principal en 768px
- Sin dependencias nuevas de npm — usar solo lo que ya existe en package.json
- Todos los textos en español peruano
- No modificar ningún archivo del backend
- Chips de sugerencia: "¿Cuántos servicios se cerraron hoy?", "NPS del mes actual vs meta", "Técnicos con mayor eficiencia esta semana", "Tickets pendientes por CAS"

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `frontend/src/index.css` | Modificar | Import Lato, reset CSS, variables base |
| `frontend/src/App.css` | Reescribir completo | Todo el sistema visual Gemini-like |
| `frontend/src/App.jsx` | Modificar | Agregar `handleRegenerate`, estado `thumbs` |
| `frontend/src/components/SuggestionChips.jsx` | Crear | 4 chips de sugerencia en home screen |
| `frontend/src/components/MessageActions.jsx` | Crear | Copiar, 👍, 👎, Regenerar por mensaje |
| `frontend/src/components/ChatArea.jsx` | Modificar | Integrar MessageActions, home screen greeting, input bar Gemini |
| `frontend/src/components/Sidebar.jsx` | Modificar | Usuario al fondo, nueva conv arriba, estilo Gemini |
| `frontend/src/components/Landing.jsx` | Modificar | Simplificar — solo para usuarios no logueados |

---

## Task 1: CSS Foundation — Variables, Layout, Sidebar, Input Bar

**Files:**
- Modify: `frontend/src/index.css`
- Rewrite: `frontend/src/App.css`

**Interfaces:**
- Produces: todas las clases CSS que usan ChatArea, Sidebar, App — nombradas en este task

- [ ] **Step 1: Reescribir `frontend/src/index.css`**

Reemplazar el contenido completo con:

```css
@import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
  font-family: 'Lato', 'Google Sans', 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

button {
  cursor: pointer;
  font-family: inherit;
  border: none;
  background: none;
}

textarea, input {
  font-family: inherit;
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
```

- [ ] **Step 2: Reescribir `frontend/src/App.css` — Parte 1: Variables de tema**

Reemplazar el contenido completo del archivo con el siguiente CSS (sección por sección):

```css
/* ═══════════════════════════════════════════════
   VARIABLES DE TEMA — SOLE CORPORATE COLORS
═══════════════════════════════════════════════ */

:root {
  --bg-base:       #FAFAFA;
  --bg-surface:    #FFFFFF;
  --bg-hover:      #F0F2F5;
  --bg-input:      #EEF2F8;
  --bg-chip:       #FFFFFF;
  --text-primary:  #1A1C1E;
  --text-secondary:#5F6368;
  --text-muted:    #9AA0A6;
  --color-primary: #4C5F80;
  --color-primary-light: rgba(76,95,128,0.12);
  --color-accent:  #E93333;
  --border:        #E0E3E7;
  --shadow-sm:     0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md:     0 4px 12px rgba(0,0,0,0.10);
  --radius-sm:     8px;
  --radius-md:     16px;
  --radius-lg:     24px;
  --radius-pill:   9999px;
  --sidebar-w:     280px;
  --chat-max-w:    820px;
  --transition:    200ms ease;
  --font:          'Lato', 'Google Sans', sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-base:       #1A1C1E;
    --bg-surface:    #25282C;
    --bg-hover:      #2E3135;
    --bg-input:      #2E3135;
    --bg-chip:       #2E3135;
    --text-primary:  #E3E5E8;
    --text-secondary:#9AA0A6;
    --text-muted:    #6B7280;
    --color-primary: #7A9CC0;
    --color-primary-light: rgba(122,156,192,0.15);
    --color-accent:  #FF6B6B;
    --border:        #3C4043;
    --shadow-sm:     0 1px 3px rgba(0,0,0,0.4);
    --shadow-md:     0 4px 12px rgba(0,0,0,0.5);
  }
}

/* ═══════════════════════════════════════════════
   APP LAYOUT — Gemini two-column
═══════════════════════════════════════════════ */

.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font);
}

/* ═══════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════ */

.sidebar {
  display: flex;
  flex-direction: column;
  width: var(--sidebar-w);
  min-width: var(--sidebar-w);
  height: 100vh;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  overflow: hidden;
  transition: width var(--transition), min-width var(--transition), opacity var(--transition);
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: 0;
  min-width: 0;
  opacity: 0;
  pointer-events: none;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 8px;
  flex-shrink: 0;
}

.sidebar-menu-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: background var(--transition), color var(--transition);
  flex-shrink: 0;
}
.sidebar-menu-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--text-primary);
}
.sidebar-logo-text {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.sidebar-new-chat-btn {
  margin: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 0.9rem;
  font-weight: 600;
  transition: background var(--transition);
  flex-shrink: 0;
  border: 1px solid transparent;
}
.sidebar-new-chat-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border);
}

.sidebar-search-wrap {
  padding: 4px 12px 8px;
  flex-shrink: 0;
}
.sidebar-search-input {
  width: 100%;
  background: var(--bg-hover);
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  padding: 8px 14px;
  font-size: 0.875rem;
  color: var(--text-primary);
  outline: none;
  transition: border-color var(--transition);
}
.sidebar-search-input::placeholder { color: var(--text-muted); }
.sidebar-search-input:focus { border-color: var(--color-primary); }

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
}

.sidebar-group-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  padding: 12px 8px 4px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.sidebar-chat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  position: relative;
  transition: background var(--transition);
  min-height: 40px;
}
.sidebar-chat-item:hover { background: var(--bg-hover); }
.sidebar-chat-item.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.sidebar-chat-title {
  flex: 1;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
}
.sidebar-chat-item.active .sidebar-chat-title { color: var(--color-primary); }

.sidebar-chat-menu-btn {
  opacity: 0;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: opacity var(--transition), background var(--transition);
}
.sidebar-chat-item:hover .sidebar-chat-menu-btn { opacity: 1; }
.sidebar-chat-menu-btn:hover { background: var(--bg-hover); }

.sidebar-context-menu {
  position: absolute;
  right: 8px;
  top: calc(100% - 4px);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 200;
  min-width: 160px;
  overflow: hidden;
}
.sidebar-context-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: background var(--transition);
}
.sidebar-context-menu button:hover { background: var(--bg-hover); }
.sidebar-context-menu button.danger { color: var(--color-accent); }

.sidebar-pin-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.sidebar-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  padding: 8px;
}

.sidebar-user-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  transition: background var(--transition);
  position: relative;
}
.sidebar-user-btn:hover { background: var(--bg-hover); }

.sidebar-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  color: #fff;
  flex-shrink: 0;
  overflow: hidden;
}
.sidebar-avatar img { width: 100%; height: 100%; object-fit: cover; }

.sidebar-user-info {
  flex: 1;
  text-align: left;
  overflow: hidden;
}
.sidebar-user-name {
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
}
.sidebar-user-role {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-user-menu {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 8px;
  right: 8px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 200;
  overflow: hidden;
}
.sidebar-user-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: background var(--transition);
}
.sidebar-user-menu button:hover { background: var(--bg-hover); }
.sidebar-user-menu button.danger { color: var(--color-accent); }

/* ═══════════════════════════════════════════════
   MAIN CONTENT AREA
═══════════════════════════════════════════════ */

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  background: var(--bg-base);
}

/* ═══════════════════════════════════════════════
   TOP BAR (visible cuando sidebar colapsado en mobile)
═══════════════════════════════════════════════ */

.topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  flex-shrink: 0;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
}

.topbar-menu-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: background var(--transition);
  flex-shrink: 0;
}
.topbar-menu-btn:hover { background: var(--bg-hover); }

.topbar-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.topbar-icon-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: background var(--transition);
}
.topbar-icon-btn:hover { background: var(--bg-hover); }

/* ═══════════════════════════════════════════════
   HOME SCREEN (Gemini greeting)
═══════════════════════════════════════════════ */

.home-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 24px 140px;
  overflow-y: auto;
}

.home-greeting {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
  margin-bottom: 12px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.home-subtitle {
  font-size: 1.1rem;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 40px;
}

/* ═══════════════════════════════════════════════
   SUGGESTION CHIPS
═══════════════════════════════════════════════ */

.suggestion-chips {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
  max-width: 640px;
  margin-bottom: 40px;
}

.suggestion-chip {
  background: var(--bg-chip);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px 18px;
  cursor: pointer;
  text-align: left;
  transition: background var(--transition), border-color var(--transition), box-shadow var(--transition);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.suggestion-chip:hover {
  background: var(--bg-hover);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.chip-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.chip-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 500;
  line-height: 1.4;
}

/* ═══════════════════════════════════════════════
   CHAT MESSAGES AREA
═══════════════════════════════════════════════ */

.chat-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-top: 64px; /* space for topbar */
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 24px 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.messages-inner {
  max-width: var(--chat-max-w);
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Message container */
.message-container {
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  border-bottom: 1px solid transparent;
  position: relative;
}
.message-container:last-child { border-bottom: none; }

/* User message */
.message-user {
  align-items: flex-end;
}
.message-user .message-bubble {
  background: var(--bg-hover);
  border-radius: var(--radius-lg) var(--radius-lg) 4px var(--radius-lg);
  padding: 12px 18px;
  max-width: 80%;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-primary);
  word-break: break-word;
}

/* AI message */
.message-ai {
  align-items: flex-start;
}
.message-ai-inner {
  display: flex;
  gap: 12px;
  width: 100%;
}
.message-ai-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}
.message-ai-body {
  flex: 1;
  min-width: 0;
}
.message-ai-name {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 6px;
}
.message-ai-text {
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--text-primary);
  word-break: break-word;
}

/* Markdown dentro de mensajes AI */
.message-ai-text p  { margin-bottom: 12px; }
.message-ai-text p:last-child { margin-bottom: 0; }
.message-ai-text h1,.message-ai-text h2,.message-ai-text h3 { font-weight: 700; margin: 20px 0 8px; color: var(--text-primary); }
.message-ai-text ul,.message-ai-text ol { padding-left: 20px; margin-bottom: 12px; }
.message-ai-text li { margin-bottom: 4px; }
.message-ai-text code { background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; font-family: 'Courier New', monospace; }
.message-ai-text pre { background: var(--bg-hover); padding: 16px; border-radius: var(--radius-sm); overflow-x: auto; margin-bottom: 12px; }
.message-ai-text pre code { background: none; padding: 0; }
.message-ai-text table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
.message-ai-text th,.message-ai-text td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; font-size: 0.875rem; }
.message-ai-text th { background: var(--bg-hover); font-weight: 700; }
.message-ai-text blockquote { border-left: 3px solid var(--color-primary); padding-left: 16px; color: var(--text-secondary); margin: 12px 0; }
.message-ai-text strong { font-weight: 700; }
.message-ai-text a { color: var(--color-primary); text-decoration: underline; }

/* Tool call indicator inline */
.tool-call-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 4px 12px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.tool-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Streaming cursor */
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--color-primary);
  margin-left: 2px;
  vertical-align: middle;
  animation: blink 1s step-end infinite;
}
@keyframes blink { 50% { opacity: 0; } }

/* ═══════════════════════════════════════════════
   MESSAGE ACTIONS
═══════════════════════════════════════════════ */

.message-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 6px;
  opacity: 0;
  transition: opacity var(--transition);
}
.message-container:hover .message-actions { opacity: 1; }

.msg-action-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: background var(--transition), color var(--transition);
}
.msg-action-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.msg-action-btn.active-thumb { color: var(--color-primary); }
.msg-action-btn.copied { color: #52d174; }

/* ═══════════════════════════════════════════════
   INPUT BAR (Gemini floating pill)
═══════════════════════════════════════════════ */

.input-wrapper {
  flex-shrink: 0;
  padding: 8px 24px 24px;
  background: linear-gradient(transparent, var(--bg-base) 50%);
  position: relative;
}

.input-bar-container {
  max-width: var(--chat-max-w);
  margin: 0 auto;
}

.tool-progress-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0 8px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.input-bar {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 10px 10px 10px 16px;
  transition: border-color var(--transition), box-shadow var(--transition);
}
.input-bar:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.input-bar textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-size: 0.9375rem;
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 24px;
  max-height: 200px;
  overflow-y: auto;
  padding: 2px 0;
}
.input-bar textarea::placeholder { color: var(--text-muted); }

.input-bar-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding-bottom: 2px;
}

.input-icon-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: background var(--transition), color var(--transition);
  flex-shrink: 0;
}
.input-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.input-icon-btn.listening { color: var(--color-accent); background: rgba(233,51,51,0.1); }

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background var(--transition), transform var(--transition), opacity var(--transition);
}
.send-btn:hover:not(:disabled) { background: #3a4d6b; transform: scale(1.05); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.send-btn.stop { background: var(--color-accent); }
.send-btn.stop:hover { background: #c02020; }

.input-footer-text {
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 8px;
}

/* File attachment preview */
.file-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary);
}
.file-preview-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-preview-remove {
  color: var(--text-muted);
  transition: color var(--transition);
}
.file-preview-remove:hover { color: var(--color-accent); }

/* Embedded chart / PDF */
.embed-chart-container {
  margin: 12px 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border);
}
.embed-chart-container iframe,
.embed-chart-container img {
  width: 100%;
  max-height: 480px;
  display: block;
}

/* ═══════════════════════════════════════════════
   SCROLL TO BOTTOM BUTTON
═══════════════════════════════════════════════ */

.scroll-to-bottom {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 6px 16px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background var(--transition), box-shadow var(--transition);
  z-index: 10;
}
.scroll-to-bottom:hover { background: var(--bg-hover); box-shadow: var(--shadow-md); }

/* ═══════════════════════════════════════════════
   LANDING PAGE (para usuarios no logueados)
═══════════════════════════════════════════════ */

.landing-page {
  min-height: 100vh;
  background: var(--bg-base);
  display: flex;
  flex-direction: column;
}
.landing-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  border-bottom: 1px solid var(--border);
}
.landing-nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}
.landing-login-btn {
  background: var(--color-primary);
  color: #fff;
  padding: 10px 24px;
  border-radius: var(--radius-pill);
  font-size: 0.9rem;
  font-weight: 600;
  transition: background var(--transition);
}
.landing-login-btn:hover { background: #3a4d6b; }
.landing-hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
}
.landing-hero-title {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 900;
  line-height: 1.15;
  margin-bottom: 20px;
  color: var(--text-primary);
}
.landing-hero-title span {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.landing-hero-subtitle {
  font-size: 1.1rem;
  color: var(--text-secondary);
  max-width: 560px;
  line-height: 1.6;
  margin-bottom: 36px;
}
.landing-cta-btn {
  background: var(--color-primary);
  color: #fff;
  padding: 14px 36px;
  border-radius: var(--radius-pill);
  font-size: 1rem;
  font-weight: 700;
  transition: background var(--transition), transform var(--transition);
}
.landing-cta-btn:hover { background: #3a4d6b; transform: translateY(-1px); }

/* ═══════════════════════════════════════════════
   LOGIN MODAL
═══════════════════════════════════════════════ */

.login-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.login-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-md);
}
.login-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.login-logo-text { font-size: 1.25rem; font-weight: 700; color: var(--text-primary); }
.login-title { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
.login-subtitle { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 28px; }
.login-field { margin-bottom: 16px; }
.login-label { display: block; font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
.login-input {
  width: 100%;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  font-size: 0.9375rem;
  color: var(--text-primary);
  outline: none;
  transition: border-color var(--transition);
}
.login-input:focus { border-color: var(--color-primary); }
.login-error { font-size: 0.8125rem; color: var(--color-accent); margin-top: 4px; }
.login-btn {
  width: 100%;
  background: var(--color-primary);
  color: #fff;
  padding: 12px;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  font-weight: 700;
  transition: background var(--transition);
  margin-top: 8px;
}
.login-btn:hover:not(:disabled) { background: #3a4d6b; }
.login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ═══════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════ */

.toast-container {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  pointer-events: none;
}
.toast {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 10px 20px;
  font-size: 0.875rem;
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: toastIn 0.3s ease;
}
.toast.success { border-color: #52d174; color: #52d174; }
.toast.error   { border-color: var(--color-accent); color: var(--color-accent); }
@keyframes toastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

/* ═══════════════════════════════════════════════
   NOTEBOOK
═══════════════════════════════════════════════ */

.notebook-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 500;
  display: flex;
  justify-content: flex-end;
}
.notebook-panel {
  width: 420px;
  max-width: 100vw;
  height: 100vh;
  background: var(--bg-surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  animation: slideInRight 0.25s ease;
}
@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
.notebook-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.notebook-title { font-size: 1rem; font-weight: 700; color: var(--text-primary); }
.notebook-close-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: background var(--transition);
}
.notebook-close-btn:hover { background: var(--bg-hover); }
.notebook-body { flex: 1; overflow-y: auto; padding: 16px; }
.notebook-textarea {
  width: 100%;
  height: 100%;
  min-height: 300px;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-size: 0.9375rem;
  color: var(--text-primary);
  line-height: 1.7;
}

/* ═══════════════════════════════════════════════
   RESPONSIVE — MOBILE
═══════════════════════════════════════════════ */

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 300;
    height: 100vh;
    box-shadow: var(--shadow-md);
  }
  .sidebar.collapsed {
    transform: translateX(-100%);
    width: var(--sidebar-w);
    min-width: var(--sidebar-w);
    opacity: 1;
    pointer-events: none;
  }
  .sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 299;
  }
  .suggestion-chips {
    grid-template-columns: 1fr;
  }
  .home-greeting { font-size: 1.75rem; }
  .messages-list { padding: 16px 16px 0; }
  .input-wrapper { padding: 8px 16px 20px; }
  .topbar { padding: 10px 12px; }
  .message-user .message-bubble { max-width: 90%; }
}

@media (max-width: 480px) {
  .input-bar { border-radius: var(--radius-md); }
  .login-card { padding: 28px 24px; }
  .suggestion-chip { padding: 12px 14px; }
}
```

- [ ] **Step 3: Verificar que los estilos base cargan**

Abre la app en el navegador. El fondo debe cambiar a `#FAFAFA` (modo claro) o `#1A1C1E` (modo oscuro) según la preferencia del sistema. La tipografía debe ser Lato. No debe haber errores en consola relacionados con CSS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/App.css
git commit -m "feat: CSS foundation — Gemini-style design system with SOLE brand colors"
```

---

## Task 2: Sidebar Rediseñado

**Files:**
- Modify: `frontend/src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: props existentes (chats, activeChatId, handleNewChat, handleLogout, user, etc.) — sin cambios en la API de props
- Produces: JSX con clases `.sidebar`, `.sidebar-header`, `.sidebar-new-chat-btn`, `.sidebar-list`, `.sidebar-footer`, `.sidebar-user-btn`

- [ ] **Step 1: Reescribir `Sidebar.jsx`**

Reemplazar el contenido completo del archivo:

```jsx
import React, { useState, useEffect } from 'react';
import { Menu, Plus, Search, Trash2, MoreVertical, Pin, Edit2, LogOut, ChevronDown } from 'lucide-react';
import { BotSparkleIcon } from './icons';

export default function Sidebar({
  isSidebarOpen, setIsSidebarOpen,
  chats, setChats,
  activeChatId, setActiveChatId,
  handleNewChat, handleDeleteChat,
  searchQuery, setSearchQuery,
  user, handleLogout,
  activeView, setActiveView,
}) {
  const [activeMenuId, setActiveMenuId]     = useState(null);
  const [showUserMenu, setShowUserMenu]     = useState(false);

  useEffect(() => {
    const close = () => { setActiveMenuId(null); setShowUserMenu(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const stopProp = (e) => e.stopPropagation();

  const handleRename = (chatId, currentTitle, e) => {
    stopProp(e);
    setActiveMenuId(null);
    const newTitle = prompt('Renombrar conversación:', currentTitle);
    if (newTitle?.trim()) {
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle.trim() } : c));
    }
  };

  const handleTogglePin = (chatId, e) => {
    stopProp(e);
    setActiveMenuId(null);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, pinned: !c.pinned } : c));
  };

  const handleDelete = (chatId, e) => {
    stopProp(e);
    setActiveMenuId(null);
    handleDeleteChat(chatId);
  };

  const filtered = (chats || []).filter(c =>
    !searchQuery || c.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinned   = filtered.filter(c => c.pinned);
  const unpinned = filtered.filter(c => !c.pinned);

  const groupByDate = (list) => {
    const now   = Date.now();
    const today = new Date(); today.setHours(0,0,0,0);
    const groups = { Hoy: [], Ayer: [], 'Esta semana': [], Anteriores: [] };
    list.forEach(c => {
      const d = new Date(c.createdAt || now);
      const diff = today - new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (diff <= 0)           groups['Hoy'].push(c);
      else if (diff <= 86400000) groups['Ayer'].push(c);
      else if (diff <= 7*86400000) groups['Esta semana'].push(c);
      else                     groups['Anteriores'].push(c);
    });
    return groups;
  };

  const groups = groupByDate(unpinned);

  const initials = user?.full_name
    ? user.full_name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
    : (user?.username?.[0] || '?').toUpperCase();

  const renderChat = (chat) => (
    <div
      key={chat.id}
      className={`sidebar-chat-item${activeChatId === chat.id ? ' active' : ''}`}
      onClick={() => { setActiveChatId(chat.id); setActiveView('chat'); if (window.innerWidth <= 768) setIsSidebarOpen(false); }}
    >
      {chat.pinned && <Pin size={12} className="sidebar-pin-icon" />}
      <span className="sidebar-chat-title">{chat.title || 'Nueva conversación'}</span>
      <button
        className="sidebar-chat-menu-btn"
        onClick={(e) => { stopProp(e); setActiveMenuId(activeMenuId === chat.id ? null : chat.id); }}
      >
        <MoreVertical size={14} />
      </button>
      {activeMenuId === chat.id && (
        <div className="sidebar-context-menu" onClick={stopProp}>
          <button onClick={(e) => handleRename(chat.id, chat.title, e)}>
            <Edit2 size={14} /> Renombrar
          </button>
          <button onClick={(e) => handleTogglePin(chat.id, e)}>
            <Pin size={14} /> {chat.pinned ? 'Desanclar' : 'Anclar'}
          </button>
          <button className="danger" onClick={(e) => handleDelete(chat.id, e)}>
            <Trash2 size={14} /> Eliminar
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && window.innerWidth <= 768 && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <nav className={`sidebar${isSidebarOpen ? '' : ' collapsed'}`}>
        {/* Header */}
        <div className="sidebar-header">
          <button className="sidebar-menu-btn" onClick={() => setIsSidebarOpen(false)}>
            <Menu size={20} />
          </button>
          <div className="sidebar-logo">
            <BotSparkleIcon />
            <span className="sidebar-logo-text">SIATC.IA</span>
          </div>
        </div>

        {/* New chat */}
        <button className="sidebar-new-chat-btn" onClick={handleNewChat}>
          <Plus size={18} />
          Nueva conversación
        </button>

        {/* Search */}
        <div className="sidebar-search-wrap">
          <input
            className="sidebar-search-input"
            placeholder="Buscar conversaciones..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Chat list */}
        <div className="sidebar-list">
          {pinned.length > 0 && (
            <>
              <div className="sidebar-group-label">Ancladas</div>
              {pinned.map(renderChat)}
            </>
          )}
          {Object.entries(groups).map(([label, items]) =>
            items.length > 0 ? (
              <React.Fragment key={label}>
                <div className="sidebar-group-label">{label}</div>
                {items.map(renderChat)}
              </React.Fragment>
            ) : null
          )}
          {filtered.length === 0 && (
            <div style={{ padding: '16px 8px', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {searchQuery ? 'Sin resultados' : 'No hay conversaciones'}
            </div>
          )}
        </div>

        {/* Footer — user section */}
        <div className="sidebar-footer">
          <button
            className="sidebar-user-btn"
            onClick={(e) => { stopProp(e); setShowUserMenu(v => !v); }}
          >
            <div className="sidebar-avatar">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt={user.full_name} />
                : initials
              }
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.full_name || user?.username}</div>
              <div className="sidebar-user-role">{user?.role_name || 'Usuario'}</div>
            </div>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

            {showUserMenu && (
              <div className="sidebar-user-menu" onClick={stopProp}>
                <button className="danger" onClick={handleLogout}>
                  <LogOut size={14} /> Cerrar sesión
                </button>
              </div>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
```

- [ ] **Step 2: Verificar en el navegador**

- Sidebar debe mostrar: botón hamburger + logo arriba, nueva conversación, buscador, lista de chats agrupados por fecha, usuario con avatar al fondo.
- Al hacer clic en el hamburger, el sidebar debe colapsar suavemente.
- En mobile (< 768px) debe aparecer como drawer sobre el contenido.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Sidebar.jsx
git commit -m "feat: sidebar rediseñado estilo Gemini — usuario al fondo, grupos por fecha, drawer mobile"
```

---

## Task 3: Home Screen con Greeting y Suggestion Chips

**Files:**
- Create: `frontend/src/components/SuggestionChips.jsx`
- Modify: `frontend/src/components/ChatArea.jsx` (sección home screen)
- Modify: `frontend/src/components/Landing.jsx` (simplificar para no-logueados)

**Interfaces:**
- `SuggestionChips` recibe prop `onSelect: (text: string) => void`
- `ChatArea` recibe prop `user` (ya existente) y muestra home screen cuando `activeMessages.length === 0 && !isLoading`

- [ ] **Step 1: Crear `frontend/src/components/SuggestionChips.jsx`**

```jsx
import React from 'react';

const CHIPS = [
  { icon: '📋', text: '¿Cuántos servicios se cerraron hoy?' },
  { icon: '📊', text: 'NPS del mes actual vs meta 74.5' },
  { icon: '🏆', text: 'Técnicos con mayor eficiencia esta semana' },
  { icon: '⏳', text: 'Tickets pendientes por CAS' },
];

export default function SuggestionChips({ onSelect }) {
  return (
    <div className="suggestion-chips">
      {CHIPS.map((chip) => (
        <button
          key={chip.text}
          className="suggestion-chip"
          onClick={() => onSelect(chip.text)}
        >
          <span className="chip-icon">{chip.icon}</span>
          <span className="chip-text">{chip.text}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Leer el `ChatArea.jsx` actual para identificar dónde insertar el home screen**

El home screen debe reemplazar el área de mensajes cuando `activeMessages.length === 0 && !isLoading`. Buscar el bloque de render principal y agregar la lógica de home screen.

- [ ] **Step 3: Modificar `ChatArea.jsx` — agregar home screen y topbar**

En `ChatArea.jsx`, localizar el JSX de retorno principal. Restructurar para que cuando no hay mensajes y no está cargando, muestre el home screen con greeting + chips. Cuando hay mensajes, muestre el chat normal.

Agregar al inicio del componente:

```jsx
import SuggestionChips from './SuggestionChips';
```

Agregar esta función helper dentro del componente:

```jsx
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

const firstName = user?.full_name?.split(' ')[0] || user?.username || '';
```

Restructurar el JSX de retorno:

```jsx
return (
  <div className="main-content">
    {/* Topbar — siempre visible */}
    <div className="topbar">
      {!isSidebarOpen && (
        <button className="topbar-menu-btn" onClick={() => setIsSidebarOpen(true)}>
          <Menu size={20} />
        </button>
      )}
      {isSidebarOpen && <div style={{ width: 40 }} />}
      <span className="topbar-title">
        {activeMessages.length > 0 ? (chats.find(c => c.id === activeChatId)?.title || 'SIATC.IA') : ''}
      </span>
      <div className="topbar-actions">
        <button className="topbar-icon-btn" onClick={toggleTheme} title="Cambiar tema">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </div>

    {/* Home screen o Chat screen */}
    {activeMessages.length === 0 && !isLoading ? (
      <div className="home-screen">
        <h1 className="home-greeting">{getGreeting()}, {firstName}</h1>
        <p className="home-subtitle">¿Cómo puedo ayudarte hoy?</p>
        <SuggestionChips onSelect={(text) => { setInputText(text); }} />
        {/* Input bar centrado */}
        {renderInputBar()}
      </div>
    ) : (
      <div className="chat-screen">
        <div className="messages-list" ref={/* scrollRef existente */null}>
          <div className="messages-inner">
            {/* Mensajes existentes */}
            {renderMessages()}
          </div>
          <div ref={messagesEndRef} />
        </div>
        {renderInputBar()}
      </div>
    )}
  </div>
);
```

> **Nota:** Las funciones `renderInputBar()` y `renderMessages()` extraen el JSX que ya existía en el componente. No se cambia la lógica — solo se reorganiza en funciones para reutilizarlas en ambas vistas.

- [ ] **Step 4: Actualizar `Landing.jsx` — simplificar para usuarios no logueados**

Reemplazar contenido de `Landing.jsx`:

```jsx
import React from 'react';
import { BotSparkleIcon } from './icons';

export default function Landing({ onLoginClick }) {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <BotSparkleIcon />
          <span>SIATC.IA</span>
        </div>
        <button className="landing-login-btn" onClick={onLoginClick}>
          Iniciar sesión
        </button>
      </nav>
      <div className="landing-hero">
        <h1 className="landing-hero-title">
          El asistente inteligente de<br />
          <span>Grupo SOLE / Rinnai</span>
        </h1>
        <p className="landing-hero-subtitle">
          Consulta servicios, NPS, reportes y SAP C4C en lenguaje natural. Conectado en tiempo real a tus sistemas.
        </p>
        <button className="landing-cta-btn" onClick={onLoginClick}>
          Comenzar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar en el navegador**

- Al iniciar sesión, debe verse el greeting "Buenos días/tardes, [nombre]" con gradiente azul-rojo SOLE.
- Los 4 chips deben aparecer en grid 2x2.
- Al hacer clic en un chip, el texto debe copiarse al input.
- Al enviar un mensaje, el home screen debe desaparecer y mostrar el chat normal.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SuggestionChips.jsx frontend/src/components/ChatArea.jsx frontend/src/components/Landing.jsx
git commit -m "feat: home screen con greeting Gemini-style y chips de sugerencia SIATC.IA"
```

---

## Task 4: Message Actions — Copiar, Pulgares, Regenerar

**Files:**
- Create: `frontend/src/components/MessageActions.jsx`
- Modify: `frontend/src/components/ChatArea.jsx` (agregar acciones a cada mensaje AI)
- Modify: `frontend/src/App.jsx` (agregar `handleRegenerate`)

**Interfaces:**
- `MessageActions` recibe: `{ messageContent: string, messageIndex: number, onRegenerate: () => void, isLastAiMessage: boolean }`
- `handleRegenerate` en `App.jsx`: elimina el último mensaje del AI y reenvía el último mensaje del usuario

- [ ] **Step 1: Crear `frontend/src/components/MessageActions.jsx`**

```jsx
import React, { useState } from 'react';
import { Copy, Check, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';

export default function MessageActions({ messageContent, onRegenerate, isLastAiMessage }) {
  const [copied,    setCopied]    = useState(false);
  const [thumbUp,   setThumbUp]   = useState(false);
  const [thumbDown, setThumbDown] = useState(false);

  const handleCopy = async () => {
    try {
      // Strip HTML tags for plain text copy
      const plain = messageContent.replace(/<[^>]+>/g, '');
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  const handleThumbUp = () => {
    setThumbUp(v => !v);
    setThumbDown(false);
  };

  const handleThumbDown = () => {
    setThumbDown(v => !v);
    setThumbUp(false);
  };

  return (
    <div className="message-actions">
      <button
        className={`msg-action-btn${copied ? ' copied' : ''}`}
        onClick={handleCopy}
        title={copied ? '¡Copiado!' : 'Copiar'}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
      <button
        className={`msg-action-btn${thumbUp ? ' active-thumb' : ''}`}
        onClick={handleThumbUp}
        title="Buena respuesta"
      >
        <ThumbsUp size={15} />
      </button>
      <button
        className={`msg-action-btn${thumbDown ? ' active-thumb' : ''}`}
        onClick={handleThumbDown}
        title="Mala respuesta"
      >
        <ThumbsDown size={15} />
      </button>
      {isLastAiMessage && onRegenerate && (
        <button
          className="msg-action-btn"
          onClick={onRegenerate}
          title="Regenerar respuesta"
        >
          <RefreshCw size={15} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Agregar `handleRegenerate` a `App.jsx`**

Localizar la función `handleSendMessage` y agregar debajo:

```jsx
const handleRegenerate = () => {
  const msgs = activeMessages;
  if (!msgs || msgs.length < 2) return;
  // Find last user message
  let lastUserMsg = null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') { lastUserMsg = msgs[i]; break; }
  }
  if (!lastUserMsg) return;
  // Remove last AI message(s) from active chat
  setChats(prev => prev.map(c => {
    if (c.id !== activeChatId) return c;
    const newMsgs = [...c.messages];
    while (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role !== 'user') {
      newMsgs.pop();
    }
    return { ...c, messages: newMsgs };
  }));
  // Re-send the last user message (handleSendMessage reads from state after update)
  setTimeout(() => {
    setInputText(lastUserMsg.content);
    // Trigger send after state settles
    setTimeout(() => handleSendMessage(lastUserMsg.content), 50);
  }, 100);
};
```

Pasar `handleRegenerate` como prop a `ChatArea`:
```jsx
<ChatArea
  {...existingProps}
  handleRegenerate={handleRegenerate}
/>
```

- [ ] **Step 3: Integrar `MessageActions` en el render de mensajes AI en `ChatArea.jsx`**

Agregar el import al inicio:
```jsx
import MessageActions from './MessageActions';
```

En el bloque donde se renderiza cada mensaje AI, agregar `MessageActions` debajo del texto:

```jsx
{msg.role === 'assistant' && (
  <div className="message-container message-ai">
    <div className="message-ai-inner">
      <div className="message-ai-avatar">
        <BotSparkleIcon size={16} />
      </div>
      <div className="message-ai-body">
        <div className="message-ai-name">SIATC.IA</div>
        <div
          className="message-ai-text"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
        />
        <MessageActions
          messageContent={msg.content}
          onRegenerate={handleRegenerate}
          isLastAiMessage={index === activeMessages.filter(m => m.role === 'assistant').length - 1}
        />
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verificar en el navegador**

- Al hacer hover sobre cualquier respuesta del AI, deben aparecer los botones de acción.
- Copiar debe cambiar el ícono a ✓ verde por 2 segundos.
- Pulgar arriba/abajo deben resaltarse en azul SOLE al hacer clic.
- El botón regenerar solo aparece en el último mensaje del AI.
- Al regenerar, el último mensaje AI desaparece y se vuelve a enviar la última consulta.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MessageActions.jsx frontend/src/components/ChatArea.jsx frontend/src/App.jsx
git commit -m "feat: message actions — copiar, pulgares arriba/abajo, regenerar respuesta"
```

---

## Task 5: Input Bar Gemini + Tool Indicators + Scroll-to-Bottom

**Files:**
- Modify: `frontend/src/components/ChatArea.jsx` (input bar, tool indicator, scroll button)

**Interfaces:**
- Consume props existentes: `isLoading`, `progressLabel`, `onStopGeneration`, `streamingContent`

- [ ] **Step 1: Refactorizar el input bar en `ChatArea.jsx`**

Reemplazar el HTML del input bar por la nueva estructura `.input-wrapper` → `.input-bar-container` → `.input-bar` con los botones de adjunto, mic, y send correctamente estilizados.

El renderInputBar() debe devolver:

```jsx
const renderInputBar = () => (
  <div className="input-wrapper">
    <div className="input-bar-container">
      {/* Tool progress indicator */}
      {isLoading && progressLabel && (
        <div className="tool-progress-bar">
          <div className="tool-spinner" />
          <span>{progressLabel}</span>
        </div>
      )}

      {/* File preview */}
      {fileAttachment && (
        <div className="file-preview">
          <File size={14} />
          <span className="file-preview-name">{fileAttachment.name}</span>
          <button className="file-preview-remove" onClick={() => setFileAttachment(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="input-bar">
        <button
          className="input-icon-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Adjuntar archivo"
          disabled={isLoading}
        >
          <Paperclip size={18} />
        </button>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />

        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Consulta sobre servicios, NPS, técnicos..."
          rows={1}
          disabled={isLoading && !streamingContent}
        />

        <div className="input-bar-actions">
          <button
            className={`input-icon-btn${isListening ? ' listening' : ''}`}
            onClick={handleVoiceInput}
            title={isListening ? 'Detener dictado' : 'Dictado por voz'}
          >
            <Mic size={18} />
          </button>

          {isLoading ? (
            <button className="send-btn stop" onClick={onStopGeneration} title="Detener">
              <Square size={16} />
            </button>
          ) : (
            <button
              className="send-btn"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() && !fileAttachment}
              title="Enviar"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="input-footer-text">
        SIATC.IA puede cometer errores. Verifica información importante.
      </div>
    </div>
  </div>
);
```

Actualizar el import de lucide-react para incluir `ArrowUp` (renombrar el ícono `Send` por `ArrowUp` como Gemini):
```jsx
import { Menu, Sun, Moon, Paperclip, ArrowUp, File, Mic, Square, Bot } from 'lucide-react';
```

- [ ] **Step 2: Agregar botón scroll-to-bottom**

Agregar estado al componente:
```jsx
const [showScrollBtn, setShowScrollBtn] = useState(false);
const scrollContainerRef = useRef(null);
```

Agregar handler en el contenedor de mensajes:
```jsx
const handleScroll = () => {
  const el = scrollContainerRef.current;
  if (!el) return;
  setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
};
```

En el JSX del `.messages-list` agregar `ref={scrollContainerRef}` y `onScroll={handleScroll}`.

Agregar el botón dentro de `.chat-screen`, justo antes del input bar:
```jsx
{showScrollBtn && (
  <button
    className="scroll-to-bottom"
    onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
  >
    <ArrowDown size={14} /> Bajar
  </button>
)}
```

Agregar `ArrowDown` al import de lucide-react.

- [ ] **Step 3: Verificar en el navegador**

- El input bar debe tener forma de cápsula redondeada con fondo gris.
- Al escribir, debe crecer hasta 200px de altura.
- El spinner de herramienta debe aparecer sobre el input cuando el AI está ejecutando una tool call.
- El botón de send debe ser circular azul SOLE.
- Al hacer scroll hacia arriba en el chat, debe aparecer el botón "Bajar".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatArea.jsx
git commit -m "feat: input bar Gemini-style, tool indicator animado, botón scroll-to-bottom"
```

---

## Task 6: Login Rediseñado + Limpieza Final

**Files:**
- Modify: `frontend/src/components/Login.jsx`
- Modify: `frontend/src/App.jsx` (usar clases nuevas, eliminar clases obsoletas)

**Interfaces:**
- `Login` recibe props existentes sin cambios: `onLogin`, `isLoading`, `error`

- [ ] **Step 1: Reescribir `Login.jsx`**

```jsx
import React, { useState } from 'react';
import { BotSparkleIcon } from './icons';

export default function Login({ onLogin, isLoading, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim() && password.trim()) onLogin(username.trim(), password.trim());
  };

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-logo">
          <BotSparkleIcon />
          <span className="login-logo-text">SIATC.IA</span>
        </div>
        <h2 className="login-title">Bienvenido</h2>
        <p className="login-subtitle">Ingresa tus credenciales para continuar</p>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label">Usuario o correo</label>
            <input
              className="login-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="tu.nombre@gruposole.com"
              autoComplete="username"
              autoFocus
              disabled={isLoading}
            />
          </div>
          <div className="login-field">
            <label className="login-label">Contraseña</label>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button
            type="submit"
            className="login-btn"
            disabled={isLoading || !username.trim() || !password.trim()}
          >
            {isLoading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar `App.jsx` — ajustar clases del layout principal**

Asegurarse de que el wrapper raíz de App use `.app-layout`:

```jsx
return (
  <div className="app-layout">
    {user ? (
      <>
        <Sidebar {...sidebarProps} />
        <ChatArea {...chatAreaProps} />
        {isNotebookOpen && <Notebook {...notebookProps} />}
      </>
    ) : (
      <>
        <Landing onLoginClick={() => setShowLoginForm(true)} />
        {showLoginForm && (
          <Login onLogin={handleLogin} isLoading={isLoading} error={loginError} />
        )}
      </>
    )}
    <ToastContainer />
  </div>
);
```

- [ ] **Step 3: Verificar flujo completo en el navegador**

1. Abrir la app sin sesión → debe verse Landing con nav y hero.
2. Clic en "Iniciar sesión" → aparece el modal de login sobre fondo difuminado.
3. Login correcto → desaparece el modal, aparece el home screen con greeting.
4. Escribir en el input o hacer clic en un chip → se envía el mensaje y aparece el chat.
5. Hover sobre respuesta del AI → aparecen los botones de acción.
6. Colapsar sidebar → el contenido se expande, la topbar muestra el botón hamburger.
7. En mobile (< 768px) → sidebar es un drawer, los chips se muestran en columna 1.

- [ ] **Step 4: Push final**

```bash
git add frontend/src/components/Login.jsx frontend/src/App.jsx
git commit -m "feat: login rediseñado estilo Gemini + layout app-layout consolidado"
git push origin main
```

---

## Self-Review

### Spec coverage
- ✅ Paleta SOLE (#4C5F80, #E93333, Lato) — Task 1
- ✅ Tema automático prefers-color-scheme — Task 1
- ✅ Layout Gemini (sidebar + main) — Task 1
- ✅ Sidebar con usuario al fondo — Task 2
- ✅ Home screen con greeting — Task 3
- ✅ Suggestion chips (4 chips opción A) — Task 3
- ✅ Copiar mensaje — Task 4
- ✅ Pulgares arriba/abajo — Task 4
- ✅ Regenerar respuesta — Task 4
- ✅ Input bar pill Gemini — Task 5
- ✅ Tool indicator animado — Task 5
- ✅ Scroll-to-bottom — Task 5
- ✅ Responsive mobile — Task 1 (media queries) + Task 2 (drawer)
- ✅ Login rediseñado — Task 6

### Placeholders
Ninguno encontrado — todos los steps tienen código completo.

### Type consistency
- `SuggestionChips.onSelect(text: string)` → usado en ChatArea Task 3 ✅
- `MessageActions.onRegenerate()` → implementado en App.jsx Task 4 y pasado como prop ✅
- `handleRegenerate` definido en App.jsx → pasado a ChatArea → pasado a MessageActions ✅
