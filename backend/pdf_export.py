"""Conversión de markdown a PDF para el panel de artefactos.

No depende de FastAPI ni de nada del resto del backend — función pura,
fácil de probar por separado.
"""
import io
import re
import html as html_lib
from datetime import datetime
import markdown as md
import fitz

# Paleta de marca SIATC.IA (misma que --color-primary en frontend/src/App.css).
# IMPORTANTE: no usar background-color en NINGÚN selector de esta hoja de estilos.
# fitz.Story (motor HTML->PDF de PyMuPDF) tiene un bug confirmado: cuando un
# reporte tiene una tabla que cruza el salto de página, cualquier elemento con
# background-color en el documento (sin importar dónde esté, incluso antes de
# la tabla) se redibuja como una barra de color fantasma sobre la primera fila
# de la tabla en la página siguiente. Verificado de forma aislada con y sin
# fondo en el encabezado y en las celdas th — el bug desaparece por completo
# al quitar todo background-color. El look de marca se logra solo con texto
# en color y bordes.
_BRAND = "#4C5F80"
_BRAND_DARK = "#33415C"
_TEXT = "#1F2933"
_MUTED = "#6B7785"
_BORDER = "#D7DCE3"

_CSS = f"""
* {{ box-sizing: border-box; }}
body {{
    font-family: Helvetica;
    font-size: 11px;
    line-height: 1.55;
    color: {_TEXT};
}}
.pdf-header {{
    border-bottom: 3px solid {_BRAND};
    padding-bottom: 10px;
    margin-bottom: 18px;
}}
.pdf-header h1 {{
    font-size: 19px;
    margin: 0 0 4px 0;
    color: {_BRAND_DARK};
}}
.pdf-header .pdf-meta {{
    font-size: 9px;
    color: {_MUTED};
}}
h1, h2, h3 {{ color: {_BRAND_DARK}; }}
h2 {{
    font-size: 14px;
    margin-top: 20px;
    padding-bottom: 4px;
    border-bottom: 1.5px solid {_BRAND};
}}
h3 {{ font-size: 12.5px; margin-top: 14px; }}
p {{ margin: 6px 0; }}
strong {{ color: {_BRAND_DARK}; }}
a {{ color: {_BRAND}; }}
table {{
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 16px 0;
    font-size: 10px;
}}
th {{
    color: {_BRAND_DARK};
    text-align: left;
    padding: 6px 8px;
    border-bottom: 2px solid {_BRAND};
}}
td {{
    padding: 5px 8px;
    border: 1px solid {_BORDER};
}}
ul, ol {{ margin: 6px 0; padding-left: 18px; }}
li {{ margin: 3px 0; }}
code {{
    border: 1px solid {_BORDER};
    padding: 1px 4px;
    font-family: Courier;
}}
.pdf-footer {{
    margin-top: 24px;
    padding-top: 8px;
    border-top: 1px solid {_BORDER};
    font-size: 8.5px;
    color: {_MUTED};
}}
"""


def markdown_to_pdf_bytes(titulo: str, contenido_markdown: str) -> bytes:
    """Convierte un reporte en markdown a un PDF con formato (títulos, tablas, listas).

    Usa fitz.Story (PyMuPDF) para el layout HTML→PDF — no agrega ninguna
    dependencia nueva de PDF, pymupdf ya está instalado en este proyecto.
    """
    html_body = md.markdown(
        contenido_markdown,
        extensions=["tables", "fenced_code"],
    )
    titulo_seguro = html_lib.escape(titulo)
    fecha_generacion = datetime.now().strftime("%d/%m/%Y %H:%M")
    html = f"""
    <html>
    <head><style>{_CSS}</style></head>
    <body>
        <div class="pdf-header">
            <h1>{titulo_seguro}</h1>
            <div class="pdf-meta">Generado por SIATC.IA el {fecha_generacion}</div>
        </div>
        {html_body}
        <div class="pdf-footer">SIATC.IA · Grupo SOLE / Rinnai — Este reporte fue generado automáticamente y puede contener errores. Verifica información importante.</div>
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
