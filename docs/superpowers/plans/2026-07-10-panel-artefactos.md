# Panel de Artefactos — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar gráficos, Excel, PDF y reportes/tablas largas como una tarjeta compacta en el chat que, al hacer clic, abre una vista previa completa en un panel lateral derecho con acciones de copiar/descargar/abrir propias de cada tipo de contenido.

**Architecture:** Los reportes/tablas que redacta la IA se envuelven en un bloque marcado ` ```artefacto ` (metadatos JSON en la primera línea + markdown), guardado como texto plano en el mensaje — sin cambios de base de datos. Los archivos generados (Excel/gráfico/PDF) siguen usando exactamente los mismos marcadores de hoy (`[EmbedChart:...]`, `[Descargar Reporte Excel](...)`, `[EmbedPDF:...]`); lo único que cambia es que el frontend los convierte en tarjeta en vez de incrustarlos inline — esto beneficia también a conversaciones viejas ya guardadas, sin reprocesar nada.

**Tech Stack:** React 18 + Vite (frontend), FastAPI + Python (backend). Una dependencia nueva en cada lado: `xlsx` (SheetJS, npm) para la vista previa de Excel en el navegador, y `markdown` (PyPI) en el backend para convertir el reporte a HTML antes de generar el PDF con `pymupdf` (ya instalado, tiene `fitz.Story` para HTML→PDF).

## Global Constraints

- No modificar props, estado, ni comportamiento de nada que no sea parte de este plan — en particular, `preguntar_usuario` es un mecanismo aparte y no se toca.
- No agregar tablas ni columnas nuevas a la base de datos — todo viaja como texto plano dentro de `KIRA.Messages.Content`, igual que hoy.
- Mantener los tokens de tema (`var(--bg-*)`, `var(--text-*)`, `var(--border)`, `var(--radius-*)`) en todo el CSS nuevo — nunca colores hardcodeados que rompan el modo claro/oscuro.
- **Anti-patrón conocido a evitar:** este proyecto ya tuvo un bug real (sidebar roto en móvil) causado por una segunda definición del mismo selector CSS más abajo en `App.css`, que silenciosamente pisaba la primera. Cada clase CSS nueva de este plan se define **una sola vez**, en la sección nueva indicada en cada tarea. No copiar/pegar un bloque ya existente a otra parte del archivo.
- **Sin framework de tests:** verificación = scripts manuales con `assert` (mismo patrón ya usado en este proyecto, ej. `backend/_verify_pregunta_usuario_validacion.py`) para lógica pura de backend/frontend, y navegador real vía herramientas de preview para todo lo que requiere UI o el modelo de IA.
- El JS de Plotly ya se aloja localmente (`/static/js/plotly.min.js`, ver commit `389bf99`) — el iframe de gráfico dentro del panel debe seguir usando esa misma ruta, no un CDN.

---

### Task 1: Backend — endpoint para exportar un reporte a PDF

**Files:**
- Create: `backend/pdf_export.py`
- Modify: `backend/requirements.txt` (agregar `markdown`)
- Modify: `backend/main.py` (nuevo endpoint, cerca de `/api/download/{subfolder}/{filename}` en la sección de descargas, línea ~1153)

**Interfaces:**
- Produces: `pdf_export.markdown_to_pdf_bytes(titulo: str, contenido_markdown: str) -> bytes` — función pura, sin dependencias de FastAPI, fácil de probar con un script.
- Produces: endpoint `POST /api/artifacts/export-pdf` — body `{"titulo": str, "contenido_markdown": str}`, respuesta binaria `application/pdf` con `Content-Disposition: attachment`.

- [ ] **Step 1: Agregar la dependencia nueva**

En `backend/requirements.txt`, agregar una línea (junto a las demás dependencias, no importa el orden exacto):

```
markdown==3.7
```

- [ ] **Step 2: Instalar y verificar que importa**

Run: `cd backend && pip install markdown==3.7`
Expected: `Successfully installed markdown-3.7` (o ya satisfecho si la versión exacta no está disponible en tu entorno local — en ese caso instala la más reciente compatible; producción usa Python 3.11 y sí resolverá la versión pineada).

- [ ] **Step 3: Crear `backend/pdf_export.py`**

```python
"""Conversión de markdown a PDF para el panel de artefactos.

No depende de FastAPI ni de nada del resto del backend — función pura,
fácil de probar por separado.
"""
import io
import re
import markdown as md
import fitz


def markdown_to_pdf_bytes(titulo: str, contenido_markdown: str) -> bytes:
    """Convierte un reporte en markdown a un PDF con formato (títulos, tablas, listas).

    Usa fitz.Story (PyMuPDF) para el layout HTML→PDF — no agrega ninguna
    dependencia nueva de PDF, pymupdf ya está instalado en este proyecto.
    """
    html_body = md.markdown(
        contenido_markdown,
        extensions=["tables", "fenced_code"],
    )
    html = f"""
    <html>
    <body style="font-family: Helvetica; font-size: 11px; line-height: 1.5;">
        <h1 style="font-size: 18px;">{titulo}</h1>
        {html_body}
    </body>
    </html>
    """

    story = fitz.Story(html=html)
    pdf_bytes_io = io.BytesIO()
    writer = fitz.DocumentWriter(pdf_bytes_io)
    mediabox = fitz.paper_rect("a4")
    where = mediabox + (36, 36, -36, -36)
    more = 1
    while more:
        device = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(device)
        writer.end_page()
    writer.close()
    return pdf_bytes_io.getvalue()


