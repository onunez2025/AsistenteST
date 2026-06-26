import React from 'react';
import { X, BookOpen, Save, Trash2, Send, Plus } from 'lucide-react';

export default function Notebook({
  activeNote,
  onSaveNote,
  onDeleteNote,
  onNewNote,
  onSendToChat,
  setActiveNote,
  setIsNotebookOpen,
}) {
  return (
    <div className="notebook-overlay" onClick={() => setIsNotebookOpen(false)}>
      <div className="notebook-panel" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="notebook-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={18} style={{ color: 'var(--color-primary)' }} />
            <span className="notebook-title">Cuaderno de trabajo</span>
          </div>
          <button className="notebook-close-btn" onClick={() => setIsNotebookOpen(false)} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="notebook-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Note title input */}
          <input
            type="text"
            placeholder="Nombre del cuaderno..."
            className="notebook-note-title-input"
            value={activeNote?.title || ''}
            onChange={(e) => setActiveNote(prev => ({ ...prev, title: e.target.value }))}
          />

          {/* Info hint */}
          <div className="notebook-hint">
            <span>💡</span>
            <span>Agrega contexto o instrucciones para que SIATC.IA te ayude mejor en tus consultas.</span>
          </div>

          {/* Content textarea */}
          <textarea
            className="notebook-textarea"
            placeholder="Escribe aquí el contexto de trabajo, instrucciones, anotaciones del CAS, reclamos del cliente o consultas SQL recurrentes..."
            value={activeNote?.content || ''}
            onChange={(e) => setActiveNote(prev => ({ ...prev, content: e.target.value }))}
          />
        </div>

        {/* Footer actions */}
        <div className="notebook-footer">
          {activeNote?.id && (
            <button className="notebook-footer-btn danger" onClick={(e) => onDeleteNote(activeNote.id, e)} title="Eliminar">
              <Trash2 size={15} />
              Eliminar
            </button>
          )}
          <div style={{ flex: 1 }} />
          {activeNote?.id && (
            <button className="notebook-footer-btn secondary" onClick={onNewNote} title="Nuevo cuaderno">
              <Plus size={15} />
              Nuevo
            </button>
          )}
          {activeNote?.content && (
            <button className="notebook-footer-btn secondary" onClick={() => onSendToChat(activeNote.content)} title="Cargar en el chat">
              <Send size={15} />
              Al chat
            </button>
          )}
          <button className="notebook-footer-btn primary" onClick={onSaveNote} title="Guardar">
            <Save size={15} />
            Guardar
          </button>
        </div>

      </div>
    </div>
  );
}
