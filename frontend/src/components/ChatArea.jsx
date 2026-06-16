import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Sun, Moon, User, Paperclip, Send, File, Download, Search, Mic, Plus, Trash2, ArrowLeft, Bot, Square } from 'lucide-react';
import { BotSparkleIcon } from './icons';
import { parseMarkdown } from '../utils/markdown';

function ChatArea({
  isSidebarOpen, setIsSidebarOpen,
  activeView, setActiveView,
  theme, toggleTheme,
  user, username, handleLogout,
  activeMessages,
  isLoading,
  streamingContent,
  progressLabel,
  onStopGeneration,
  inputText, setInputText,
  fileAttachment, setFileAttachment,
  handleSendMessage, handleFileSelect,
  isFileUploading, fileInputRef, messagesEndRef,
  handleExportPNG, getFullUrl,
  chats, setActiveChatId, handleDeleteChat, formatDateTime
}) {
  const [isListening, setIsListening] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize del textarea: crece con el contenido y se resetea al limpiar
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  // Resetear altura cuando el inputText se vacía (después de enviar)
  useEffect(() => {
    if (!inputText && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    } else {
      resizeTextarea();
    }
  }, [inputText, resizeTextarea]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  // Dictado de voz
  const handleVoiceInput = (e) => {
    e.stopPropagation();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("El reconocimiento de voz no está disponible. Usa Chrome o Edge."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-PE'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    if (isListening) { recognition.stop(); setIsListening(false); return; }
    setIsListening(true); recognition.start();
    recognition.onresult = (event) => { setInputText(prev => prev + (prev ? ' ' : '') + event.results[0][0].transcript); setIsListening(false); };
    recognition.onerror = () => setIsListening(false);
    recognition.onend   = () => setIsListening(false);
  };

  // Agrupación de chats por fecha para la vista de búsqueda
  const groupChatsByDate = (list) => {
    const groups = { 'Hoy': [], 'Ayer': [], 'Esta semana': [], 'Antes': [] };
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    list.forEach(c => {
      const t = new Date(c.createdAt || Date.now()).getTime();
      if (t >= today)              groups['Hoy'].push(c);
      else if (t >= today - 86400000) groups['Ayer'].push(c);
      else if (t >= today - 7*86400000) groups['Esta semana'].push(c);
      else                         groups['Antes'].push(c);
    });
    return groups;
  };

  const filteredChats = chats.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const searchGroups = groupChatsByDate(filteredChats);

  // Renderizado de mensajes con gráficos y Excel
  const renderMessageContent = (content, index) => {
    const chartMatch = /\[EmbedChart:([^\]]+)\]/i.exec(content)
      || /\[[^\]]+\]\((https:\/\/[^)]+\.html)\)/i.exec(content);
    const excelMatch = /\[Descargar Reporte Excel\]\(([^)]+)\)/i.exec(content)
      || /\[[^\]]+\]\((https:\/\/[^)]+\.xlsx)\)/i.exec(content);

    const chartUrl = chartMatch?.[1] || null;
    const excelUrl = excelMatch?.[1] || null;

    let clean = content;
    if (chartUrl) clean = clean.replace(/\[EmbedChart:[^\]]+\]/gi, '').replace(/\[[^\]]+\]\(https:\/\/[^)]+\.html\)/gi, '');
    if (excelUrl) clean = clean.replace(/\[Descargar Reporte Excel\]\([^)]+\)/gi, '').replace(/\[[^\]]+\]\(https:\/\/[^)]+\.xlsx\)/gi, '');

    return (
      <div className="message-body">
        <div dangerouslySetInnerHTML={{ __html: parseMarkdown(clean.trim(), getFullUrl) }} />

        {excelUrl && (
          <div className="download-card">
            <div className="download-icon"><Download size={20} /></div>
            <div className="download-info">
              <div className="download-title">Reporte Excel Generado</div>
              <div className="download-size">Microsoft Excel (.xlsx)</div>
            </div>
            <a href={getFullUrl(excelUrl)} target="_blank" rel="noopener noreferrer" className="download-link-btn">Descargar</a>
          </div>
        )}

        {chartUrl && (
          <div className="chart-container-wrapper">
            <div className="chart-header-actions">
              <span className="chart-indicator">📊 Gráfico Interactivo</span>
              <div className="chart-action-buttons">
                <a href={getFullUrl(chartUrl)} target="_blank" rel="noopener noreferrer" className="chart-action-btn">Abrir ↗</a>
                <button onClick={() => handleExportPNG(`chart-iframe-${index}`)} className="chart-action-btn">PNG 🖼️</button>
                <a href={getFullUrl(chartUrl)} download={`grafico_st_${index}.html`} className="chart-action-btn">Guardar 💾</a>
              </div>
            </div>
            <div className="chart-iframe-container">
              <iframe id={`chart-iframe-${index}`} src={getFullUrl(chartUrl)} title="Gráfico ST" className="chart-iframe" />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Burbuja de streaming (respuesta en construcción)
  const renderStreamingBubble = () => {
    if (!isLoading) return null;

    return (
      <div className="message assistant">
        <div className="avatar"><BotSparkleIcon /></div>
        <div className="message-content">
          {streamingContent ? (
            // Texto llegando en tiempo real
            <div className="message-body streaming-message">
              <div dangerouslySetInnerHTML={{ __html: parseMarkdown(streamingContent, getFullUrl) }} />
              <span className="streaming-cursor" />
            </div>
          ) : (
            // Indicador de progreso antes de que lleguen los primeros tokens
            <div className="typing-container">
              <div className="typing-dots">
                <div className="dot" /><div className="dot" /><div className="dot" />
              </div>
              {progressLabel && (
                <span className="typing-text">{progressLabel}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Input box (se reutiliza en welcome y en chat activo)
  const renderInputBox = (isCentered = false) => (
    <div className={`input-box-wrapper ${isCentered ? 'centered-input' : ''}`}>
      {fileAttachment && (
        <div className="attachment-preview-container">
          <div className="attachment-preview-card">
            {fileAttachment.preview
              ? <img src={fileAttachment.preview} alt="preview" className="attachment-preview-img" />
              : <div className="attachment-preview-icon"><File size={20} /></div>
            }
            <span className="attachment-preview-name">{fileAttachment.name}</span>
            <button className="attachment-preview-remove" onClick={() => setFileAttachment(null)}>✕</button>
          </div>
        </div>
      )}

      <div className="input-row-main">
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />

        <button
          className="input-action-btn attach-btn"
          onClick={() => fileInputRef.current.click()}
          title="Adjuntar archivo (.pdf, .xlsx, .csv, imágenes)"
          disabled={isFileUploading || isLoading}
        >
          <Plus size={20} />
        </button>

        <textarea
          ref={textareaRef}
          placeholder={isCentered ? "Pregúntale a SIATC.IA sobre servicios, técnicos, flota, pagos..." : "Introduce una pregunta aquí..."}
          className="chat-textarea"
          rows="1"
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); resizeTextarea(); }}
          onKeyDown={handleKeyPress}
          disabled={isLoading}
        />

        <div className="input-actions-group">
          {/* Badge del modelo — oculto en móvil via clase */}
          <span className="model-select-badge desktop-only" title="Modelo LLM activo">
            <Bot size={13} />
            <span>DeepSeek</span>
          </span>

          {/* Micrófono — solo en desktop; en móvil ocupa espacio innecesario */}
          <button
            className={`input-action-btn mic-btn desktop-only ${isListening ? 'listening' : ''}`}
            onClick={handleVoiceInput}
            title="Dictar por voz"
            type="button"
            disabled={isLoading}
          >
            <Mic size={18} />
          </button>

          {/* Stop o Enviar */}
          {isLoading ? (
            <button
              className="input-action-btn stop-btn"
              onClick={onStopGeneration}
              title="Detener generación"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              className={`input-action-btn send-btn ${(inputText.trim() || fileAttachment) ? 'active' : ''}`}
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() && !fileAttachment}
              title="Enviar mensaje (Enter)"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="chat-area">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          {!isSidebarOpen && (
            <button className="header-action-btn" onClick={() => setIsSidebarOpen(true)} title="Abrir menú"><Menu size={20} /></button>
          )}
          {activeView === 'search' && (
            <button className="header-action-btn" onClick={() => setActiveView('chat')} title="Volver al chat"><ArrowLeft size={20} /></button>
          )}
          <div className="chat-title-container">
            <span className="chat-title">SIATC.IA — Asistente de Gestión</span>
            <span className="chat-subtitle">Grupo SOLE / Rinnai</span>
          </div>
        </div>
        <div className="chat-header-right">
          {/* Indicador de progreso en el header cuando está procesando */}
          {isLoading && progressLabel && !streamingContent && (
            <span className="header-progress-label">{progressLabel}</span>
          )}
          <button className="header-action-btn" onClick={toggleTheme} title="Cambiar tema">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="header-user-badge">
            <div className="user-avatar-small">{(user?.full_name || 'U')[0].toUpperCase()}</div>
            <span className="user-name-text">{user?.full_name?.split(' ')[0] || username}</span>
          </div>
        </div>
      </div>

      {/* Vista de búsqueda */}
      {activeView === 'search' ? (
        <div className="search-workspace-container">
          <div className="search-workspace-header">
            <h1 className="search-title">Buscar en los chats</h1>
            <div className="search-input-capsule">
              <Search size={20} className="search-icon-inside" />
              <input
                type="text" placeholder="Escribe palabras clave, técnicos o tickets..."
                className="search-box" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} autoFocus
              />
            </div>
          </div>
          <div className="search-results-scroller">
            {Object.keys(searchGroups).map(group => {
              const items = searchGroups[group];
              if (!items.length) return null;
              return (
                <div key={group} className="search-group-section">
                  <h3 className="search-group-title">{group}</h3>
                  <div className="search-results-list">
                    {items.map(c => (
                      <div key={c.id} className="search-result-card"
                        onClick={() => { setActiveChatId(c.id); setActiveView('chat'); }}>
                        <div className="result-card-info">
                          <strong className="result-title">{c.title}</strong>
                          <span className="result-date">📅 {formatDateTime(c.createdAt)}</span>
                        </div>
                        <button className="result-delete-btn" onClick={(e) => handleDeleteChat(c.id, e)}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {!filteredChats.length && (
              <div className="empty-search-state"><span>No se encontraron chats.</span></div>
            )}
          </div>
        </div>
      ) : (
        /* Vista de chat */
        <>
          {activeMessages.length <= 1 ? (
            /* Pantalla de bienvenida */
            <div className="welcome-container">
              <div className="welcome-greetings">
                <h1 className="gemini-welcome-title">El escenario es tuyo, {user?.full_name?.split(' ')[0] || 'equipo'}</h1>
                <h2 className="gemini-welcome-subtitle">¿En qué puedo ayudarte hoy en la gestión técnica y postventa?</h2>
              </div>
              <div className="welcome-input-wrapper">{renderInputBox(true)}</div>
              <div className="welcome-cards-grid">
                <div className="welcome-card" onClick={() => handleSendMessage('¿Cuántos servicios se completaron esta semana?')}>
                  <span className="welcome-card-text">Ver volumen de servicios completados esta semana</span>
                  <span className="welcome-card-icon">⚡</span>
                </div>
                <div className="welcome-card" onClick={() => handleSendMessage('¿Qué técnico cerró más servicios este mes?')}>
                  <span className="welcome-card-text">Ranking de técnicos con más servicios cerrados este mes</span>
                  <span className="welcome-card-icon">🏆</span>
                </div>
                <div className="welcome-card" onClick={() => handleSendMessage('¿Cuáles son las 5 fallas más reportadas este mes?')}>
                  <span className="welcome-card-text">Fallas y motivos de no atención más frecuentes</span>
                  <span className="welcome-card-icon">🛠️</span>
                </div>
                <div className="welcome-card" onClick={() => handleSendMessage('Genera un reporte Excel de servicios de este mes')}>
                  <span className="welcome-card-text">Exportar reporte Excel de servicios del mes</span>
                  <span className="welcome-card-icon">📊</span>
                </div>
                <div className="welcome-card" onClick={() => handleSendMessage('¿Qué materiales se usaron más en servicios de reparación este mes?')}>
                  <span className="welcome-card-text">Materiales y repuestos más utilizados en reparaciones</span>
                  <span className="welcome-card-icon">🔧</span>
                </div>
                <div className="welcome-card" onClick={() => handleSendMessage('¿Cuántos vehículos de la flota están activos y cuáles tienen mantenimiento pendiente?')}>
                  <span className="welcome-card-text">Estado de la flota vehicular y mantenimientos pendientes</span>
                  <span className="welcome-card-icon">🚗</span>
                </div>
              </div>
            </div>
          ) : (
            /* Chat activo */
            <>
              <div className="messages-container">
                {activeMessages.map((msg, index) => (
                  <div key={index} className={`message ${msg.role}`}>
                    <div className="avatar">
                      {msg.role === 'assistant' ? <BotSparkleIcon /> : <User size={20} />}
                    </div>
                    <div className="message-content">
                      {msg.role === 'assistant' ? (
                        renderMessageContent(msg.content, index)
                      ) : (
                        <div className="message-content-inner">
                          <div>{msg.content}</div>
                          {msg.attachment && (
                            <div className="chat-message-attachment">
                              {msg.attachment.type?.startsWith('image/') ? (
                                <img src={msg.attachment.url || `data:${msg.attachment.type};base64,${msg.attachment.data}`} alt="adjunto" />
                              ) : (
                                <div className="chat-message-attachment-icon"><File size={24} /></div>
                              )}
                              <div className="chat-message-attachment-info">
                                <div className="chat-message-attachment-name">
                                  <a href={msg.attachment.url} download={msg.attachment.name} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                    {msg.attachment.name}
                                  </a>
                                </div>
                                <div className="chat-message-attachment-size">{msg.attachment.type}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Burbuja de streaming / progreso */}
                {renderStreamingBubble()}

                <div ref={messagesEndRef} />
              </div>

              {/* Input fijo abajo */}
              <div className="input-container-fixed">
                <div className="input-max-width-wrapper">
                  {renderInputBox(false)}
                  <div className="disclaimer-text">
                    SIATC.IA puede cometer errores. Corrobora información crítica con SAP C4C.
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default ChatArea;