def safe_pdf_filename(titulo: str) -> str:
    """Nombre de archivo seguro a partir del título, igual al patrón ya usado
    para los nombres de gráficos en mcp_db.py (generar_grafico)."""
    safe = re.sub(r"[^\w\-]", "_", titulo).lower().strip("_")
    return f"{safe or 'reporte'}.pdf"
```

- [ ] **Step 4: Escribir el script de verificación**

Crear `backend/_verify_pdf_export.py` (archivo temporal, se borra en el Step 6):

```python
"""Verificación manual de pdf_export. Ejecutar: python _verify_pdf_export.py"""
from pdf_export import markdown_to_pdf_bytes, safe_pdf_filename

md_texto = """## Resumen ejecutivo

Se encontraron **42 fugas de gas confirmadas** en junio 2026.

| CAS | Fugas |
|-----|-------|
| VYA | 12 |
| SILAR | 8 |

- Primer punto
- Segundo punto
"""

pdf_bytes = markdown_to_pdf_bytes("Fugas de gas confirmadas — junio 2026", md_texto)
assert isinstance(pdf_bytes, bytes), f"esperaba bytes, obtuve {type(pdf_bytes)}"
assert pdf_bytes[:4] == b"%PDF", f"no parece un PDF valido, primeros bytes: {pdf_bytes[:10]!r}"
assert len(pdf_bytes) > 1000, f"PDF sospechosamente chico: {len(pdf_bytes)} bytes"

nombre = safe_pdf_filename("Fugas de gas confirmadas — junio 2026")
assert nombre == "fugas_de_gas_confirmadas_junio_2026.pdf", f"nombre inesperado: {nombre!r}"

nombre_vacio = safe_pdf_filename("!!!")
assert nombre_vacio == "reporte.pdf", f"esperaba fallback 'reporte.pdf', obtuve {nombre_vacio!r}"

print("TODO OK")
```

- [ ] **Step 5: Ejecutar el script y confirmar que pasa**

Run: `cd backend && python _verify_pdf_export.py`
Expected: `TODO OK`

- [ ] **Step 6: Borrar el script de verificación temporal**

```bash
rm backend/_verify_pdf_export.py
```

- [ ] **Step 7: Agregar el endpoint en `backend/main.py`**

Justo después del endpoint `download_file` (después de la línea que dice `return FileResponse(...)`, antes del comentario `# AUTH Y UPLOAD`), agregar:

```python
class ExportPdfRequest(BaseModel):
    titulo: str
    contenido_markdown: str

@app.post("/api/artifacts/export-pdf")
async def export_artifact_pdf(req: ExportPdfRequest, _: dict = Depends(require_auth)):
    import pdf_export
    if not req.contenido_markdown.strip():
        raise HTTPException(status_code=400, detail="El contenido no puede estar vacío.")
    try:
        pdf_bytes = pdf_export.markdown_to_pdf_bytes(req.titulo, req.contenido_markdown)
    except Exception as e:
        logger.error(f"Error generando PDF de artefacto: {e}")
        raise HTTPException(status_code=500, detail="No se pudo generar el PDF.")
    filename = pdf_export.safe_pdf_filename(req.titulo)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

- [ ] **Step 8: Agregar `Response` al import de `fastapi.responses`**

En `backend/main.py:25`, cambia:

```python
from fastapi.responses import StreamingResponse
```

por:

```python
from fastapi.responses import StreamingResponse, Response
```

- [ ] **Step 9: Verificar que el backend compila**

Run: `cd backend && python -m py_compile main.py pdf_export.py`
Expected: sin salida (compila limpio).

- [ ] **Step 10: Commit**

```bash
git add backend/requirements.txt backend/pdf_export.py backend/main.py
git commit -m "feat: endpoint para exportar artefactos de reporte a PDF"
```

---

### Task 2: Backend — regla de system prompt para el bloque `artefacto`

**Files:**
- Modify: `backend/main.py:811` (dentro de `build_system_prompt`, sección `━━━ REGLAS OBLIGATORIAS ━━━`)
- Modify: `backend/main.py:825-831` (sección `PASO 2 — GRÁFICO AUTOMÁTICO`, para que la nueva regla no contradiga el formato ya establecido)

**Interfaces:**
- Consumes: nada nuevo — es texto agregado al string que ya arma `build_system_prompt`.
- Produces: nada que otras tareas consuman directamente (el frontend, en la Tarea 3, define el formato del bloque de forma independiente — pero debe coincidir exactamente con lo que se le pide al modelo aquí: primera línea `{"tipo": "reporte"|"tabla", "titulo": "..."}", el resto markdown).

- [ ] **Step 1: Agregar la regla 12, después de la regla 11 (línea 811, después de "...si 2 intentos consecutivos fallan.")**

Busca este texto exacto en `backend/main.py`:

```
11. CORRECCIÓN DE SQL: Si una consulta SQL devuelve un error, NO lo reportes al usuario. Analiza el error, identifica la causa (columna inexistente, nombre de tabla incorrecto, error de sintaxis, tipo de dato), corrige la consulta y ejecuta inmediatamente una nueva llamada con el SQL corregido. Solo reporta el error si 2 intentos consecutivos fallan.
```

y agrega inmediatamente después (misma sección, antes de la línea en blanco que sigue):

