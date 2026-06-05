import React, { useState, useRef, useEffect, useMemo } from 'react';
import './App.css';
import Landing from './components/Landing';
import Login from './components/Login';
import Notebook from './components/Notebook';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import { useToast } from './components/Toast';
import useChatPolling from './hooks/useChatPolling';

// Base URL for API
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

const getFullUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
};

function App() {
  const { toastSuccess, toastError, toastInfo } = useToast();

  // Theme Configuration (Dark mode default)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Auth States
  const [token, setToken] = useState(() => localStorage.getItem('siatc_token') || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('siatc_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [showLoginForm, setShowLoginForm] = useState(false); // false = Landing, true = Login Form

  // State Management for Chats and Notes (loaded on user change)
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [activeNote, setActiveNote] = useState({ id: null, title: '', content: '' });

  // Sidebar dynamic tab
  const [sidebarTab, setSidebarTab] = useState('chats'); // 'chats' or 'library'
  const [activeTaskId, setActiveTaskId] = useState(null);

  const username = user?.username || 'guest';

  // Load from localStorage when user/username changes
  useEffect(() => {
    if (user) {
      const savedChats = localStorage.getItem(`chats_${username}`);
      setChats(savedChats ? JSON.parse(savedChats) : []);
      
      const savedActiveChatId = localStorage.getItem(`activeChatId_${username}`);
      setActiveChatId(savedActiveChatId || null);

      const savedNotes = localStorage.getItem(`notes_${username}`);
      setNotes(savedNotes ? JSON.parse(savedNotes) : []);
    } else {
      setChats([]);
      setActiveChatId(null);
      setNotes([]);
    }
  }, [user, username]);

  // Sync state changes with localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem(`chats_${username}`, JSON.stringify(chats));
    }
  }, [chats, username, user]);

  useEffect(() => {
    if (user) {
      if (activeChatId) {
        localStorage.setItem(`activeChatId_${username}`, activeChatId);
      } else {
        localStorage.removeItem(`activeChatId_${username}`);
      }
    }
  }, [activeChatId, username, user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`notes_${username}`, JSON.stringify(notes));
    }
  }, [notes, username, user]);

  // Chat parameters
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Collapsible panels
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  
  // File Upload State
  const [fileAttachment, setFileAttachment] = useState(null); // { name, type, data }
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [chats, activeChatId, isLoading]);

  // Get active chat messages
  const getActiveChat = () => {
    return chats.find(c => c.id === activeChatId) || null;
  };

  const getActiveMessages = () => {
    const activeChat = getActiveChat();
    return activeChat ? activeChat.messages : [];
  };

  // Start a new conversation session
  const handleNewChat = () => {
    const newId = `chat_${Date.now()}`;
    const newChat = {
      id: newId,
      title: 'Conversación Nueva',
      messages: [
        {
          role: 'assistant',
          content: '¡Hola! Soy **SIATC.IA**, tu Asistente de Atención al Cliente de **Grupo SOLE / Rinnai**.\n\n¿En qué puedo ayudarte hoy? Puedes hacerme preguntas sobre tickets en C4C, resúmenes operativos, rendimiento de técnicos o solicitar reportes en Excel y gráficos.'
        }
      ],
      createdAt: new Date().toISOString()
    };
    
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newId);
    setInputText('');
    setFileAttachment(null);
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
    if (window.innerWidth <= 1024) {
      setIsNotebookOpen(false);
    }
    toastInfo("Conversación creada", "Inicia una nueva consulta");
  };

  // Delete chat from history
  const handleDeleteChat = (id, e) => {
    e.stopPropagation();
    const filtered = chats.filter(c => c.id !== id);
    setChats(filtered);
    if (activeChatId === id) {
      if (filtered.length > 0) {
        setActiveChatId(filtered[0].id);
      } else {
        setActiveChatId(null);
      }
    }
    toastSuccess("Chat eliminado con éxito");
  };

  const [isFileUploading, setIsFileUploading] = useState(false);

  // Handle uploading files directly to Azure Blob Storage
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toastError("Error de archivo", "El archivo excede el límite de tamaño de 10MB.");
      return;
    }

    setIsFileUploading(true);
    setFileAttachment({
      name: file.name,
      type: file.type || "application/octet-stream",
      url: null,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("No se pudo subir el archivo.");
      }

      const data = await response.json();
      setFileAttachment(prev => ({
        ...prev,
        url: data.url
      }));
      toastSuccess("Archivo subido", `Se subió ${file.name} correctamente`);
    } catch (err) {
      console.error("Error al subir archivo:", err);
      toastError("Error de subida", "Error al subir el archivo al almacenamiento en la nube.");
      setFileAttachment(null);
    } finally {
      setIsFileUploading(false);
      e.target.value = null;
    }
  };

  // Send message flow
  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() && !fileAttachment) return;
    
    if (window.innerWidth <= 1024) {
      setIsNotebookOpen(false);
    }
    
    setInputText('');
    const attachmentToSend = fileAttachment;
    setFileAttachment(null);

    let currentChatId = activeChatId;
    let currentChats = [...chats];
    let activeChat = currentChats.find(c => c.id === currentChatId);

    // If there is no active chat session, create one dynamically
    if (!activeChat) {
      currentChatId = `chat_${Date.now()}`;
      activeChat = {
        id: currentChatId,
        title: text ? (text.length > 30 ? text.substring(0, 30) + '...' : text) : 'Archivo adjunto',
        messages: [],
        createdAt: new Date().toISOString()
      };
      currentChats = [activeChat, ...currentChats];
      setChats(currentChats);
      setActiveChatId(currentChatId);
    } else if (activeChat.messages.length === 1 && activeChat.title === 'Conversación Nueva' && text) {
      // Auto rename first chat session title based on query
      activeChat.title = text.length > 35 ? text.substring(0, 35) + '...' : text;
    }

    // Append user message
    const userMsg = {
      role: 'user',
      content: text,
      attachment: attachmentToSend ? {
        name: attachmentToSend.name,
        type: attachmentToSend.type,
        url: attachmentToSend.url
      } : undefined
    };

    activeChat.messages.push(userMsg);
    setChats([...currentChats]);
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: activeChat.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            attachment: msg.attachment
          }))
        })
      });
      
      if (!response.ok) {
        throw new Error('Error en el servidor backend.');
      }
      
      const data = await response.json();
      setActiveTaskId(data.task_id);
    } catch (error) {
      console.error('Error sending message:', error);
      const updatedChats = [...currentChats];
      const chatToUpdate = updatedChats.find(c => c.id === currentChatId);
      if (chatToUpdate) {
        chatToUpdate.messages.push({
          role: 'assistant',
          content: 'Lo siento, ocurrió un error al procesar tu solicitud. Por favor verifica la conexión con el servidor backend.'
        });
        setChats(updatedChats);
      }
      setIsLoading(false);
      toastError("Error de comunicación", error.message);
    }
  };

  // Integrated useChatPolling Hook
  useChatPolling(activeTaskId, activeChatId, {
    onSuccess: (result) => {
      setChats(prevChats => {
        const updated = [...prevChats];
        const chatToUpdate = updated.find(c => c.id === activeChatId);
        if (chatToUpdate) {
          chatToUpdate.messages.push({
            role: 'assistant',
            content: result.content
          });
        }
        return updated;
      });
      setIsLoading(false);
      setActiveTaskId(null);
      toastSuccess("Respuesta recibida");
    },
    onError: (err) => {
      console.error("Error polling chat task:", err);
      setChats(prevChats => {
        const updated = [...prevChats];
        const chatToUpdate = updated.find(c => c.id === activeChatId);
        if (chatToUpdate) {
          chatToUpdate.messages.push({
            role: 'assistant',
            content: `Lo siento, ocurrió un error al procesar tu solicitud: ${err.message}`
          });
        }
        return updated;
      });
      setIsLoading(false);
      setActiveTaskId(null);
      toastError("Error de procesamiento", err.message);
    }
  });

  // Plotly chart exporter helper
  const handleExportPNG = (iframeId) => {
    try {
      const iframe = document.getElementById(iframeId);
      if (!iframe) return;
      const gd = iframe.contentWindow.document.querySelector('.plotly-graph-div');
      const Plotly = iframe.contentWindow.Plotly;
      
      if (Plotly && gd) {
        Plotly.downloadImage(gd, {
          format: 'png',
          filename: `grafico_st_${iframeId}`,
          width: 1200,
          height: 630
        });
        toastSuccess("Gráfico exportado", "Descargando PNG...");
      } else {
        window.open(iframe.src, '_blank');
      }
    } catch (e) {
      console.error('Error exporting chart (CORS restriction likely):', e);
      const iframe = document.getElementById(iframeId);
      if (iframe) {
        window.open(iframe.src, '_blank');
        toastInfo("Gráfico abierto en pestaña nueva", "Debido a restricciones de seguridad del navegador, se abrió en una pestaña externa.");
      }
    }
  };

  // Notebook Action Helpers
  const handleSaveNote = () => {
    if (!activeNote.title.trim() && !activeNote.content.trim()) return;

    if (activeNote.id) {
      // Update note
      setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, title: activeNote.title, content: activeNote.content } : n));
      toastSuccess("Nota actualizada");
    } else {
      // Add note
      const newNote = {
        id: `note_${Date.now()}`,
        title: activeNote.title || 'Nota sin título',
        content: activeNote.content,
        updatedAt: new Date().toISOString()
      };
      setNotes(prev => [newNote, ...prev]);
      setActiveNote(prev => ({ ...prev, id: newNote.id }));
      toastSuccess("Nota guardada con éxito");
    }
  };

  const handleNewNote = () => {
    setActiveNote({ id: null, title: '', content: '' });
  };

  const handleDeleteNote = (id, e) => {
    e.stopPropagation();
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeNote.id === id) {
      handleNewNote();
    }
    toastSuccess("Nota eliminada");
  };

  // Send Note content to the chat input box
  const handleSendNoteToChat = (content) => {
    setInputText(prev => prev + (prev ? '\n' : '') + content);
    toastInfo("Nota copiada al chat", "Contenido cargado en la caja de entrada.");
  };

  const handleLogout = () => {
    localStorage.removeItem('siatc_token');
    localStorage.removeItem('siatc_user');
    setToken(null);
    setUser(null);
    setChats([]);
    setActiveChatId(null);
    setNotes([]);
    handleNewNote();
    toastInfo("Sesión cerrada");
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (e) {
      return '';
    }
  };

  // Performance Optimization: Wrap getLibraryFiles with useMemo
  const libraryFiles = useMemo(() => {
    const files = [];
    chats.forEach(chat => {
      chat.messages.forEach(msg => {
        if (msg.attachment) {
          files.push({
            name: msg.attachment.name,
            type: msg.attachment.type,
            url: msg.attachment.url || `data:${msg.attachment.type};base64,${msg.attachment.data}`,
            chatId: chat.id,
            chatTitle: chat.title,
            origin: 'uploaded',
            date: chat.createdAt
          });
        }
        
        if (msg.role === 'assistant') {
          const excelRegex = /\[Descargar Reporte Excel\]\(([^)]+)\)/i;
          const mdExcelRegex = /\[[^\]]+\]\((\/(?:static\/reports|generated\/reports)\/[^)]+\.xlsx)\)/i;
          const azureExcelRegex = /\((https:\/\/soleblob1.blob.core.windows.net\/stecnico\/generated\/reports\/[^)]+\.xlsx)\)/i;
          
          let excelMatch = excelRegex.exec(msg.content) || mdExcelRegex.exec(msg.content) || azureExcelRegex.exec(msg.content);
          if (excelMatch) {
            const url = excelMatch[1];
            const name = url.substring(url.lastIndexOf('/') + 1);
            files.push({
              name: name || 'Reporte Excel',
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              url: url.startsWith('/') ? `${API_BASE_URL}${url}` : url,
              chatId: chat.id,
              chatTitle: chat.title,
              origin: 'generated',
              date: chat.createdAt
            });
          }

          const chartRegex = /\[EmbedChart:([^\]]+)\]/i;
          const mdChartRegex = /\[[^\]]+\]\((\/(?:static\/charts|generated\/charts)\/[^)]+\.html)\)/i;
          const azureChartRegex = /\((https:\/\/soleblob1.blob.core.windows.net\/stecnico\/generated\/charts\/[^)]+\.html)\)/i;
          
          let chartMatch = chartRegex.exec(msg.content) || mdChartRegex.exec(msg.content) || azureChartRegex.exec(msg.content);
          if (chartMatch) {
            const url = chartMatch[1];
            const name = url.substring(url.lastIndexOf('/') + 1);
            files.push({
              name: name || 'Gráfico Interactivo',
              type: 'text/html',
              url: url.startsWith('/') ? `${API_BASE_URL}${url}` : url,
              chatId: chat.id,
              chatTitle: chat.title,
              origin: 'generated',
              date: chat.createdAt
            });
          }
        }
      });
    });
    
    const uniqueFiles = [];
    const seenUrls = new Set();
    files.forEach(f => {
      if (!seenUrls.has(f.url)) {
        seenUrls.add(f.url);
        uniqueFiles.push(f);
      }
    });
    
    return uniqueFiles;
  }, [chats]);

  const activeMessages = getActiveMessages();

  if (!token) {
    if (!showLoginForm) {
      return <Landing onLoginClick={() => setShowLoginForm(true)} />;
    } else {
      return (
        <Login 
          showLoginForm={showLoginForm} 
          onBack={() => setShowLoginForm(false)} 
          onLoginSuccess={(tokenValue, userValue) => {
            setToken(tokenValue);
            setUser(userValue);
            toastSuccess("Sesión iniciada", `Bienvenido de nuevo, ${userValue.full_name || userValue.username}`);
          }} 
        />
      );
    }
  }

  return (
    <div className="app-container">
      {/* 1. LEFT PANEL: Sidebar */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        chats={chats}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        handleNewChat={handleNewChat}
        handleDeleteChat={handleDeleteChat}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sidebarTab={sidebarTab}
        setSidebarTab={setSidebarTab}
        libraryFiles={libraryFiles}
        formatDateTime={formatDateTime}
      />

      {/* 2. MIDDLE PANEL: Main Chat Area */}
      <ChatArea
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isNotebookOpen={isNotebookOpen}
        setIsNotebookOpen={setIsNotebookOpen}
        theme={theme}
        toggleTheme={toggleTheme}
        user={user}
        username={username}
        handleLogout={handleLogout}
        activeMessages={activeMessages}
        isLoading={isLoading}
        inputText={inputText}
        setInputText={setInputText}
        fileAttachment={fileAttachment}
        setFileAttachment={setFileAttachment}
        handleSendMessage={handleSendMessage}
        handleFileSelect={handleFileSelect}
        isFileUploading={isFileUploading}
        fileInputRef={fileInputRef}
        messagesEndRef={messagesEndRef}
        handleExportPNG={handleExportPNG}
        getFullUrl={getFullUrl}
      />

      {/* 3. RIGHT PANEL: Collapsible Notebook (Cuaderno) */}
      <Notebook
        activeNote={activeNote}
        notes={notes}
        isNotebookOpen={isNotebookOpen}
        onSaveNote={handleSaveNote}
        onDeleteNote={handleDeleteNote}
        onNewNote={handleNewNote}
        onSendToChat={handleSendNoteToChat}
        setActiveNote={setActiveNote}
        setIsNotebookOpen={setIsNotebookOpen}
      />
    </div>
  );
}

export default App;
