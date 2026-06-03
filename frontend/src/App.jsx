import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// SVG Icons directly embedded to avoid dependency issues during build
const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"></line><line x1="4" x2="20" y1="6" y2="6"></line><line x1="4" x2="20" y1="18" y2="18"></line></svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>
);

const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="10" x="3" y="11" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" x2="8" y1="16" y2="16"></line><line x1="16" x2="16" y1="16" y2="16"></line></svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);

// Base URL for API
// Direct to backend (assuming backend runs on same host or port 8000)
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

// Simple Markdown parser utility to support basic formatting: tables, lists, links, bold
const parseMarkdown = (text) => {
  if (!text) return '';
  
  // Scape HTML to avoid issues
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Lists
  html = html.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // Headers (H3)
  html = html.replace(/^\s*###\s+(.*)$/gm, '<h3>$1</h3>');
  
  // Links: [Text](URL)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
    const fullUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
    return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="chat-link">${linkText}</a>`;
  });
  
  // Tables
  // Checks if the block contains vertical bars
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<table>';
      }
      
      const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      // Separator row
      if (line.includes('---')) {
        continue; 
      }
      
      tableHtml += '<tr>';
      cells.forEach(cell => {
        // If it's first row of table (header)
        if (tableHtml.match(/<tr>/g).length === 1) {
          tableHtml += `<th>${cell}</th>`;
        } else {
          tableHtml += `<td>${cell}</td>`;
        }
      });
      tableHtml += '</tr>';
    } else {
      if (inTable) {
        inTable = false;
        tableHtml += '</table>';
        newLines.push(tableHtml);
      }
      newLines.push(lines[i]);
    }
  }
  
  if (inTable) {
    tableHtml += '</table>';
    newLines.push(tableHtml);
  }
  
  html = newLines.join('\n');
  
  // Newlines
  html = html.replace(/\n/g, '<br/>');
  
  return html;
};

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Hola! Soy **Israel Alejandro (IA)**, tu Asistente de Servicio Técnico.\n\n¿En qué puedo ayudarte hoy? Puedes hacerme preguntas sobre tickets en C4C, resúmenes operativos, rendimiento de técnicos o solicitar reportes en Excel y gráficos.'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;
    
    setInputText('');
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        })
      });
      
      if (!response.ok) {
        throw new Error('Error en el servidor backend.');
      }
      
      const data = await response.json();
      const taskId = data.task_id;
      
      // Función recursiva para consultar el estado de la tarea en segundo plano
      const pollStatus = async () => {
        try {
          const statusResp = await fetch(`${API_BASE_URL}/api/chat/status/${taskId}`);
          if (!statusResp.ok) {
            throw new Error('No se pudo verificar el estado de la consulta.');
          }
          
          const taskData = await statusResp.json();
          
          if (taskData.status === 'completed') {
            setMessages(prev => [...prev, { role: 'assistant', content: taskData.result.content }]);
            setIsLoading(false);
          } else if (taskData.status === 'failed') {
            throw new Error(taskData.error || 'Error en el procesamiento de la consulta.');
          } else {
            // Sigue procesando, volver a consultar en 2 segundos
            setTimeout(pollStatus, 2000);
          }
        } catch (pollError) {
          console.error('Error durante el sondeo del chat:', pollError);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Lo siento, ocurrió un error al procesar tu solicitud: ${pollError.message}` 
          }]);
          setIsLoading(false);
        }
      };
      
      // Iniciar el sondeo después de 2 segundos
      setTimeout(pollStatus, 2000);
      
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Lo siento, ocurrió un error al procesar tu solicitud. Por favor verifica la conexión con el servidor backend.' 
      }]);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const selectSuggested = (queryText) => {
    handleSendMessage(queryText);
    setIsSidebarOpen(false);
  };

  const handleExportPNG = (iframeId) => {
    try {
      const iframe = document.getElementById(iframeId);
      if (!iframe) return;
      
      const iframeWindow = iframe.contentWindow;
      const Plotly = iframeWindow.Plotly;
      const gd = iframeWindow.document.querySelector('.plotly-graph-div');
      
      if (Plotly && gd) {
        Plotly.downloadImage(gd, {
          format: 'png',
          filename: `grafico_st_${iframeId}`,
          width: 1200,
          height: 630
        });
      } else {
        window.open(iframe.src, '_blank');
      }
    } catch (e) {
      console.error('Error al exportar gráfico:', e);
      const iframe = document.getElementById(iframeId);
      if (iframe) {
        window.open(iframe.src, '_blank');
      }
    }
  };

  // Helper to extract custom tokens for downloads and charts
  const renderMessageContent = (content, index) => {
    // 1. Check for interactive Plotly charts: [EmbedChart:url] or standard markdown link pointing to charts
    const embedChartRegex = /\[EmbedChart:([^\]]+)\]/i;
    const mdChartRegex = /\[[^\]]+\]\((\/static\/charts\/[^)]+\.html)\)/i;
    
    // 2. Check for Excel downloads: [Descargar Reporte Excel](url) or standard markdown link pointing to reports
    const excelDownloadRegex = /\[Descargar Reporte Excel\]\(([^)]+)\)/i;
    const mdExcelRegex = /\[[^\]]+\]\((\/static\/reports\/[^)]+\.xlsx)\)/i;
    
    let chartUrl = null;
    let excelUrl = null;
    
    const matchChart = embedChartRegex.exec(content) || mdChartRegex.exec(content);
    if (matchChart) {
      chartUrl = matchChart[1];
    }
    
    const matchExcel = excelDownloadRegex.exec(content) || mdExcelRegex.exec(content);
    if (matchExcel) {
      excelUrl = matchExcel[1];
    }
    
    // Clean tokens and links from displayed content so they don't show as ugly raw text or duplicate embeds
    let cleanedContent = content;
    if (chartUrl) {
      cleanedContent = cleanedContent
        .replace(/\[EmbedChart:[^\]]+\]/gi, '')
        .replace(/\[[^\]]+\]\(\/static\/charts\/[^)]+\.html\)/gi, '');
    }
    if (excelUrl) {
      cleanedContent = cleanedContent
        .replace(/\[Descargar Reporte Excel\]\([^)]+\)/gi, '')
        .replace(/\[[^\]]+\]\(\/static\/reports\/[^)]+\.xlsx\)/gi, '');
    }
    
    const parsedHtml = parseMarkdown(cleanedContent.trim());
    
    return (
      <div className="message-body">
        <div dangerouslySetInnerHTML={{ __html: parsedHtml }} />
        
        {excelUrl && (
          <div className="download-card">
            <div className="download-icon">
              <DownloadIcon />
            </div>
            <div className="download-info">
              <div className="download-title">Reporte de Servicio Generado</div>
              <div className="download-size">Formato: Microsoft Excel (.xlsx)</div>
            </div>
            <a 
              href={`${API_BASE_URL}${excelUrl}`} 
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
                <a 
                  href={`${API_BASE_URL}${chartUrl}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="chart-action-btn"
                >
                  Abrir ↗
                </a>
                <button 
                  onClick={() => handleExportPNG(`chart-iframe-${index}`)}
                  className="chart-action-btn"
                >
                  Exportar PNG 🖼️
                </button>
                <a 
                  href={`${API_BASE_URL}${chartUrl}`} 
                  download={`grafico_st_${index}.html`}
                  className="chart-action-btn"
                >
                  Descargar HTML 💾
                </a>
              </div>
            </div>
            <div className="chart-iframe-container" style={{ marginTop: '4px' }}>
              <iframe 
                id={`chart-iframe-${index}`}
                src={`${API_BASE_URL}${chartUrl}`} 
                title="Gráfico ST" 
                className="chart-iframe"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-text">IA</div>
          </div>
          <div className="brand-info">
            <span className="brand-title">Israel Alejandro</span>
            <span className="brand-subtitle">Atención al Cliente</span>
          </div>
          <button 
            className="menu-toggle" 
            style={{ marginLeft: 'auto', display: isSidebarOpen ? 'block' : 'none' }}
            onClick={() => setIsSidebarOpen(false)}
          >
            <XIcon />
          </button>
        </div>
        
        <div className="sidebar-content">
          <div>
            <div className="sidebar-section-title">Consultas Rápidas</div>
            <div className="suggested-list">
              <button 
                className="suggested-btn"
                onClick={() => selectSuggested('¿Cuántos tickets de servicio técnico se crearon en mayo de 2026?')}
              >
                📊 Tickets creados en mayo 2026
              </button>
              <button 
                className="suggested-btn"
                onClick={() => selectSuggested('Muéstrame los 5 principales motivos de no atención')}
              >
                🚫 Top 5 Motivos de no atención
              </button>
              <button 
                className="suggested-btn"
                onClick={() => selectSuggested('¿Cuáles son los 5 técnicos con más visitas realizadas este mes?')}
              >
                🔧 Técnicos más activos
              </button>
            </div>
          </div>

          <div>
            <div className="sidebar-section-title">Reportes & Gráficos</div>
            <div className="suggested-list">
              <button 
                className="suggested-btn"
                onClick={() => selectSuggested('Descarga un reporte en Excel de las órdenes cerradas en mayo de 2026')}
              >
                📥 Reporte Excel: Órdenes de Mayo
              </button>
              <button 
                className="suggested-btn"
                onClick={() => selectSuggested('Genera un gráfico de barras mostrando la cantidad de visitas realizadas por técnico este mes')}
              >
                📈 Gráfico: Visitas por técnico
              </button>
            </div>
          </div>
        </div>
        
        <div className="sidebar-footer">
          <div className="status-badge">
            <div className="status-dot"></div>
            <span>Conectado a Azure SQL & C4C</span>
          </div>
          <div>Versión 1.0 - Hostinger VPS</div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-area">
        <div className="chat-header">
          <button className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
            <MenuIcon />
          </button>
          
          <div className="chat-title-container">
            <span className="chat-title">Panel de Control Inteligente</span>
            <span className="chat-subtitle">Asistente Ejecutivo para Gestión de Servicios</span>
          </div>
          
          <div style={{ width: '40px' }} className="menu-toggle"></div> {/* Spacer for alignment */}
        </div>

        <div className="messages-container">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="avatar">
                {msg.role === 'assistant' ? <BotIcon /> : <UserIcon />}
              </div>
              <div className="message-content">
                {msg.role === 'assistant' ? renderMessageContent(msg.content, index) : msg.content}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="typing-container">
              <div className="typing-dots">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
              <span className="typing-text">Procesando y analizando datos...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <div className="input-wrapper">
            <input
              type="text"
              placeholder="Pregúntale al asistente sobre servicios, tickets, reportes..."
              className="chat-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <button 
              className="send-btn" 
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputText.trim()}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
