import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// SVG Icons directly embedded
const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"></line><line x1="4" x2="20" y1="6" y2="6"></line><line x1="4" x2="20" y1="18" y2="18"></line></svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
);

const PaperclipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
);

const BookOpenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
);

const BotSparkleIcon = () => (
  <svg className="sparkle-logo-svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2c-.1 0-.3.1-.4.2L9.4 6.7 4.9 8.7c-.2.1-.3.3-.3.4v.4c0 .2.1.3.3.4l4.5 2 2.2 4.5c.1.2.3.3.4.3h.4c.2 0 .3-.1.4-.3l2.2-4.5 4.5-2c.2-.1.3-.3.3-.4v-.4c0-.2-.1-.3-.3-.4l-4.5-2-2.2-4.5c-.1-.1-.3-.2-.4-.2h-.4z" fill="url(#siatc-sparkle-grad)" />
    <path d="M19 14c-.05 0-.15.05-.2.1l-1.1 2.2-2.2 1.1c-.1.05-.15.15-.15.2v.2c0 .1.05.15.15.2l2.2 1.1 1.1 2.2c.05.1.15.15.2.15h.2c.1 0 .15-.05.2-.15l1.1-2.2 2.2-1.1c.1-.05.15-.15.15-.2v-.2c0-.1-.05-.15-.15-.2l-2.2-1.1-1.1-2.2c-.05-.05-.15-.1-.2-.1h-.2z" fill="url(#siatc-sparkle-grad)" />
    <defs>
      <linearGradient id="siatc-sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ff5e62" />
        <stop offset="50%" stopColor="#ff9966" />
        <stop offset="100%" stopColor="#ffdf00" />
      </linearGradient>
    </defs>
  </svg>
);

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
);

const ImageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
);

// Base URL for API
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

// Helper to resolve file URLs safely (prepending local host only for relative paths)
const getFullUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
};