```
12. ARTEFACTOS (reportes largos y tablas grandes): Cuando tu respuesta completa (después de aplicar el FORMATO OBLIGATORIO de abajo) supere ~200-300 palabras, O la tabla tenga más de 8 filas, envuelve la respuesta completa en un bloque marcado así:
    ```artefacto
    {"tipo": "reporte", "titulo": "Título corto y descriptivo"}
    ...todo el contenido markdown completo (tabla, análisis ejecutivo, todo)...
    ```
    Usa "tipo": "tabla" en vez de "reporte" si el contenido es principalmente una tabla sin mucho análisis alrededor. SIEMPRE deja, fuera del bloque (antes o después), un resumen de 2-3 líneas que sí se lea directamente en el chat — nunca dejes el chat vacío esperando a que el usuario abra el artefacto. NUNCA uses este bloque para respuestas cortas, confirmaciones, ni para las tarjetas de 'preguntar_usuario' (ese es un mecanismo aparte). Máximo un bloque ```artefacto por respuesta.
```

- [ ] **Step 2: Aclarar la interacción con el formato de tabla ya obligatorio**

Busca este texto exacto (dentro de `PASO 2 — GRÁFICO AUTOMÁTICO`):

```
  • EXCEPCIÓN: si la respuesta tiene solo 1-2 filas de datos o es una consulta de ticket individual, omite el gráfico.
```

y agrega inmediatamente después, antes de `PASO 3`:

```

PASO 2b — EMPAQUETAR COMO ARTEFACTO (cuando aplique):
  • Aplica la regla 12 de arriba DESPUÉS de completar los pasos 1-5 de este formato: arma la respuesta completa primero (tabla, gráfico, comparación con meta, análisis ejecutivo), y recién ahí decide si por tamaño debe ir envuelta en el bloque ```artefacto.
  • El gráfico (PASO 2) y el Excel, si los hay, NO van dentro del bloque ```artefacto — sus propias etiquetas [EmbedChart:...] / [Descargar Reporte Excel](...) siempre se dejan fuera, en el resumen corto que se lee en el chat, para que aparezcan como su propia tarjeta.
```

- [ ] **Step 3: Verificar que el backend compila**

Run: `cd backend && python -m py_compile main.py`
Expected: sin salida.

- [ ] **Step 4: Verificación manual del contenido del prompt**

Este cambio es texto de prompt — no se puede probar con asserts de forma significativa (solo se puede confirmar que el texto quedó bien armado). Crea `backend/_verify_prompt_artefacto.py` (temporal, se borra en el Step 6):

```python
"""Verificación manual de que la regla 12 quedo en el system prompt. Ejecutar: python _verify_prompt_artefacto.py"""
from main import build_system_prompt

prompt = build_system_prompt("2026-07-10", "10:00")
assert "12. ARTEFACTOS" in prompt, "no se encontró la regla 12 en el system prompt"
assert '```artefacto' in prompt, "no se encontró el formato del bloque artefacto"
assert "PASO 2b" in prompt, "no se encontró la aclaración de PASO 2b"
print("TODO OK")
```

- [ ] **Step 5: Ejecutar y confirmar**

Run: `cd backend && python _verify_prompt_artefacto.py`
Expected: `TODO OK`

- [ ] **Step 6: Borrar el script temporal**

```bash
rm backend/_verify_prompt_artefacto.py
```

- [ ] **Step 7: Commit**

```bash
git add backend/main.py
git commit -m "feat: regla de system prompt para el bloque artefacto"
```

---

### Task 3: Frontend — utilidad de extracción de artefactos

**Files:**
- Create: `frontend/src/utils/artifactParser.js`

**Interfaces:**
- Produces: `extractArtifacts(content: string): { cleanContent: string, artifacts: Artifact[] }` — donde `Artifact` es `{ type: 'reporte'|'tabla'|'excel'|'chart'|'pdf', titulo: string, contenido?: string, url?: string }`.
- Produces: `detectOpenArtifact(content: string): { titulo: string|null } | null` — para el estado "generando" durante streaming.
- Consumes: nada — funciones puras, sin dependencia de React ni del resto del proyecto.

- [ ] **Step 1: Crear `frontend/src/utils/artifactParser.js`**

```javascript
// Extrae los artefactos (reportes/tablas marcadas por la IA, y archivos
// generados: Excel/gráfico/PDF) del contenido de un mensaje, y devuelve
// el texto que debe verse en el chat sin ellos.

const ARTEFACTO_BLOCK_RE = /```artefacto\n([\s\S]*?)\n```/g;
const CHART_RE = /\[EmbedChart:([^\]]+)\]/i;
const CHART_LINK_RE = /\[[^\]]+\]\((https:\/\/[^)]+\.html)\)/i;
const EXCEL_RE = /\[Descargar Reporte Excel\]\(([^)]+)\)/i;
const EXCEL_LINK_RE = /\[[^\]]+\]\((https:\/\/[^)]+\.xlsx)\)/i;
const PDF_RE = /\[EmbedPDF:([^\]]+)\]/i;

function parseArtefactoBlock(rawBlockContent) {
  const firstNewline = rawBlockContent.indexOf('\n');
  if (firstNewline === -1) return null;
  const jsonLine = rawBlockContent.slice(0, firstNewline).trim();
  const body = rawBlockContent.slice(firstNewline + 1);
  let meta;
  try {
    meta = JSON.parse(jsonLine);
  } catch {
    return null;
  }
  if (!meta || !meta.titulo || (meta.tipo !== 'reporte' && meta.tipo !== 'tabla')) return null;
  return { type: meta.tipo, titulo: meta.titulo, contenido: body };
}

