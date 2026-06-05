import React from 'react';
import { BookOpenIcon, XIcon, TrashIcon } from './icons';

export default function Notebook({
  activeNote,
  notes,
  isNotebookOpen,
  onSaveNote,
  onDeleteNote,
  onNewNote,
  onSendToChat,
  setActiveNote,
  setIsNotebookOpen
}) {
  return (
    <div className={`notebook-panel ${isNotebookOpen ? '' : 'closed'}`}>
      <div className="notebook-header">
        <div className="notebook-title">
          <BookOpenIcon />
          <span>Cuaderno de Gestión SOLE</span>
        </div>
        <button 
          className="header-action-btn" 
          onClick={() => setIsNotebookOpen(false)} 
          title="Cerrar Cuaderno"
        >
          <XIcon />
        </button>
      </div>

      <div className="notebook-content">
        {/* Note Editor */}
        <div className="notebook-editor-card">
          <input 
            type="text" 
            placeholder="Título de la nota..." 
            className="notebook-note-title"
            value={activeNote?.title || ''}
            onChange={(e) => setActiveNote(prev => ({ ...prev, title: e.target.value }))}
          />
          <textarea 
            placeholder="Escribe consultas SQL útiles, anotaciones de CAS, reclamos pendientes o código de error..." 
            className="notebook-note-textarea"
            value={activeNote?.content || ''}
            onChange={(e) => setActiveNote(prev => ({ ...prev, content: e.target.value }))}
          />
          <div className="notebook-editor-actions">
            {activeNote?.id && (
              <button className="notebook-btn" onClick={onNewNote}>Nueva</button>
            )}
            {activeNote?.content && (
              <button className="notebook-btn" onClick={() => onSendToChat(activeNote.content)}>Cargar en Chat</button>
            )}
            <button className="notebook-btn primary" onClick={onSaveNote}>Guardar</button>
          </div>
        </div>

        {/* List of Saved Notes */}
        <div className="sidebar-section">
          <span className="sidebar-section-title">Notas Guardadas</span>
          <div className="notebook-notes-list">
            {notes.length === 0 ? (
              <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Aún no tienes notas guardadas. Usa este espacio para guardar borradores o filtros SQL.
              </div>
            ) : (
              notes.map(n => (
                <div 
                  key={n.id} 
                  className={`notebook-note-item ${activeNote?.id === n.id ? 'active' : ''}`}
                  onClick={() => setActiveNote(n)}
                >
                  <div className="notebook-note-item-header">
                    <span className="notebook-note-item-title">{n.title}</span>
                    <button 
                      className="notebook-note-item-delete" 
                      onClick={(e) => onDeleteNote(n.id, e)} 
                      title="Eliminar nota"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  <div className="notebook-note-item-preview">{n.content}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
