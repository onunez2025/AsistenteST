import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { X, Copy, Check, Download, ExternalLink } from 'lucide-react';
import { parseMarkdown } from '../utils/markdown';
import { API_BASE_URL } from '../services/apiClient';

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
      const res = await fetch(`${API_BASE_URL}/api/artifacts/export-pdf`, {
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
