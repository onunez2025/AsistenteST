import React, { useState, useEffect } from 'react';
import { Menu, Sun, Moon, User, Paperclip, Send, File, Download, Search, Mic, Plus, Trash2, ArrowLeft, Bot, RefreshCw } from 'lucide-react';
import { BotSparkleIcon } from './icons';
import { parseMarkdown } from '../utils/markdown';

function ChatArea({
  isSidebarOpen,
  setIsSidebarOpen,
  activeView,
  setActiveView,
  theme,
  toggleTheme,
  user,
  username,
  handleLogout,
  activeMessages,
  isLoading,
  inputText,
  setInputText,
  fileAttachment,
  setFileAttachment,
  handleSendMessage,
  handleFileSelect,
  isFileUploading,
  fileInputRef,
  messagesEndRef,
  handleExportPNG,
  getFullUrl,
  chats,
  setActiveChatId,
  handleDeleteChat,
  formatDateTime
}) {
  const [isListening, setIsListening] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModelMenu, setShowModelMenu] = useState(false);

  // Close menus on click outside
  useEffect(() => {
    const closeMenu = () => setShowModelMenu(false);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Web Speech API Voice Dictation
  const handleVoiceInput = (e) => {
    e.stopPropagation();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("El reconocimiento de voz no está soportado en tu navegador actual. Por favor usa Google Chrome o Microsoft Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-PE';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }

    setIsListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setInputText(prev => prev + (prev ? ' ' : '') + text);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  };

  // Group chats chronologically for the Search view
  const groupChatsByDate = (chatsToGroup) => {
    const groups = {
      'Hoy': [],
      'Ayer': [],
      'Esta semana': [],
      'Hace más de una semana': []
    };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const sevenDaysAgoStart = todayStart - 7 * 24 * 60 * 60 * 1000;

    chatsToGroup.forEach(c => {
      const chatTime = new Date(c.createdAt || c.id.split('_')[1] * 1 || Date.now()).getTime();
      if (chatTime >= todayStart) {
        groups['Hoy'].push(c);
      } else if (chatTime >= yesterdayStart) {
        groups['Ayer'].push(c);
      } else if (chatTime >= sevenDaysAgoStart) {
        groups['Esta semana'].push(c);
      } else {
        groups['Hace más de una semana'].push(c);
      }
    });

    return groups;
  };

  const filteredSearchChats = chats.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const searchGroups = groupChatsByDate(filteredSearchChats);

  // Render text and media attachments in the chat flow
  const renderMessageContent = (content, index) => {
    const embedChartRegex = /\[EmbedChart:([^\]]+)\]/i;
    const mdChartRegex = /\[[^\]]+\]\((\/(?:static\/charts|generated\/charts)\/[^)]+\.html)\)/i;
    const azureChartRegex = /\((https:\/\/soleblob1.blob.core.windows.net\/stecnico\/generated\/charts\/[^)]+\.html)\)/i;
    
    const excelDownloadRegex = /\[Descargar Reporte Excel\]\(([^)]+)\)/i;
    const mdExcelRegex = /\[[^\]]+\]\((\/(?:static\/reports|generated\/reports)\/[^)]+\.xlsx)\)/i;
    const azureExcelRegex = /\((https:\/\/soleblob1.blob.core.windows.net\/stecnico\/generated\/reports\/[^)]+\.xlsx)\)/i;
    
    let chartUrl = null;
    let excelUrl = null;
    
    const matchChart = embedChartRegex.exec(content) || mdChartRegex.exec(content) || azureChartRegex.exec(content);
    if (matchChart) chartUrl = matchChart[1];
    
    const matchExcel = excelDownloadRegex.exec(content) || mdExcelRegex.exec(content) || azureExcelRegex.exec(content);
    if (matchExcel) excelUrl = matchExcel[1];
    
    let cleanedContent = content;
    if (chartUrl) {
      cleanedContent = cleanedContent
        .replace(/\[EmbedChart:[^\]]+\]/gi, '')
        .replace(/\[[^\]]+\]\(\/(?:static\/charts|generated\/charts)\/[^)]+\.html\)/gi, '')
        .replace(/\[[^\]]+\]\(https:\/\/soleblob1.blob.core.windows.net\/stecnico\/generated\/charts\/[^)]+\.html\)/gi, '');
    }
    if (excelUrl) {
      cleanedContent = cleanedContent
        .replace(/\[Descargar Reporte Excel\]\([^)]+\)/gi, '')
        .replace(/\[[^\]]+\]\(\/(?:static\/reports|generated\/reports)\/[^)]+\.xlsx\)/gi, '')
        .replace(/\[[^\]]+\]\(https:\/\/soleblob1.blob.core.windows.net\/stecnico\/generated\/reports\/[^)]+\.xlsx\)/gi, '');
    }
    
    const parsedHtml = parseMarkdown(cleanedContent.trim(), getFullUrl);
    
    return (
      <div className="message-body">
        <div dangerouslySetInnerHTML={{ __html: parsedHtml }} />
        
        {excelUrl && (
          <div className="download-card">
            <div className="download-icon">
              <Download size={20} />
            </div>
            <div className="download-info">
              <div className="download-title">Reporte Excel Generado</div>
              <div className="download-size">Formato: Microsoft Excel (.xlsx)</div>
            </div>
            <a 
              href={getFullUrl(excelUrl)} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="download-link-btn"
            >
              Descargar
            </a>
          </div>
        )}
        
        {chartUrl && (
          <div className="chart-container-wrapper">
            <div className="chart-header-actions">
              <span className="chart-indicator">📊 Gráfico Interactivo</span>
              <div className="chart-action-buttons">
                <a href={getFullUrl(chartUrl)} target="_blank" rel="noopener noreferrer" className="chart-action-btn">
                  Abrir ↗
                </a>
                <button onClick={() => handleExportPNG(`chart-iframe-${index}`)} className="chart-action-btn">
                  PNG 🖼️
                </button>
                <a href={getFullUrl(chartUrl)} download={`grafico_st_${index}.html`} className="chart-action-btn">
                  Guardar 💾
                </a>
              </div>
            </div>
            <div className="chart-iframe-container">
              <iframe 
                id={`chart-iframe-${index}`}
                src={getFullUrl(chartUrl)} 
                title="Gráfico de Servicio Técnico" 
                className="chart-iframe"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Reusable Input Box Capsule Component
  const renderInputBox = (isCentered = false) => {
    return (
      <div className={`input-box-wrapper ${isCentered ? 'centered-input' : ''}`}>
        {/* Attachment Previews */}
        {fileAttachment && (
          <div className="attachment-preview-container">
            <div className="attachment-preview-card">
              {fileAttachment.preview ? (
                <img src={fileAttachment.preview} alt="preview" className="attachment-preview-img" />
              ) : (
                <div className="attachment-preview-icon"><File size={20} /></div>
              )}
              <span className="attachment-preview-name">{fileAttachment.name}</span>
              <button className="attachment-preview-remove" onClick={() => setFileAttachment(null)}>✕</button>
            </div>
          </div>
        )}

        <div className="input-row-main">
          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            style={{ display: 'none' }}
          />
          
          <button 
            className="input-action-btn attach-btn" 
            onClick={() => fileInputRef.current.click()} 
            title="Adjuntar archivo o imagen (.pdf, .xlsx, .csv, imágenes)"
            disabled={isFileUploading}
          >
            <Plus size={20} />
          </button>
          
          <textarea
            placeholder={isCentered ? "Pregúntale a SIATC.IA..." : "Introduce una pregunta aquí..."}
            className="chat-textarea"
            rows="1"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
          />
          
          <div className="input-actions-group">
            {/* Model Selection Dropdown */}
            <div className="model-dropdown-container" onClick={(e) => e.stopPropagation()}>
              <button 
                className="model-select-badge"
                onClick={() => setShowModelMenu(!showModelMenu)}
                title="Modelo LLM de consulta"
              >
                <span>DeepSeek</span>
                <span className="model-caret">▾</span>
              </button>
              {showModelMenu && (
                <div className="model-menu-popup">
                  <div className="menu-item active">
                    <Bot size={14} />
                    <div>
                      <strong>DeepSeek-Chat</strong>
                      <span>Modelo de análisis y SQL</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Voice Input Mic Button */}
            <button 
              className={`input-action-btn mic-btn ${isListening ? 'listening' : ''}`}
              onClick={handleVoiceInput}
              title="Dictar por voz"
              type="button"
            >
              <Mic size={18} />
            </button>

            {/* Send Button */}
            <button 
              className={`input-action-btn send-btn ${(inputText.trim() || fileAttachment) ? 'active' : ''}`}
              onClick={() => handleSendMessage()}
              disabled={isLoading || (!inputText.trim() && !fileAttachment)}
              title="Enviar mensaje"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="chat-area">
      {/* Header bar */}
      <div className="chat-header">
        <div className="chat-header-left">
          {!isSidebarOpen && (
            <button className="header-action-btn" onClick={() => setIsSidebarOpen(true)} title="Abrir menú">
              <Menu size={20} />
            </button>
          )}
          {activeView === 'search' ? (
            <button className="header-action-btn" onClick={() => setActiveView('chat')} title="Volver al chat">
              <ArrowLeft size={20} />
            </button>
          ) : null}
          <div className="chat-title-container">
            <span className="chat-title">SIATC.IA - Asistente de Gestión</span>
            <span className="chat-subtitle">Grupo SOLE / Rinnai</span>
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
            <span className="user-name-text">{user?.full_name?.split(' ')[0] || username}</span>
          </div>
        </div>
      </div>

      {/* Main viewport switcher */}
      {activeView === 'search' ? (
        /* DEDICATED SEARCH VIEW */
        <div className="search-workspace-container">
          <div className="search-workspace-header">
            <h1 className="search-title">Buscar en los chats</h1>
            <div className="search-input-capsule">
              <Search size={20} className="search-icon-inside" />
              <input 
                type="text" 
                placeholder="Escribe palabras clave, técnicos o tickets..." 
                className="search-box"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="search-results-scroller">
            {Object.keys(searchGroups).map(groupName => {
              const groupChats = searchGroups[groupName];
              if (groupChats.length === 0) return null;
              
              return (
                <div key={groupName} className="search-group-section">
                  <h3 className="search-group-title">{groupName}</h3>
                  <div className="search-results-list">
                    {groupChats.map(c => (
                      <div 
                        key={c.id} 
                        className="search-result-card"
                        onClick={() => {
                          setActiveChatId(c.id);
                          setActiveView('chat');
                        }}
                      >
                        <div className="result-card-info">
                          <strong className="result-title">{c.title}</strong>
                          <span className="result-date">📅 {formatDateTime(c.createdAt || c.id)}</span>
                        </div>
                        <button 
                          className="result-delete-btn" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(c.id, e);
                          }}
                          title="Eliminar chat"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredSearchChats.length === 0 && (
              <div className="empty-search-state">
                <span>No se encontraron chats que coincidan con la búsqueda.</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* NORMAL CHAT VIEW */
        <>
          {activeMessages.length <= 1 ? (
            /* Welcome screen with centered input box */
            <div className="welcome-container">
              <div className="welcome-greetings">
                <h1 className="gemini-welcome-title">El escenario es tuyo, {user?.full_name?.split(' ')[0] || 'Óscar'}</h1>
                <h2 className="gemini-welcome-subtitle">¿En qué puedo ayudarte hoy en la gestión técnica y postventa?</h2>
              </div>
              
              {/* Centered Input Box Capsule */}
              <div className="welcome-input-wrapper">
                {renderInputBox(true)}
              </div>

              {/* Sugestion Quick Cards */}
              <div className="welcome-cards-grid">
                <div className="welcome-card" onClick={() => handleSendMessage('¿Cuántos servicios se completaron la semana pasada?')}>
                  <span className="welcome-card-text">Verificar volumen de servicios completados la última semana</span>
                  <span className="welcome-card-icon">⚡</span>
                </div>
                <div className="welcome-card" onClick={() => handleSendMessage('¿Cuáles son las 3 fallas o motivos más recurrentes que informan los técnicos?')}>
                  <span className="welcome-card-text">Identificar los motivos de no atención o fallas más reportadas</span>
                  <span className="welcome-card-icon">🛠️</span>
                </div>
                <div className="welcome-card" onClick={() => handleSendMessage('Descarga un Excel de servicios con reclamos o NPS menor a 7')}>
                  <span className="welcome-card-text">Crear reporte de servicios críticos con NPS bajo para control de calidad</span>
                  <span className="welcome-card-icon">📊</span>
                </div>
                <div className="welcome-card" onClick={() => handleSendMessage('Verifica en tiempo real el estado del ticket C4C')}>
                  <span className="welcome-card-text">Ingresar un ID de ticket de SAP para consultar su estado en OData</span>
                  <span className="welcome-card-icon">🔍</span>
                </div>
              </div>
            </div>
          ) : (
            /* Active message log viewport */
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
                              {msg.attachment.type.startsWith('image/') ? (
                                <img src={msg.attachment.url || `data:${msg.attachment.type};base64,${msg.attachment.data}`} alt="attachment" />
                              ) : (
                                <div className="chat-message-attachment-icon"><File size={24} /></div>
                              )}
                              <div className="chat-message-attachment-info">
                                <div className="chat-message-attachment-name">
                                  <a 
                                    href={msg.attachment.url || `data:${msg.attachment.type};base64,${msg.attachment.data}`} 
                                    download={msg.attachment.name}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'inherit', textDecoration: 'none' }}
                                  >
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
                
                {isLoading && (
                  <div className="message assistant">
                    <div className="avatar">
                      <BotSparkleIcon />
                    </div>
                    <div className="typing-container">
                      <div className="typing-dots">
                        <div className="dot"></div>
                        <div className="dot"></div>
                        <div className="dot"></div>
                      </div>
                      <span className="typing-text">Consultando base de datos y analizando información...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Floating Bottom Input Capsule (only visible when chat has messages) */}
              <div className="input-container-fixed">
                <div className="input-max-width-wrapper">
                  {renderInputBox(false)}
                  <div className="disclaimer-text">
                    SIATC.IA v2.0 puede cometer errores. Por favor corrobora la información crítica con SAP C4C.
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