// Simple Markdown parser utility
const parseMarkdown = (text) => {
  if (!text) return '';
  
  // Escape HTML tags to prevent injections, but allow markdown elements
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Headers (### Header)
  html = html.replace(/^\s*###\s+(.*)$/gm, '<h3>$1</h3>');
  
  // Ordered Lists: 1. Item
  html = html.replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');

  // Unordered Lists: - Item or * Item
  html = html.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // Links: [Text](URL)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
    const fullUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
    return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="chat-link">${linkText}</a>`;
  });
  
  // Tables formatting (pipes)
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
      
      // Divider row
      if (line.includes('---')) continue;
      
      tableHtml += '<tr>';
      cells.forEach(cell => {
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
  html = html.replace(/\n/g, '<br/>');
  
  return html;
};

function App() {
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
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false); // false = Landing, true = Login Form

  // State Management for Chats and Notes (loaded on user change)
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [activeNote, setActiveNote] = useState({ id: null, title: '', content: '' });

  // Sidebar dynamic tab
  const [sidebarTab, setSidebarTab] = useState('chats'); // 'chats' or 'library'

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
  };

  const [isFileUploading, setIsFileUploading] = useState(false);

  // Handle uploading files directly to Azure Blob Storage
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("El archivo excede el límite de tamaño de 10MB.");
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
    } catch (err) {
      console.error("Error al subir archivo:", err);
      alert("Error al subir el archivo al almacenamiento en la nube.");
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
      const taskId = data.task_id;
      
      // Polling background task status
      const pollStatus = async () => {
        try {
          const statusResp = await fetch(`${API_BASE_URL}/api/chat/status/${taskId}`);
          if (!statusResp.ok) {
            throw new Error('No se pudo verificar el estado de la consulta.');
          }
          
          const taskData = await statusResp.json();
          
          if (taskData.status === 'completed') {
            const updatedChats = [...currentChats];
            const chatToUpdate = updatedChats.find(c => c.id === currentChatId);
            if (chatToUpdate) {
              chatToUpdate.messages.push({
                role: 'assistant',
                content: taskData.result.content
              });
              setChats(updatedChats);
            }
            setIsLoading(false);
          } else if (taskData.status === 'failed') {
            throw new Error(taskData.error || 'Error en el procesamiento.');
          } else {
            // Keep polling after 2 seconds
            setTimeout(pollStatus, 2000);
          }
        } catch (pollError) {
          console.error('Error polling chat task:', pollError);
          const updatedChats = [...currentChats];
          const chatToUpdate = updatedChats.find(c => c.id === currentChatId);
          if (chatToUpdate) {
            chatToUpdate.messages.push({
              role: 'assistant',
              content: `Lo siento, ocurrió un error al procesar tu solicitud: ${pollError.message}`
            });
            setChats(updatedChats);
          }
          setIsLoading(false);
        }
      };
      
      setTimeout(pollStatus, 1500);
      
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
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
      } else {
        window.open(iframe.src, '_blank');
      }
    } catch (e) {
      console.error('Error exporting chart:', e);
      const iframe = document.getElementById(iframeId);
      if (iframe) window.open(iframe.src, '_blank');
    }
  };

  // Filter history chats based on search query
  const filteredChats = chats.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Notebook Action Helpers
  const handleSaveNote = () => {
    if (!activeNote.title.trim() && !activeNote.content.trim()) return;

    if (activeNote.id) {
      // Update note
      setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, title: activeNote.title, content: activeNote.content } : n));
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
  };

  // Send Note content to the chat input box
  const handleSendNoteToChat = (content) => {
    setInputText(prev => prev + (prev ? '\n' : '') + content);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Credenciales incorrectas');
      }

      const data = await response.json();
      localStorage.setItem('siatc_token', data.token);
      localStorage.setItem('siatc_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      
      setLoginUsername('');
      setLoginPassword('');
    } catch (err) {
      console.error('Error de login:', err);
      setLoginError(err.message || 'Error de conexión con el servidor.');
    } finally {
      setIsLoggingIn(false);
    }
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

  const getLibraryFiles = () => {
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
  };

  const libraryFiles = getLibraryFiles();

  // Helper to extract Plotly charts and Excel links from output
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

  const activeMessages = getActiveMessages();

  if (!token) {
    if (!showLoginForm) {
      return (
        <div className="landing-container">
          <header className="landing-header">
            <div className="landing-logo">
              <BotSparkleIcon />
              <span className="landing-logo-text">SIATC.IA</span>
            </div>
            <button className="landing-login-btn" onClick={() => setShowLoginForm(true)}>
              Iniciar Sesión
            </button>
          </header>
          
          <main className="landing-hero">
            <h1 className="landing-title">
              Optimiza la atención al cliente con la potencia de <span className="highlight-text">SIATC.IA</span>
            </h1>
            <p className="landing-subtitle">
              El asistente inteligente diseñado para la postventa y servicio técnico de Grupo SOLE / Rinnai. Consulta bases de datos, SAP C4C, genera reportes en Excel y gráficos en tiempo real.
            </p>
            <div className="landing-hero-actions">
              <button className="landing-cta-btn" onClick={() => setShowLoginForm(true)}>
                Comenzar Ahora
              </button>
            </div>
          </main>
          
          <section className="landing-features">
            <div className="landing-feature-card">
              <div className="feature-icon">🔍</div>
              <h3 className="feature-title">Monitoreo de SAP C4C</h3>
              <p className="feature-desc">Accede y consulta en tiempo real el estado de tickets y datos OData de SAP C4C.</p>
            </div>
            <div className="landing-feature-card">
              <div className="feature-icon">📊</div>
              <h3 className="feature-title">Reportes y Gráficos</h3>
              <p className="feature-desc">Genera reportes detallados en Excel y gráficos interactivos de rendimiento de forma instantánea.</p>
            </div>
            <div className="landing-feature-card">
              <div className="feature-icon">🧠</div>
              <h3 className="feature-title">IA Orientada a Negocio</h3>
              <p className="feature-desc">Optimizado para resolver dudas de servicio técnico, gestión de garantías y postventa.</p>
            </div>
          </section>
          
          <footer className="landing-footer">
            <div className="landing-footer-credits">
              <span className="footer-title">Una plataforma de</span>
              <span style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '2px', color: '#ff5e62' }}>SOLE</span>
            </div>
            <p className="footer-rights">© 2026 Grupo SOLE / Rinnai. Todos los derechos reservados.</p>
          </footer>
        </div>
      );
    } else {
      return (
        <div className="login-container">
          <div className="login-card-wrapper">
            <header className="login-card-header">
              <div className="login-logo">
                <BotSparkleIcon />
                <span>SIATC.IA</span>
              </div>
              <button className="login-back-btn" onClick={() => setShowLoginForm(false)} title="Volver al inicio">
                ←
              </button>
            </header>
            
            <h2 className="login-title">Bienvenido</h2>
            <p className="login-subtitle">Inicia sesión con tus credenciales de Grupo SOLE</p>
            
            <form className="login-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label" htmlFor="username">Usuario o Correo</label>
                <input 
                  type="text" 
                  id="username" 
                  className="form-input" 
                  placeholder="Ej. RAARBIETO"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label" htmlFor="password">Contraseña</label>
                <div className="form-password-wrapper">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    id="password" 
                    className="form-input"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button" 
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>
              
              {loginError && (
                <div className="login-error-alert">
                  {loginError}
                </div>
              )}
              
              <button 
                type="submit" 
                className="login-submit-btn"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? "Iniciando sesión..." : "Ingresar"}
              </button>
            </form>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="app-container">
      {/* 1. LEFT PANEL: Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(false)} title="Cerrar menú">
            <MenuIcon />
          </button>
          <div className="logo-sparkle">
            <BotSparkleIcon />
          </div>
          <div className="brand-info">
            <span className="brand-title">SIATC.IA</span>
            <span className="brand-subtitle">Grupo SOLE / Rinnai</span>
          </div>
        </div>

        <div className="new-chat-container">
          <button className="new-chat-btn" onClick={handleNewChat}>
            <PlusIcon />
            <span>Nuevo Chat</span>
          </button>
        </div>

        <div className="search-chat-container" style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '26px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, display: 'flex', alignItems: 'center' }}>
            <SearchIcon />
          </span>
          <input 
            type="text" 
            placeholder="Buscar chats..." 
            className="search-chat-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '38px' }}
          />
        </div>

        {/* Sidebar Tabs */}
        <div className="sidebar-tabs">
          <button 
            className={`sidebar-tab-btn ${sidebarTab === 'chats' ? 'active' : ''}`}
            onClick={() => setSidebarTab('chats')}
          >
            Chats
          </button>
          <button 
            className={`sidebar-tab-btn ${sidebarTab === 'library' ? 'active' : ''}`}
            onClick={() => setSidebarTab('library')}
          >
            Biblioteca
          </button>
        </div>

        {sidebarTab === 'chats' ? (
          <div className="history-list-container">
            <span className="history-list-title">Reciente</span>
            <div className="history-list">
              {filteredChats.length === 0 ? (
                <div className="empty-history-text">Sin chats recientes</div>
              ) : (
                filteredChats.map(c => (
                  <div 
                    key={c.id} 
                    className={`history-item ${activeChatId === c.id ? 'active' : ''}`}
                    onClick={() => setActiveChatId(c.id)}
                  >
                    <span className="history-item-text">{c.title}</span>
                    <button className="history-delete-btn" onClick={(e) => handleDeleteChat(c.id, e)} title="Eliminar chat">
                      <TrashIcon />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="library-list">
            {libraryFiles.length === 0 ? (
              <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                No se han detectado archivos en tus conversaciones.
              </div>
            ) : (
              libraryFiles.map((file, idx) => {
                const isExcel = file.name.endsWith('.xlsx');
                const isChart = file.name.endsWith('.html');
                const isImage = file.type.startsWith('image/');
                
                let fileIcon = '📄';
                if (isExcel) fileIcon = '📊';
                else if (isChart) fileIcon = '📈';
                else if (isImage) fileIcon = '🖼️';
                
                return (
                  <div 
                    key={idx} 
                    className="library-item"
                    onClick={() => {
                      setActiveChatId(file.chatId);
                      if (window.innerWidth <= 768) {
                        setIsSidebarOpen(false);
                      }
                    }}
                  >
                    <span className="library-item-icon">{fileIcon}</span>
                    <div className="library-item-info">
                      <a 
                        href={file.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="library-item-name"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {file.name}
                      </a>
                      <span className="library-item-chat">En: {file.chatTitle}</span>
                      <span className="library-item-date">📅 {formatDateTime(file.date)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="sidebar-footer">
          <div className="status-badge">
            <div className="status-dot"></div>
            <span>Conectado a Azure SQL & C4C</span>
          </div>
          <div>SIATC.IA v2.0 (Grupo SOLE / Rinnai)</div>
        </div>
      </div>

      {/* 2. MIDDLE PANEL: Main Chat Area */}
      <div className="chat-area">
        {/* Header toolbar */}
        <div className="chat-header">
          <div className="chat-header-left">
            {!isSidebarOpen && (
              <button className="header-action-btn" onClick={() => setIsSidebarOpen(true)} title="Abrir menú">
                <MenuIcon />
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
              <BookOpenIcon />
            </button>
            
            <button className="header-action-btn" onClick={toggleTheme} title="Cambiar tema">
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            
            <div className="header-user-profile">
              <UserIcon />
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
                  {msg.role === 'assistant' ? <BotSparkleIcon /> : <UserIcon />}
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
                            <div className="chat-message-attachment-icon"><FileIcon /></div>
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
                      <div className="attachment-preview-icon"><FileIcon /></div>
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
                >
                  <PaperclipIcon />
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
                    <SendIcon />
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

      {/* 3. RIGHT PANEL: Collapsible Notebook (Cuaderno) */}
      <div className={`notebook-panel ${isNotebookOpen ? '' : 'closed'}`}>
        <div className="notebook-header">
          <div className="notebook-title">
            <BookOpenIcon />
            <span>Cuaderno de Gestión SOLE</span>
          </div>
          <button className="header-action-btn" onClick={() => setIsNotebookOpen(false)} title="Cerrar Cuaderno">
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
              value={activeNote.title}
              onChange={(e) => setActiveNote(prev => ({ ...prev, title: e.target.value }))}
            />
            <textarea 
              placeholder="Escribe consultas SQL útiles, anotaciones de CAS, reclamos pendientes o código de error..." 
              className="notebook-note-textarea"
              value={activeNote.content}
              onChange={(e) => setActiveNote(prev => ({ ...prev, content: e.target.value }))}
            />
            <div className="notebook-editor-actions">
              {activeNote.id && (
                <button className="notebook-btn" onClick={handleNewNote}>Nueva</button>
              )}
              {activeNote.content && (
                <button className="notebook-btn" onClick={() => handleSendNoteToChat(activeNote.content)}>Cargar en Chat</button>
              )}
              <button className="notebook-btn primary" onClick={handleSaveNote}>Guardar</button>
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
                    className={`notebook-note-item ${activeNote.id === n.id ? 'active' : ''}`}
                    onClick={() => setActiveNote(n)}
                  >
                    <div className="notebook-note-item-header">
                      <span className="notebook-note-item-title">{n.title}</span>
                      <button className="notebook-note-item-delete" onClick={(e) => handleDeleteNote(n.id, e)} title="Eliminar nota">
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
    </div>
  );
}

export default App;
