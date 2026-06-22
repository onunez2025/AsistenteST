import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Sun, Moon, User, Paperclip, File, Download, Search, Mic, Trash2, ArrowLeft, Square, ArrowUp, ArrowDown } from 'lucide-react';
import { BotSparkleIcon } from './icons';
import { parseMarkdown } from '../utils/markdown';
import SuggestionChips from './SuggestionChips';
import MessageActions from './MessageActions';

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
  handleSendMessage, handleRegenerate, handleFileSelect,
  isFileUploading, fileInputRef, messagesEndRef,
  handleExportPNG, getFullUrl,
  chats, activeChatId, setActiveChatId, handleDeleteChat, formatDateTime
}) {
  const [isListening, setIsListening] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const textareaRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 150);
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

  // Saludo dinámico según hora del día
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };
  const firstName = user?.full_name?.split(' ')[0] || user?.username || '';

  // Renderizado de mensajes con gráficos y Excel
  const renderMessageContent = (content, index) => {
    const chartMatch = /\[EmbedChart:([^\]]+)\]/i.exec(content)
      || /\[[^\]]+\]\((https:\/\/[^)]+\.html)\)/i.exec(content);
    const excelMatch = /\[Descargar Reporte Excel\]\(([^)]+)\)/i.exec(content)
      || /\[[^\]]+\]\((https:\/\/[^)]+\.xlsx)\)/i.exec(content);
    const pdfMatch = /\[EmbedPDF:([^\]]+)\]/i.exec(content);

    const chartUrl = chartMatch?.[1] || null;
    const excelUrl = excelMatch?.[1] || null;
    const pdfUrl   = pdfMatch?.[1] || null;
    const pdfName  = pdfUrl ? (pdfUrl.split('/').pop() || 'informe_tecnico.pdf') : null;

    let clean = content;
    if (chartUrl) clean = clean.replace(/\[EmbedChart:[^\]]+\]/gi, '').replace(/\[[^\]]+\]\(https:\/\/[^)]+\.html\)/gi, '');
    if (excelUrl) clean = clean.replace(/\[Descargar Reporte Excel\]\([^)]+\)/gi, '').replace(/\[[^\]]+\]\(https:\/\/[^)]+\.xlsx\)/gi, '');
    if (pdfUrl)   clean = clean.replace(/\[EmbedPDF:[^\]]+\]/gi, '');

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

        {pdfUrl && (
          <div className="pdf-container-wrapper">
            <div className="chart-header-actions">
              <span className="chart-indicator">📄 Informe Técnico</span>
              <div className="chart-action-buttons">
                <a href={getFullUrl(pdfUrl)} target="_blank" rel="noopener noreferrer" className="chart-action-btn">Abrir ↗</a>
                <a href={getFullUrl(pdfUrl)} download={pdfName} className="chart-action-btn">Descargar 💾</a>
              </div>
            </div>
            <div className="pdf-iframe-container">
              <iframe src={getFullUrl(pdfUrl)} title="Informe Técnico" className="pdf-iframe" />
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
      <div className="message-container message-ai">
        <div className="message-ai-inner">
          <div className="message-ai-avatar">
            <BotSparkleIcon />
          </div>
          <div className="message-ai-body">
            <div className="message-ai-name">SIATC.IA</div>
            <div className="message-ai-text">
              {streamingContent
                ? <span dangerouslySetInnerHTML={{ __html: parseMarkdown(streamingContent) }} />
                : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pensando...</span>
              }
              <span className="streaming-cursor" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Input box (se reutiliza en home y en chat activo)
  const renderInputBar = (isCentered = false) => (
    <div className="input-wrapper">
      <div className="input-bar-container">
        {/* Tool progress indicator — shown when loading */}
        {isLoading && progressLabel && (
          <div className="tool-progress-bar">
            <div className="tool-spinner" />
            <span>{progressLabel}</span>
          </div>
        )}

        {/* File attachment preview */}
        {fileAttachment && (
          <div className="file-preview">
            <File size={14} />
            <span className="file-preview-name">{fileAttachment.name}</span>
            <button
              className="file-preview-remove"
              onClick={() => setFileAttachment(null)}
              title="Quitar archivo"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main input bar */}
        <div className="input-bar">
          <button
            className="input-icon-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Adjuntar archivo"
            disabled={isLoading && !streamingContent}
          >
            <Paperclip size={18} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            accept=".pdf,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.webp"
          />

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => { setInputText(e.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyPress}
            placeholder="Consulta sobre servicios, NPS, técnicos..."
            rows={1}
            disabled={isLoading && !streamingContent}
          />

          <div className="input-bar-actions">
            <button
              className={`input-icon-btn${isListening ? ' listening' : ''}`}
              onClick={handleVoiceInput}
              title={isListening ? 'Detener dictado' : 'Dictado por voz'}
            >
              <Mic size={18} />
            </button>

            {isLoading ? (
              <button className="send-btn stop" onClick={onStopGeneration} title="Detener generación">
                <Square size={16} />
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() && !fileAttachment}
                title="Enviar"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="input-footer-text">
          SIATC.IA puede cometer errores. Verifica información importante.
        </div>
      </div>
    </div>
  );

  // Render de la lista de mensajes del chat activo
  const renderMessages = () => {
    const lastAiIndex = (activeMessages || []).reduce((last, m, i) =>
      m.role === 'assistant' ? i : last, -1);

    return (
      <>
        {activeMessages.map((msg, index) => {
          if (msg.role === 'assistant') {
            return (
              <div key={index} className="message-container message-ai">
                <div className="message-ai-inner">
                  <div className="message-ai-avatar"><BotSparkleIcon /></div>
                  <div className="message-ai-body">
                    <div className="message-ai-name">SIATC.IA</div>
                    <div className="message-ai-text">
                      {renderMessageContent(msg.content, index)}
                    </div>
                    <MessageActions
                      messageContent={msg.content || ''}
                      onRegenerate={handleRegenerate}
                      isLastAiMessage={index === lastAiIndex}
                    />
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div key={index} className="message-container message-user">
              <div className="message-bubble">
                <div>{msg.content}</div>
                {msg.attachment && (
                  <div className="chat-message-attachment">
                    {msg.attachment.type?.startsWith('image/') ? (
                      <img src={msg.attachment.url || `data:${msg.attachment.type};base64,${msg.attachment.data}`} alt="adjunto" style={{ maxWidth: '240px', borderRadius: '8px', marginTop: '8px' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <File size={16} />
                        <a href={msg.attachment.url} download={msg.attachment.name} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                          {msg.attachment.name}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {renderStreamingBubble()}
        <div ref={messagesEndRef} />
      </>
    );
  };

  return (
    <div className="main-content">
      {/* Topbar */}
      <div className="topbar">
        {!isSidebarOpen && (
          <button className="topbar-menu-btn" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={20} />
          </button>
        )}
        <span className="topbar-title">
          {activeMessages && activeMessages.length > 0
            ? (chats?.find(c => c.id === activeChatId)?.title || 'SIATC.IA')
            : ''}
        </span>
        <div className="topbar-actions">
          <button className="topbar-icon-btn" onClick={toggleTheme} title="Cambiar tema">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
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
        /* Home screen o Chat screen */
        (!activeMessages || activeMessages.length === 0) && !isLoading ? (
          <div className="home-screen">
            <h1 className="home-greeting">{getGreeting()}, {firstName}</h1>
            <p className="home-subtitle">¿Cómo puedo ayudarte hoy?</p>
            <SuggestionChips onSelect={(text) => setInputText(text)} />
            <div className="welcome-input-wrapper">{renderInputBar(true)}</div>
          </div>
        ) : (
          <div className="chat-screen">
            <div className="messages-container" ref={scrollContainerRef} onScroll={handleScroll}>
              {renderMessages()}
            </div>
            {showScrollBtn && (
              <button
                className="scroll-to-bottom"
                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                <ArrowDown size={14} /> Bajar
              </button>
            )}
            <div className="input-container-fixed">
              <div className="input-max-width-wrapper">
                {renderInputBar(false)}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default ChatArea;