export function extractArtifacts(content) {
  if (!content) return { cleanContent: '', artifacts: [] };

  const artifacts = [];
  let cleanContent = content;

  cleanContent = cleanContent.replace(ARTEFACTO_BLOCK_RE, (match, rawBlockContent) => {
    const artifact = parseArtefactoBlock(rawBlockContent);
    if (artifact) artifacts.push(artifact);
    return '';
  });

  const chartMatch = CHART_RE.exec(cleanContent) || CHART_LINK_RE.exec(cleanContent);
  if (chartMatch) {
    artifacts.push({ type: 'chart', titulo: 'Gráfico interactivo', url: chartMatch[1] });
    cleanContent = cleanContent
      .replace(/\[EmbedChart:[^\]]+\]/gi, '')
      .replace(/\[[^\]]+\]\(https:\/\/[^)]+\.html\)/gi, '');
  }

  const excelMatch = EXCEL_RE.exec(cleanContent) || EXCEL_LINK_RE.exec(cleanContent);
  if (excelMatch) {
    artifacts.push({ type: 'excel', titulo: 'Reporte Excel', url: excelMatch[1] });
    cleanContent = cleanContent
      .replace(/\[Descargar Reporte Excel\]\([^)]+\)/gi, '')
      .replace(/\[[^\]]+\]\(https:\/\/[^)]+\.xlsx\)/gi, '');
  }

  const pdfMatch = PDF_RE.exec(cleanContent);
  if (pdfMatch) {
    const pdfUrl = pdfMatch[1];
    const pdfName = pdfUrl.split('/').pop() || 'informe_tecnico.pdf';
    artifacts.push({ type: 'pdf', titulo: pdfName, url: pdfUrl });
    cleanContent = cleanContent.replace(/\[EmbedPDF:[^\]]+\]/gi, '');
  }

  return { cleanContent: cleanContent.trim(), artifacts };
}

export function detectOpenArtifact(content) {
  if (!content) return null;
  const openIdx = content.lastIndexOf('```artefacto');
  if (openIdx === -1) return null;
  const afterOpen = content.slice(openIdx + '```artefacto'.length);
  if (afterOpen.includes('```')) return null; // ya se cerró, extractArtifacts lo maneja

  let titulo = null;
  const firstLineMatch = /^\s*\n?(\{[^\n]*\})/.exec(afterOpen);
  if (firstLineMatch) {
    try { titulo = JSON.parse(firstLineMatch[1]).titulo || null; } catch { titulo = null; }
  }
  return { titulo };
}
```

- [ ] **Step 2: Escribir el script de verificación**

Este es JS puro (sin React), así que se puede correr directo con Node. Crear `frontend/src/utils/_verify_artifactParser.mjs` (temporal, se borra en el Step 4):

```javascript
import { extractArtifacts, detectOpenArtifact } from './artifactParser.js';

// Caso 1: bloque artefacto tipo reporte
{
  const content = 'Resumen corto.\n\n```artefacto\n{"tipo": "reporte", "titulo": "Fugas de gas"}\n## Detalle\nTexto completo aca.\n```\n';
  const { cleanContent, artifacts } = extractArtifacts(content);
  console.assert(artifacts.length === 1, `esperaba 1 artefacto, obtuve ${artifacts.length}`);
  console.assert(artifacts[0].type === 'reporte', `tipo incorrecto: ${artifacts[0].type}`);
  console.assert(artifacts[0].titulo === 'Fugas de gas', `titulo incorrecto: ${artifacts[0].titulo}`);
  console.assert(artifacts[0].contenido.includes('## Detalle'), 'contenido no capturado');
  console.assert(!cleanContent.includes('```artefacto'), 'el bloque no se removio del texto visible');
  console.assert(cleanContent.includes('Resumen corto'), 'se perdio el resumen fuera del bloque');
}

// Caso 2: archivo de grafico (marcador existente, sin cambios)
{
  const content = 'Aqui esta tu grafico.\n[EmbedChart:/static/charts/x.html]';
  const { cleanContent, artifacts } = extractArtifacts(content);
  console.assert(artifacts.length === 1 && artifacts[0].type === 'chart', 'no detecto el chart');
  console.assert(artifacts[0].url === '/static/charts/x.html', `url incorrecta: ${artifacts[0].url}`);
  console.assert(!cleanContent.includes('EmbedChart'), 'el marcador de chart no se removio');
}

// Caso 3: excel + pdf combinados
{
  const content = 'Reporte listo.\n[Descargar Reporte Excel](/static/reports/y.xlsx)\n[EmbedPDF:/static/uploads/z.pdf]';
  const { artifacts } = extractArtifacts(content);
  console.assert(artifacts.some(a => a.type === 'excel' && a.url === '/static/reports/y.xlsx'), 'no detecto excel');
  console.assert(artifacts.some(a => a.type === 'pdf' && a.titulo === 'z.pdf'), 'no detecto pdf o nombre incorrecto');
}

// Caso 4: sin artefactos, contenido normal pasa intacto
{
  const content = 'Hola, esto es una respuesta corta normal.';
  const { cleanContent, artifacts } = extractArtifacts(content);
  console.assert(artifacts.length === 0, 'no deberia detectar artefactos aqui');
  console.assert(cleanContent === content, 'el contenido normal no deberia modificarse');
}

