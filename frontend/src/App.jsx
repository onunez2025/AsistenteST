import React, { useState, useRef, useEffect, useMemo } from 'react';
import './App.css';
import Landing from './components/Landing';
import Login from './components/Login';
import Notebook from './components/Notebook';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import { useToast } from './components/Toast';
import { apiClient, API_BASE_URL } from './services/apiClient';

const getFullUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url}`;
};

function App() {
  const { toastSuccess, toastError, toastInfo } = useToast();

  // Tema
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Auth
  const [token, setToken]               = useState(() => localStorage.getItem('siatc_token') || null);
  const [user, setUser]                 = useState(() => { const s = localStorage.getItem('siatc_user'); return s ? JSON.parse(s) : null; });
  const [showLoginForm, setShowLoginForm] = useState(false);

  // Chats y notas
  const [chats, setChats]               = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [notes, setNotes]               = useState([]);
  const [activeNote, setActiveNote]     = useState({ id: null, title: '', content: '' });

  // Navegación
  const [activeView, setActiveView]     = useState('chat');
  const [sidebarTab, setSidebarTab]     = useState('chats');

  const username = user?.username || 'guest';

  // Cargar datos de localStorage al cambiar usuario
  useEffect(() => {
    if (user) {
      const savedChats = localStorage.getItem(`chats_${username}`);
      setChats(savedChats ? JSON.parse(savedChats) : []);
      const savedActive = localStorage.getItem(`activeChatId_${username}`);
      setActiveChatId(savedActive || null);
      const savedNotes = localStorage.getItem(`notes_${username}`);
      setNotes(savedNotes ? JSON.parse(savedNotes) : []);
    } else {
      setChats([]); setActiveChatId(null); setNotes([]);
    }
  }, [user, username]);

  useEffect(() => { if (user) localStorage.setItem(`chats_${username}`, JSON.stringify(chats)); }, [chats, username, user]);
  useEffect(() => {
    if (user) {
      activeChatId
        ? localStorage.setItem(`activeChatId_${username}`, activeChatId)
        : localStorage.removeItem(`activeChatId_${username}`);
    }
  }, [activeChatId, username, user]);
  useEffect(() => { if (user) localStorage.setItem(`notes_${username}`, JSON.stringify(notes)); }, [notes, username, user]);

  // Estado de chat
  const [inputText, setInputText]           = useState('');
  const [searchQuery, setSearchQuery]       = useState('');
  const [isLoading, setIsLoading]           = useState(false);
  const [streamingContent, setStreamingContent] = useState(''); // texto que va llegando en tiempo real
  const [progressLabel, setProgressLabel]   = useState('');     // "Consultando base de datos..."
  const [isSidebarOpen, setIsSidebarOpen]   = useState(true);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const [fileAttachment, setFileAttachment] = useState(null);
  const [isFileUploading, setIsFileUploading] = useState(false);
  const fileInputRef  = useRef(null);
  const messagesEndRef = useRef(null);

  // AbortController para cancelar el stream
  const abortControllerRef = useRef(null);
  const lastUsageRef        = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [chats, activeChatId, isLoading, streamingContent]);

  const getActiveChat     = () => chats.find(c => c.id === activeChatId) || null;
  const getActiveMessages = () => getActiveChat()?.messages || [];

  // Nuevo chat
  const handleNewChat = () => {
    const newId = `chat_${Date.now()}`;
    setChats(prev => [{
      id: newId, title: 'Conversación Nueva',
      messages: [],
      createdAt: new Date().toISOString()
    }, ...prev]);
    setActiveChatId(newId);
    setInputText(''); setFileAttachment(null); setActiveView('chat');
    if (window.innerWidth <= 768)  setIsSidebarOpen(false);
    if (window.innerWidth <= 1024) setIsNotebookOpen(false);
    toastInfo("Conversación creada", "Inicia una nueva consulta");
  };

  const handleDeleteChat = (id, e) => {
    e?.stopPropagation();
    const filtered = chats.filter(c => c.id !== id);
    setChats(filtered);
    if (activeChatId === id) setActiveChatId(filtered.length > 0 ? filtered[0].id : null);
    toastSuccess("Chat eliminado");
  };

  // Subida de archivo
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toastError("Archivo demasiado grande", "Máximo 10 MB."); return; }
    setIsFileUploading(true);
    setFileAttachment({ name: file.name, type: file.type || "application/octet-stream", url: null, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null });
    try {
      const fd = new FormData(); fd.append("file", file);
      const resp = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('siatc_token')}` },
        body: fd,
      });
      if (!resp.ok) throw new Error("No se pudo subir el archivo.");
      const data = await resp.json();
      setFileAttachment(prev => ({ ...prev, url: data.url }));
      toastSuccess("Archivo subido", file.name);
    } catch (err) {
      toastError("Error de subida", err.message);
      setFileAttachment(null);
    } finally {
      setIsFileUploading(false);
      e.target.value = null;
    }
  };

  // Detener generación
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Generar título automático con DeepSeek
  const generateChatTitle = async (firstMessage) => {
    try {
      const data = await apiClient.post('/api/chat/title', { first_message: firstMessage });
      return data.title || firstMessage.substring(0, 40);
    } catch (_) {}
    return firstMessage.length > 40 ? firstMessage.substring(0, 40) + '...' : firstMessage;
  };

  // Enviar mensaje — usa SSE streaming
  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() && !fileAttachment) return;
    if (isLoading) return;

    if (window.innerWidth <= 1024) setIsNotebookOpen(false);
    setInputText('');
    const attachmentToSend = fileAttachment;
    setFileAttachment(null);

    // Preparar chat activo
    let currentChatId = activeChatId;
    let currentChats  = [...chats];
    let activeChat    = currentChats.find(c => c.id === currentChatId);
    let isFirstRealMessage = false;

    if (!activeChat) {
      currentChatId = `chat_${Date.now()}`;
      activeChat = {
        id: currentChatId, title: 'Generando título...',
        messages: [], createdAt: new Date().toISOString()
      };
      currentChats = [activeChat, ...currentChats];
      isFirstRealMessage = true;
    } else if (activeChat.messages.length === 1 && activeChat.title === 'Conversación Nueva' && text) {
      isFirstRealMessage = true;
      activeChat.title = 'Generando título...';
    }

    // Agregar mensaje del usuario
    const userMsg = {
      role: 'user', content: text,
      attachment: attachmentToSend ? { name: attachmentToSend.name, type: attachmentToSend.type, url: attachmentToSend.url } : undefined
    };
    activeChat.messages.push(userMsg);
    setChats([...currentChats]);
    setActiveChatId(currentChatId);
    setIsLoading(true);
    setStreamingContent('');
    setProgressLabel('Analizando tu consulta...');
    setActiveView('chat');

    // Generar título en paralelo (no bloquea el chat)
    if (isFirstRealMessage && text) {
      generateChatTitle(text).then(title => {
        setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, title } : c));
      });
    }

    // Crear AbortController para poder cancelar
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await apiClient.stream('/api/chat/stream', {
        messages: activeChat.messages.map(m => ({
          role: m.role, content: m.content, attachment: m.attachment
        }))
      }, controller.signal);

      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          toastError("Sesión expirada", "Por favor inicia sesión nuevamente.");
          setIsLoading(false);
          setStreamingContent('');
          setProgressLabel('');
          return;
        }
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // conservar línea incompleta

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let event;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          switch (event.type) {
            case 'status':
              setProgressLabel(event.message || '');
              break;
            case 'tool_start':
              setProgressLabel(event.label || `Ejecutando ${event.tool}...`);
              break;
            case 'tool_end':
              setProgressLabel('Procesando resultados...');
              break;
            case 'token':
              accumulated += event.content || '';
              setStreamingContent(accumulated);
              break;
            case 'usage':
              lastUsageRef.current = event;
              break;
            case 'done': {
              const capturedUsage = lastUsageRef.current;
              setChats(prev => {
                const updated = [...prev];
                const chat    = updated.find(c => c.id === currentChatId);
                if (chat) {
                  chat.messages.push({
                    role: 'assistant',
                    content: accumulated,
                    usage: capturedUsage || undefined
                  });
                }
                return updated;
              });
              lastUsageRef.current = null;
              setStreamingContent('');
              setProgressLabel('');
              setIsLoading(false);
              abortControllerRef.current = null;
              break;
            }
            case 'error':
              throw new Error(event.message || 'Error desconocido del servidor');
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // El usuario detuvo la generación — guardar lo que se acumuló
        const partial = streamingContent;
        if (partial) {
          setChats(prev => {
            const updated = [...prev];
            const chat    = updated.find(c => c.id === currentChatId);
            if (chat) {
              chat.messages.push({ role: 'assistant', content: partial + '\n\n*(Generación detenida por el usuario)*' });
            }
            return updated;
          });
        }
        toastInfo("Generación detenida");
      } else {
        toastError("Error de conexión", err.message);
        setChats(prev => {
          const updated = [...prev];
          const chat    = updated.find(c => c.id === currentChatId);
          if (chat) {
            chat.messages.push({ role: 'assistant', content: `Lo siento, ocurrió un error: ${err.message}` });
          }
          return updated;
        });
      }
      setStreamingContent('');
      setProgressLabel('');
      setIsLoading(false);
      lastUsageRef.current = null;
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = () => {
    const msgs = activeMessages;
    if (!msgs || msgs.length < 2) return;
    let lastUserMsg = null;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') { lastUserMsg = msgs[i]; break; }
    }
    if (!lastUserMsg) return;
    setChats(prev => prev.map(c => {
      if (c.id !== activeChatId) return c;
      const newMsgs = [...(c.messages || [])];
      while (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role !== 'user') {
        newMsgs.pop();
      }
      return { ...c, messages: newMsgs };
    }));
    setTimeout(() => {
      setInputText(lastUserMsg.content);
      setTimeout(() => handleSendMessage(lastUserMsg.content), 100);
    }, 100);
  };

  // Exportar gráfico Plotly
  const handleExportPNG = (iframeId) => {
    try {
      const iframe = document.getElementById(iframeId);
      if (!iframe) return;
      const gd = iframe.contentWindow.document.querySelector('.plotly-graph-div');
      const Plotly = iframe.contentWindow.Plotly;
      if (Plotly && gd) {
        Plotly.downloadImage(gd, { format: 'png', filename: `grafico_st_${iframeId}`, width: 1200, height: 630 });
        toastSuccess("Gráfico exportado", "Descargando PNG...");
      } else {
        window.open(iframe.src, '_blank');
      }
    } catch {
      const iframe = document.getElementById(iframeId);
      if (iframe) window.open(iframe.src, '_blank');
    }
  };

  // Cuaderno de notas
  const handleSaveNote = () => {
    if (!activeNote.title.trim() && !activeNote.content.trim()) return;
    if (activeNote.id) {
      setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, title: activeNote.title, content: activeNote.content } : n));
      toastSuccess("Cuaderno actualizado");
    } else {
      const newNote = { id: `note_${Date.now()}`, title: activeNote.title || 'Sin título', content: activeNote.content, updatedAt: new Date().toISOString() };
      setNotes(prev => [newNote, ...prev]);
      setActiveNote(prev => ({ ...prev, id: newNote.id }));
      toastSuccess("Cuaderno guardado");
    }
  };
  const handleNewNote     = () => { setActiveNote({ id: null, title: '', content: '' }); setActiveView('notebook'); };
  const handleDeleteNote  = (id, e) => { e.stopPropagation(); setNotes(prev => prev.filter(n => n.id !== id)); if (activeNote.id === id) handleNewNote(); toastSuccess("Cuaderno eliminado"); };
  const handleSendNoteToChat = (content) => { setInputText(prev => prev + (prev ? '\n' : '') + content); setActiveView('chat'); toastInfo("Cuaderno copiado al chat"); };

  const handleLogout = () => {
    handleStopGeneration();
    localStorage.removeItem('siatc_token');
    localStorage.removeItem('siatc_user');
    setToken(null); setUser(null); setChats([]); setActiveChatId(null); setNotes([]);
    toastInfo("Sesión cerrada");
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ''; }
  };

  const libraryFiles = useMemo(() => {
    const files = [];
    const seenUrls = new Set();
    chats.forEach(chat => {
      chat.messages.forEach(msg => {
        if (msg.attachment) {
          const url = msg.attachment.url || `data:${msg.attachment.type};base64,${msg.attachment.data}`;
          if (!seenUrls.has(url)) {
            seenUrls.add(url);
            files.push({ name: msg.attachment.name, type: msg.attachment.type, url, chatId: chat.id, chatTitle: chat.title, origin: 'uploaded', date: chat.createdAt });
          }
        }
        if (msg.role === 'assistant') {
          const excelMatch = /\[Descargar Reporte Excel\]\(([^)]+)\)/i.exec(msg.content)
            || /\[[^\]]+\]\((https:\/\/[^)]+\.xlsx)\)/i.exec(msg.content);
          if (excelMatch && !seenUrls.has(excelMatch[1])) {
            seenUrls.add(excelMatch[1]);
            files.push({ name: excelMatch[1].substring(excelMatch[1].lastIndexOf('/') + 1) || 'Reporte Excel', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', url: excelMatch[1].startsWith('/') ? `${API_BASE_URL}${excelMatch[1]}` : excelMatch[1], chatId: chat.id, chatTitle: chat.title, origin: 'generated', date: chat.createdAt });
          }
          const chartMatch = /\[EmbedChart:([^\]]+)\]/i.exec(msg.content)
            || /\[[^\]]+\]\((https:\/\/[^)]+\.html)\)/i.exec(msg.content);
          if (chartMatch && !seenUrls.has(chartMatch[1])) {
            seenUrls.add(chartMatch[1]);
            files.push({ name: chartMatch[1].substring(chartMatch[1].lastIndexOf('/') + 1) || 'Gráfico', type: 'text/html', url: chartMatch[1].startsWith('/') ? `${API_BASE_URL}${chartMatch[1]}` : chartMatch[1], chatId: chat.id, chatTitle: chat.title, origin: 'generated', date: chat.createdAt });
          }
        }
      });
    });
    return files;
  }, [chats]);

  const activeMessages = getActiveMessages();

  if (!token) {
    return !showLoginForm
      ? <Landing onLoginClick={() => setShowLoginForm(true)} />
      : <Login showLoginForm={showLoginForm} onBack={() => setShowLoginForm(false)}
          onLoginSuccess={(tokenValue, userValue) => {
            setToken(tokenValue); setUser(userValue);
            localStorage.setItem('siatc_token', tokenValue);
            localStorage.setItem('siatc_user', JSON.stringify(userValue));
            toastSuccess("Sesión iniciada", `Bienvenido, ${userValue.full_name || userValue.username}`);
          }} />;
  }

  return (
    <div className="app-layout">
      {/* Overlay oscuro para cerrar el sidebar en móvil al tocar fuera */}
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <Sidebar
        isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
        chats={chats} setChats={setChats}
        activeChatId={activeChatId} setActiveChatId={setActiveChatId}
        handleNewChat={handleNewChat} handleDeleteChat={handleDeleteChat}
        sidebarTab={sidebarTab} setSidebarTab={setSidebarTab}
        libraryFiles={libraryFiles} formatDateTime={formatDateTime}
        activeView={activeView} setActiveView={setActiveView}
        notes={notes} setNotes={setNotes}
        activeNote={activeNote} setActiveNote={setActiveNote}
        handleNewNote={handleNewNote} handleDeleteNote={handleDeleteNote}
        user={user} handleLogout={handleLogout}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
      />

      <ChatArea
        isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
        activeView={activeView} setActiveView={setActiveView}
        theme={theme} toggleTheme={toggleTheme}
        user={user} username={username} handleLogout={handleLogout}
        activeMessages={activeMessages}
        isLoading={isLoading}
        streamingContent={streamingContent}
        progressLabel={progressLabel}
        onStopGeneration={handleStopGeneration}
        inputText={inputText} setInputText={setInputText}
        fileAttachment={fileAttachment} setFileAttachment={setFileAttachment}
        handleSendMessage={handleSendMessage}
        handleRegenerate={handleRegenerate}
        handleFileSelect={handleFileSelect}
        isFileUploading={isFileUploading}
        fileInputRef={fileInputRef}
        messagesEndRef={messagesEndRef}
        handleExportPNG={handleExportPNG}
        getFullUrl={getFullUrl}
        chats={chats} setActiveChatId={setActiveChatId}
        handleDeleteChat={handleDeleteChat}
        formatDateTime={formatDateTime}
      />

      {activeView === 'notebook' && (
        <Notebook
          activeNote={activeNote}
          onSaveNote={handleSaveNote} onDeleteNote={handleDeleteNote}
          onNewNote={handleNewNote} onSendToChat={handleSendNoteToChat}
          setActiveNote={setActiveNote}
          setIsNotebookOpen={(val) => { if (!val) setActiveView('chat'); }}
        />
      )}
    </div>
  );
}

export default App;
