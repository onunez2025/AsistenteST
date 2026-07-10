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