// Caso 5: bloque artefacto todavia abierto (streaming en curso)
{
  const partial = 'Resumen corto.\n\n```artefacto\n{"tipo": "reporte", "titulo": "Fugas de gas"}\n## Detalle par';
  const state = detectOpenArtifact(partial);
  console.assert(state !== null, 'deberia detectar un bloque abierto');
  console.assert(state.titulo === 'Fugas de gas', `titulo no capturado durante streaming: ${state?.titulo}`);
}

// Caso 6: bloque ya cerrado no debe reportarse como abierto
{
  const closed = 'Resumen.\n```artefacto\n{"tipo": "tabla", "titulo": "X"}\ncontenido\n```\n';
  const state = detectOpenArtifact(closed);
  console.assert(state === null, 'un bloque ya cerrado no deberia detectarse como abierto');
}

console.log('TODO OK');
```

- [ ] **Step 3: Ejecutar el script y confirmar**

Run: `cd frontend/src/utils && node _verify_artifactParser.mjs`
Expected: `TODO OK` (si algún `console.assert` falla, Node imprime el mensaje del assert a stderr pero NO detiene la ejecución — revisa que no haya ninguna línea de error antes de "TODO OK").

- [ ] **Step 4: Borrar el script temporal**

```bash
rm frontend/src/utils/_verify_artifactParser.mjs
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/artifactParser.js
git commit -m "feat: utilidad de extraccion de artefactos (reportes, tablas, archivos)"
```

---

### Task 4: Frontend — componente `ArtifactCard`

**Files:**
- Create: `frontend/src/components/ArtifactCard.jsx`
- Modify: `frontend/src/App.css` (nueva sección al final del archivo)

**Interfaces:**
- Consumes: un objeto `artifact` con la forma que produce `extractArtifacts` (Tarea 3): `{ type, titulo, contenido?, url? }`.
- Produces: componente `ArtifactCard({ artifact, onClick, generating })` — `generating` (bool) es para el estado "aún generándose" durante streaming (Tarea 6 lo usa).

- [ ] **Step 1: Crear `frontend/src/components/ArtifactCard.jsx`**

```jsx
import React from 'react';
import { BarChart3, FileText, Table2, FileSpreadsheet, FileType } from 'lucide-react';

const ICONS = {
  reporte: FileText,
  tabla: Table2,
  excel: FileSpreadsheet,
  chart: BarChart3,
  pdf: FileType,
};

const SUBTITLES = {
  reporte: 'Reporte',
  tabla: 'Tabla de datos',
  excel: 'Hoja de cálculo',
  chart: 'Gráfico interactivo',
  pdf: 'Documento PDF',
};

