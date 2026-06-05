import React from 'react';
import { Menu, Sun, Moon, ArrowLeft, BookOpen, Save, Trash2, Send, Plus } from 'lucide-react';

export default function Notebook({
  activeNote,
  notes,
  isNotebookOpen,
  onSaveNote,
  onDeleteNote,
  onNewNote,
  onSendToChat,
  setActiveNote,
  setIsNotebookOpen,
  isSidebarOpen,
  setIsSidebarOpen,
  toggleTheme,
  theme,
  user,
  handleLogout
}) {
  return (
    <div className="notebook-workspace-container">
      {/* Header bar matching ChatArea */}
      <div className="chat-header">
        <div className="chat-header-left">
          {!isSidebarOpen && (
            <button className="header-action-btn" onClick={() => setIsSidebarOpen(true)} title="Abrir menú">
              <Menu size={20} />
            </button>
          )}
          <button className="header-action-btn" onClick={() => setIsNotebookOpen(false)} title="Volver al chat">
            <ArrowLeft size={20} />
          </button>
          <div className="chat-title-container">
            <span className="chat-title">SIATC.IA - Cuaderno de Trabajo</span>
            <span className="chat-subtitle">Notas de Contexto y Gestión</span>
          </div>
        </div>

        <div className="chat-header-right">
          <button className="header-action-btn" onClick={toggleTheme} title="Cambiar tema">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <div className="header-user-badge">
            <div className="user-avatar-small">
              {(user?.full_name || 'U')[0].toUpperCase()}
            </div>
            <span className="user-name-text">{user?.full_name?.split(' ')[0] || 'Usuario'}</span>
          </div>
        </div>
      </div>

      {/* Main editor area */}
      <div className="notebook-editor-workspace">
        <div className="notebook-editor-max-wrapper">
          <div className="notebook-center-icon-container">
            <div className="notebook-doc-icon">
              <BookOpen size={48} />
            </div>
          </div>

          <div className="notebook-title-section">
            <input 
              type="text" 
              placeholder="Asigna un nombre a tu cuaderno..." 
              className="notebook-title-input"
              value={activeNote?.title || ''}
              onChange={(e) => setActiveNote(prev => ({ ...prev, title: e.target.value }))}
            />
            <h2 className="notebook-subtitle-display">
              {activeNote?.title ? activeNote.title : 'Nuevo cuaderno'}
            </h2>
          </div>

          {/* Gemini Instruction Card Info */}
          <div className="notebook-instruction-card">
            <span className="info-icon">💡</span>
            <span className="info-text">
              Los cuadernos organizan tu trabajo y tus ideas. Puedes agregar contexto y decirle a DeepSeek cómo ayudarte en las consultas.
            </span>
          </div>

          {/* Context Editor Textarea */}
          <div className="notebook-editor-textarea-wrapper">
            <textarea 
              placeholder="Escribe aquí el contexto de trabajo, instrucciones del sistema, anotaciones del CAS, reclamos del cliente o consultas SQL recurrentes..." 
              className="notebook-textarea-body"
              value={activeNote?.content || ''}
              onChange={(e) => setActiveNote(prev => ({ ...prev, content: e.target.value }))}
            />
          </div>

          {/* Bottom Actions Bar */}
          <div className="notebook-actions-row">
            {activeNote?.id && (
              <button className="notebook-action-btn delete" onClick={(e) => onDeleteNote(activeNote.id, e)} title="Eliminar cuaderno">
                <Trash2 size={16} />
                <span>Eliminar</span>
              </button>
            )}
            <div className="notebook-actions-right">
              {activeNote?.id && (
                <button className="notebook-action-btn secondary" onClick={onNewNote}>
                  <Plus size={16} />
                  <span>Nuevo</span>
                </button>
              )}
              {activeNote?.content && (
                <button className="notebook-action-btn secondary" onClick={() => onSendToChat(activeNote.content)} title="Enviar al chat">
                  <Send size={16} />
                  <span>Cargar en Chat</span>
                </button>
              )}
              <button className="notebook-action-btn primary" onClick={onSaveNote}>
                <Save size={16} />
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
