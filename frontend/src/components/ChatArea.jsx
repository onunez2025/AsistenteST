import React from 'react';
import { Menu, BookOpen, Sun, Moon, User, Paperclip, Send, File, Download, Sparkles } from 'lucide-react';
import { BotSparkleIcon } from './icons';
import { parseMarkdown } from '../utils/markdown';

function ChatArea({
  isSidebarOpen,
  setIsSidebarOpen,
  isNotebookOpen,
  setIsNotebookOpen,
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
  getFullUrl
}) {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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

  return (
    <div className="chat-area">
      {/* Header toolbar */}
      <div className="chat-header">
        <div className="chat-header-left">
          {!isSidebarOpen && (
            <button className="header-action-btn" onClick={() => setIsSidebarOpen(true)} title="Abrir menú">
              <Menu size={20} />
            </button>
          )}
          <div className="chat-title-container">
            <span className="chat-title">Panel de Control Inteligente - SIATC.IA</span>
            <span className="chat-subtitle">Servicios y Postventa - Grupo SOLE / Rinnai</span>
          </div>
        </div>

        <div className="chat-header-right">
          <button 
            className={`header-action-btn ${isNotebookOpen ? 'active' : ''}`} 
            onClick={() => setIsNotebookOpen(!isNotebookOpen)} 
            title="Cuaderno / Bloc de Notas"
            style={{ color: isNotebookOpen ? 'var(--accent-indigo)' : 'inherit' }}
          >
            <BookOpen size={20} />
          </button>
          
          <button className="header-action-btn" onClick={toggleTheme} title="Cambiar tema">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <div className="header-user-profile">
            <User size={18} />
            <div className="user-name-badge" title={user?.full_name || username}>
              {user?.full_name || username}
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* Messaging Area or Welcome Screen */}
      {activeMessages.length <= 1 ? (
        <div className="welcome-container">
          <div>
            <h1 className="gemini-welcome-title">Hola, {user?.full_name?.split(' ')[0] || 'Óscar'}</h1>
            <h2 className="gemini-welcome-subtitle">¿En qué puedo ayudarte hoy en la atención al cliente y postventa?</h2>
          </div>
          
          <div className="welcome-cards-grid">
            <div className="welcome-card" onClick={() => handleSendMessage('¿Cuántos servicios se completaron la semana pasada?')}>
              <span className="welcome-card-text">Verificar volumen de servicios completados en la última semana.</span>
              <span className="welcome-card-icon">⚡</span>
            </div>
            <div className="welcome-card" onClick={() => handleSendMessage('¿Cuáles son las 3 fallas o motivos más recurrentes que informan los técnicos?')}>
              <span className="welcome-card-text">Identificar los motivos de no atención o fallas más reportadas.</span>
              <span className="welcome-card-icon">🛠️</span>
            </div>
            <div className="welcome-card" onClick={() => handleSendMessage('Descarga un Excel de servicios con reclamos o NPS menor a 7')}>
              <span className="welcome-card-text">Crear reporte de servicios críticos con NPS bajo para control de calidad.</span>
              <span className="welcome-card-icon">📊</span>
            </div>
            <div className="welcome-card" onClick={() => handleSendMessage('Verifica en tiempo real el estado del ticket C4C')}>
              <span className="welcome-card-text">Ingresar un ID de ticket de SAP para consultar su estado real en OData.</span>
              <span className="welcome-card-icon">🔍</span>
            </div>
          </div>
        </div>
      ) : (
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
      )}

      {/* Input box bar (Floating bottom) */}
      <div className="input-container-fixed">
        <div className="input-max-width-wrapper">
          <div className="input-box-wrapper">
            
            {/* Attachment Previews in Input Box */}
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

            {/* Text Input Row */}
            <div className="input-row-main">
              {/* Hidden File Input */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                style={{ display: 'none' }}
              />
              
              <button 
                className="input-action-btn" 
                onClick={() => fileInputRef.current.click()} 
                title="Adjuntar archivo o imagen (.pdf, .xlsx, .csv, imágenes)"
                disabled={isFileUploading}
              >
                <Paperclip size={20} />
              </button>
              
              <textarea
                placeholder="Introduce una pregunta para SIATC.IA (ej. ¿Cuántos tickets se cerraron ayer?)..."
                className="chat-textarea"
                rows="1"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
              />
              
              <div className="input-actions">
                <button 
                  className={`input-action-btn send ${(inputText.trim() || fileAttachment) ? 'active' : ''}`}
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || (!inputText.trim() && !fileAttachment)}
                  title="Enviar mensaje"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
          <div className="disclaimer-text">
            SIATC.IA puede cometer errores. Por favor corrobora la información crítica con SAP C4C.
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatArea;