export default function ArtifactCard({ artifact, onClick, generating = false }) {
  const Icon = ICONS[artifact.type] || FileText;

  return (
    <button
      className={`artifact-card${generating ? ' artifact-card-generating' : ''}`}
      onClick={() => !generating && onClick(artifact)}
      disabled={generating}
      type="button"
    >
      <div className="artifact-card-icon">
        {generating ? <div className="artifact-card-spinner" /> : <Icon size={20} />}
      </div>
      <div className="artifact-card-text">
        <div className="artifact-card-title">
          {generating ? 'Generando…' : artifact.titulo}
        </div>
        <div className="artifact-card-subtitle">
          {generating ? artifact.titulo : SUBTITLES[artifact.type]}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Agregar el CSS — nueva sección al final de `frontend/src/App.css`**

Agregar al final del archivo (después de la última regla existente, no reemplaza nada):

```css
/* ═══════════════════════════════════════════════
   ARTIFACT CARD — tarjeta compacta en el chat
   (una sola definición de cada selector — no duplicar en otra parte del archivo)
═══════════════════════════════════════════════ */

.artifact-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 360px;
  padding: 12px 14px;
  margin: 8px 0;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--transition), background var(--transition);
}
.artifact-card:hover:not(:disabled) {
  border-color: var(--color-primary);
  background: var(--bg-hover);
}
.artifact-card:disabled {
  cursor: default;
  opacity: 0.85;
}

.artifact-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.artifact-card-spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--color-primary-light);
  border-top-color: var(--color-primary);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.artifact-card-text { min-width: 0; flex: 1; }
.artifact-card-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artifact-card-subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 3: Verificar que el frontend compila**

Run: `cd frontend && npm run build`
Expected: `✓ built in ...` sin errores (el componente no se usa todavía en ningún lado, así que este build solo confirma que no hay errores de sintaxis).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ArtifactCard.jsx frontend/src/App.css
git commit -m "feat: componente ArtifactCard"
```

---

### Task 5: Frontend — componente `ArtifactPanel` (incluye vista previa de Excel)

**Files:**
- Create: `frontend/src/components/ArtifactPanel.jsx`
- Modify: `frontend/package.json` (agregar `xlsx`)
- Modify: `frontend/src/App.css` (continuar la sección `ARTIFACT` agregada en la Tarea 4)

**Interfaces:**
- Consumes: `extractArtifacts`/`Artifact` shape de la Tarea 3. Endpoint `POST /api/artifacts/export-pdf` de la Tarea 1 (body `{titulo, contenido_markdown}`, respuesta binaria PDF).
- Consumes: `parseMarkdown(text)` de `frontend/src/utils/markdown.js` (ya existe, sin cambios).
- Produces: componente `ArtifactPanel({ artifact, onClose, getFullUrl })` — si `artifact` es `null`, no renderiza nada (el padre decide cuándo mostrarlo).

- [ ] **Step 1: Agregar la dependencia `xlsx`**

En `frontend/package.json`, agregar a `"dependencies"` (mismo bloque donde está `"marked"`):

```json
    "xlsx": "^0.18.5",
```

- [ ] **Step 2: Instalar**

Run: `cd frontend && npm install`
Expected: instala sin errores (agrega `xlsx` a `node_modules` y a `package-lock.json`).

- [ ] **Step 3: Crear `frontend/src/components/ArtifactPanel.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { X, Copy, Check, Download, ExternalLink } from 'lucide-react';
import { parseMarkdown } from '../utils/markdown';
import { apiClient } from '../services/apiClient';

function ExcelPreview({ url }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(buffer => {
        if (cancelled) return;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
        setRows(data.slice(0, 100));
      })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [url]);

  if (error) return <div className="artifact-panel-error">No se pudo leer el archivo: {error}</div>;
  if (!rows) return <div className="artifact-panel-loading">Cargando vista previa…</div>;
  if (rows.length === 0) return <div className="artifact-panel-error">El archivo está vacío.</div>;

  const [header, ...body] = rows;
  return (
    <div className="artifact-excel-table-wrap">
      <table className="artifact-excel-table">
        <thead>
          <tr>{header.map((cell, i) => <th key={i}>{String(cell)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i}>
              {header.map((_, j) => <td key={j}>{String(row[j] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length >= 100 && (
        <div className="artifact-panel-note">Mostrando las primeras 100 filas.</div>
      )}
    </div>
  );
}

export default function ArtifactPanel({ artifact, onClose, getFullUrl }) {
  const [copied, setCopied] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => { setCopied(false); }, [artifact]);

  if (!artifact) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.contenido || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard no disponible */ }
  };

  const handleDownloadPdf = async () => {
    setExportingPdf(true);
    try {
      const token = localStorage.getItem('siatc_token');
      const res = await fetch(`${apiClient.API_BASE_URL || ''}/api/artifacts/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ titulo: artifact.titulo, contenido_markdown: artifact.contenido }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${artifact.titulo.replace(/[^\w\-]/g, '_').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(`No se pudo exportar el PDF: ${err.message}`);
    } finally {
      setExportingPdf(false);
    }
  };

  const fullUrl = artifact.url ? getFullUrl(artifact.url) : null;

  return (
    <div className="artifact-panel">
      <div className="artifact-panel-header">
        <div className="artifact-panel-title">{artifact.titulo}</div>
        <button className="artifact-panel-close" onClick={onClose} title="Cerrar" type="button">
          <X size={18} />
        </button>
      </div>

      <div className="artifact-panel-actions">
        {(artifact.type === 'reporte' || artifact.type === 'tabla') && (
          <>
            <button className="artifact-panel-action-btn" onClick={handleCopy} type="button">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button className="artifact-panel-action-btn" onClick={handleDownloadPdf} disabled={exportingPdf} type="button">
              <Download size={14} /> {exportingPdf ? 'Generando PDF…' : 'Descargar PDF'}
            </button>
          </>
        )}
        {(artifact.type === 'excel' || artifact.type === 'chart' || artifact.type === 'pdf') && fullUrl && (
          <>
            <a className="artifact-panel-action-btn" href={fullUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> Abrir en pestaña nueva
            </a>
            <a className="artifact-panel-action-btn" href={fullUrl} download>
              <Download size={14} /> Descargar
            </a>
          </>
        )}
      </div>

      <div className="artifact-panel-body">
        {(artifact.type === 'reporte' || artifact.type === 'tabla') && (
          <div
            className="artifact-panel-markdown"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(artifact.contenido || '') }}
          />
        )}
        {artifact.type === 'excel' && fullUrl && <ExcelPreview url={fullUrl} />}
        {artifact.type === 'chart' && fullUrl && (
          <iframe src={fullUrl} title={artifact.titulo} className="artifact-panel-iframe" />
        )}
        {artifact.type === 'pdf' && fullUrl && (
          <iframe src={fullUrl} title={artifact.titulo} className="artifact-panel-iframe" />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Corregir el uso de `API_BASE_URL`**

`apiClient.js` exporta `API_BASE_URL` como export nombrado, no como propiedad de `apiClient`. En el archivo que acabas de crear, cambia el import y el uso:

Cambia:
```jsx
import { apiClient } from '../services/apiClient';
```
por:
```jsx
import { API_BASE_URL } from '../services/apiClient';
```

Y cambia:
```jsx
      const res = await fetch(`${apiClient.API_BASE_URL || ''}/api/artifacts/export-pdf`, {
```
por:
```jsx
      const res = await fetch(`${API_BASE_URL}/api/artifacts/export-pdf`, {
```

- [ ] **Step 5: Agregar el CSS del panel — continuar la sección `ARTIFACT` de `frontend/src/App.css`**

Agregar al final del archivo, después del CSS de `ArtifactCard` de la Tarea 4 (misma sección, no crear un segundo bloque separado):

```css
.artifact-panel {
  display: flex;
  flex-direction: column;
  width: 440px;
  min-width: 440px;
  height: 100%;
  border-left: 1px solid var(--border);
  background: var(--bg-surface);
  overflow: hidden;
}

.artifact-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.artifact-panel-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artifact-panel-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: background var(--transition);
}
.artifact-panel-close:hover { background: var(--bg-hover); }

.artifact-panel-actions {
  display: flex;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.artifact-panel-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;
}
.artifact-panel-action-btn:hover { color: var(--text-primary); border-color: var(--color-primary); }
.artifact-panel-action-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.artifact-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
.artifact-panel-markdown { font-size: 0.9375rem; line-height: 1.7; color: var(--text-primary); }
.artifact-panel-iframe { width: 100%; height: 100%; min-height: 500px; border: none; }

.artifact-panel-loading,
.artifact-panel-error {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}
.artifact-panel-note {
  padding: 10px 4px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.artifact-excel-table-wrap { overflow-x: auto; }
.artifact-excel-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.artifact-excel-table th,
.artifact-excel-table td {
  padding: 8px 12px;
  border: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}
.artifact-excel-table th {
  background: var(--bg-hover);
  color: var(--text-primary);
  font-weight: 600;
}
.artifact-excel-table td { color: var(--text-secondary); }

@media (max-width: 768px) {
  .artifact-panel {
    position: fixed;
    inset: 0;
    width: 100%;
    min-width: 0;
    z-index: 400;
    border-left: none;
  }
}
```

- [ ] **Step 6: Verificar que el frontend compila**

Run: `cd frontend && npm run build`
Expected: `✓ built in ...` sin errores.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/ArtifactPanel.jsx frontend/src/App.css
git commit -m "feat: componente ArtifactPanel con vista previa de Excel"
```

---

### Task 6: Frontend — integrar todo en `ChatArea.jsx`

**Files:**
- Modify: `frontend/src/components/ChatArea.jsx`
- Modify: `frontend/src/utils/markdown.js:16-20` (excepción para el bloque `artefacto`, mismo patrón que `pregunta-usuario`)
- Modify: `frontend/src/App.css` (un ajuste de layout, ver Step 5)

**Interfaces:**
- Consumes: `extractArtifacts`, `detectOpenArtifact` (Tarea 3), `ArtifactCard` (Tarea 4), `ArtifactPanel` (Tarea 5).

- [ ] **Step 1: Excepción en `markdown.js` para el bloque `artefacto`**

En `frontend/src/utils/markdown.js`, dentro de la función `code({ text, lang })`, busca:

```javascript
      if (lang === 'pregunta-usuario') return '';
```

y agrega la línea siguiente, inmediatamente después:

```javascript
      if (lang === 'artefacto') return '';
```

- [ ] **Step 2: Imports nuevos en `ChatArea.jsx`**

Al inicio de `frontend/src/components/ChatArea.jsx`, después de:

```jsx
import MessageActions from './MessageActions';
```

agregar:

```jsx
import ArtifactCard from './ArtifactCard';
import ArtifactPanel from './ArtifactPanel';
import { extractArtifacts, detectOpenArtifact } from '../utils/artifactParser';
```

- [ ] **Step 3: Estado del panel activo**

Dentro del componente `ChatArea`, junto a los demás `useState` (después de la línea `const [showCostPanel, setShowCostPanel] = useState(false);`), agregar:

```jsx
  const [activeArtifact, setActiveArtifact] = useState(null);
```

- [ ] **Step 4: Reescribir `renderMessageContent` para usar tarjetas en vez de embeds inline**

Reemplaza la función completa `renderMessageContent` (desde `const renderMessageContent = (content, index, isLastAiMessage = false) => {` hasta su cierre `};`, justo antes de `// Burbuja de streaming`) por:

```jsx
  // Renderizado de mensajes: markdown normal + tarjetas de artefactos
  const renderMessageContent = (content, index, isLastAiMessage = false) => {
    const questionMatch = /```pregunta-usuario\n([\s\S]*?)\n```/.exec(content);
    if (questionMatch) {
      let q = null;
      try { q = JSON.parse(questionMatch[1]); } catch { q = null; }
      if (q && q.pregunta && Array.isArray(q.opciones)) {
        return renderQuestionCard(q, isLastAiMessage);
      }
    }

    const { cleanContent, artifacts } = extractArtifacts(content);

    return (
      <div className="message-body">
        <div dangerouslySetInnerHTML={{ __html: parseMarkdown(cleanContent) }} />
        {artifacts.map((artifact, i) => (
          <ArtifactCard
            key={`${index}-${i}`}
            artifact={artifact}
            onClick={setActiveArtifact}
          />
        ))}
      </div>
    );
  };
```

- [ ] **Step 5: Tarjeta de "generando" durante streaming, en `renderStreamingBubble`**

Reemplaza la función completa `renderStreamingBubble` por:

```jsx
  // Burbuja de streaming (respuesta en construcción)
  const renderStreamingBubble = () => {
    if (!isLoading) return null;

    const openArtifact = streamingContent ? detectOpenArtifact(streamingContent) : null;
    const { cleanContent, artifacts } = streamingContent
      ? extractArtifacts(streamingContent)
      : { cleanContent: '', artifacts: [] };

    return (
      <div className="message-container message-ai">
        <div className="message-ai-body">
          <div className="message-ai-text">
            {cleanContent
              ? <span dangerouslySetInnerHTML={{ __html: parseMarkdown(cleanContent) }} />
              : (!openArtifact && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pensando...</span>)
            }
            {artifacts.map((artifact, i) => (
              <ArtifactCard key={i} artifact={artifact} onClick={setActiveArtifact} />
            ))}
            {openArtifact && (
              <ArtifactCard
                artifact={{ type: 'reporte', titulo: openArtifact.titulo || 'reporte' }}
                onClick={() => {}}
                generating
              />
            )}
            <span className="streaming-cursor" />
          </div>
        </div>
      </div>
    );
  };
```

- [ ] **Step 6: Envolver el layout para que el panel aparezca al lado**

Busca la última línea del componente, el `return` principal que empieza con:

```jsx
  return (
    <div className="main-content">
```

y termina con:

```jsx
    </div>
  );
}

export default ChatArea;
```

Cambia el `return` para envolver `.main-content` y el panel en un contenedor nuevo. La estructura completa del final del archivo queda:

```jsx
  return (
    <div className="chat-area-layout">
      <div className="main-content">
        {/* Topbar */}
        <div className="topbar">
```

(todo el contenido interno de `.main-content` que ya existe se queda exactamente igual, sin tocar nada más adentro) y el cierre final cambia de:

```jsx
      </div>
    </div>
  );
}

export default ChatArea;
```

a:

```jsx
      </div>
      <ArtifactPanel
        artifact={activeArtifact}
        onClose={() => setActiveArtifact(null)}
        getFullUrl={getFullUrl}
      />
    </div>
  );
}

export default ChatArea;
```

En otras palabras: se agrega un `<div className="chat-area-layout">` envolviendo todo, y `<ArtifactPanel .../>` como hermano de `.main-content`, justo antes del cierre de ese nuevo div. Nada del contenido interno de `.main-content` cambia.

- [ ] **Step 7: Reemplazar los embeds de archivo restantes**

Los bloques `excelUrl`/`chartUrl`/`pdfUrl` que quedaban dentro de la función vieja `renderMessageContent` ya no existen (el Step 4 reemplazó toda la función). Confirma que no quedó ningún rastro de `chart-container-wrapper`, `download-card`, ni `pdf-container-wrapper` en `ChatArea.jsx`:

Run: `grep -n "chart-container-wrapper\|download-card\|pdf-container-wrapper" frontend/src/components/ChatArea.jsx`
Expected: sin resultados (0 coincidencias). Si aparece alguna, es porque el Step 4 no reemplazó la función completa — revisa que copiaste el bloque nuevo completo.

- [ ] **Step 8: Agregar el CSS del layout — continuar la sección `ARTIFACT` de `frontend/src/App.css`**

Agregar al final del archivo (misma sección de las Tareas 4 y 5):

```css
.chat-area-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: 100vh;
}
```

- [ ] **Step 9: Verificar que compila**

Run: `cd frontend && npm run build`
Expected: `✓ built in ...` sin errores.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/ChatArea.jsx frontend/src/utils/markdown.js frontend/src/App.css
git commit -m "feat: integrar tarjetas y panel de artefactos en ChatArea"
```

---

### Task 7: Verificación end-to-end manual

**Files:** ninguno — solo verificación en navegador real.

- [ ] **Step 1: Arrancar backend y frontend, iniciar sesión real**

Usa las herramientas de preview (`preview_start` con los nombres `backend`/`frontend` de `.claude/launch.json`), inicia sesión con credenciales reales.

- [ ] **Step 2: Provocar un reporte largo con tabla**

Pregunta algo que dispare un reporte con tabla grande y análisis ejecutivo — por ejemplo el ranking de NPS por técnico ya usado antes en este proyecto para pruebas. Confirma:
- En el chat aparece un resumen corto + una tarjeta "📄 [título]".
- Mientras se genera, la tarjeta muestra "Generando…" con spinner y no es clickeable.
- Al terminar, hacer clic en la tarjeta abre el panel a la derecha con el reporte completo, chat sigue visible a la izquierda.

- [ ] **Step 3: Probar las acciones del panel para reporte**

- Clic en "Copiar" → pegar en cualquier campo de texto y confirmar que el contenido coincide con el reporte.
- Clic en "Descargar PDF" → confirmar que se descarga un archivo `.pdf` y que al abrirlo se ve el título, la tabla, y el análisis con formato legible (no HTML crudo).

- [ ] **Step 4: Provocar un gráfico**

Pide un gráfico (ej. "genera el ranking de NPS con gráfico"). Confirma que aparece como tarjeta "📈 Gráfico interactivo" (no incrustado inline como antes), que al abrir el panel el gráfico se ve completo y funcional (las barras/líneas se ven, no solo ejes — ver el fix de Plotly local ya aplicado), y que "Abrir en pestaña nueva" y "Descargar" funcionan.

- [ ] **Step 5: Provocar un Excel**

Pide un reporte que genere Excel (consulta masiva, >3 meses). Confirma que aparece como tarjeta "📗 Reporte Excel", que al abrir el panel se ve una tabla real con los datos (no solo ficha+botón), y que tiene datos coherentes con lo que debería contener el archivo.

- [ ] **Step 6: Verificar que no se rompió nada existente**

- Abre una conversación vieja (de antes de este cambio) que tenga un gráfico o Excel ya generado — confirma que también aparece como tarjeta ahora (beneficio automático, sin reprocesar).
- Dispara una pregunta de clarificación (`preguntar_usuario`) — confirma que sigue funcionando exactamente igual que antes (tarjeta de opciones inline, sin panel).
- Confirma que una respuesta corta normal (sin artefactos) se ve exactamente igual que siempre.

- [ ] **Step 7: Probar en mobile**

Redimensiona el navegador a un viewport de celular (375px). Abre un artefacto — confirma que el panel ocupa toda la pantalla con su propio botón de cerrar, y que se puede volver al chat.

- [ ] **Step 8: Reportar hallazgos**

Si todo funciona: no hace falta commit (esta tarea es solo verificación). Si algo falla, documentar el hallazgo exacto (qué se esperaba, qué pasó) para decidir si se arregla antes de cerrar el plan.
