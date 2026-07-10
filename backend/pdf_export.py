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
