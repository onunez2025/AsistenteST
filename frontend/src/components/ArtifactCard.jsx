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
