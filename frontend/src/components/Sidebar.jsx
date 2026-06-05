import React, { useState, useEffect } from 'react';
import { Menu, Plus, Search, BookOpen, Trash2, MoreVertical, Pin, Share2, Edit2, BookMarked, Settings, LogOut, Files } from 'lucide-react';
import { BotSparkleIcon } from './icons';

function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  chats,
  setChats,
  activeChatId,
  setActiveChatId,
  handleNewChat,
  handleDeleteChat,
  searchQuery,
  setSearchQuery,
  sidebarTab,
  setSidebarTab,
  libraryFiles,
  formatDateTime,
  activeView,
  setActiveView,
  notes,
  setNotes,
  activeNote,
  setActiveNote,
  handleNewNote,
  handleDeleteNote,
  user,
  handleLogout
}) {
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Close context menu and settings menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null);
      setShowSettingsMenu(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleToggleMenu = (id, e) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const handleRenamePrompt = (chatId, currentTitle, e) => {
    e.stopPropagation();
    setActiveMenuId(null);
    const newTitle = prompt("Cambiar nombre de la conversación:", currentTitle);
    if (newTitle && newTitle.trim()) {
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle.trim() } : c));
    }
  };

  const handleTogglePin = (chatId, e) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, pinned: !c.pinned } : c));
  };

  const handleAddChatToNotebook = (chat, e) => {
    e.stopPropagation();
    setActiveMenuId(null);

    // Format chat messages into context
    const chatSummary = chat.messages
      .filter(m => m.content)
      .map(m => `${m.role === 'user' ? 'Usuario' : 'SIATC.IA'}: ${m.content.substring(0, 300)}`)
      .join('\n\n');

    const newNote = {
      id: `note_${Date.now()}`,
      title: `Contexto: ${chat.title}`,
      content: `Información extraída de la conversación "${chat.title}":\n\n${chatSummary}`,
      updatedAt: new Date().toISOString()
    };

    setNotes(prev => [newNote, ...prev]);
    setActiveNote(newNote);
    setActiveView('notebook');
  };

  // Group and sort chats: Pinned first, then sorted chronologically
  const sortedChats = [...chats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt || b.id) - new Date(a.createdAt || a.id);
  });

  const filteredChats = sortedChats.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get initials for profile avatar
  const getInitials = () => {
    if (!user) return 'U';
    if (user.full_name) {
      const parts = user.full_name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0][0].toUpperCase();
    }
    return (user.username || 'U')[0].toUpperCase();
  };

  return (
    <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(false)} title="Cerrar menú">
          <Menu size={20} />
        </button>
        <div className="logo-sparkle">
          <BotSparkleIcon />
        </div>
        <div className="brand-info">
          <span className="brand-title">SIATC.IA</span>
          <span className="brand-subtitle">SOLE / Rinnai</span>
        </div>
      </div>

      {/* Navigation section */}
      <div className="sidebar-navigation">
        <div className="new-chat-container">
          <button className="new-chat-btn" onClick={handleNewChat}>
            <Plus size={18} />
            <span>Nuevo Chat</span>
          </button>
        </div>

        <div className="sidebar-menu-links">
          <button 
            className={`sidebar-link-btn ${activeView === 'search' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('search');
              setSidebarTab('chats');
            }}
          >
            <Search size={18} />
            <span>Buscar chats</span>
          </button>

          <button 
            className={`sidebar-link-btn ${sidebarTab === 'library' && activeView === 'chat' ? 'active' : ''}`}
            onClick={() => {
              setSidebarTab('library');
              setActiveView('chat');
            }}
          >
            <Files size={18} />
            <span>Biblioteca</span>
          </button>
        </div>
      </div>

      <div className="sidebar-scrollable-content">
        {/* Section: Cuadernos */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Cuadernos</span>
            <button className="section-action-btn" onClick={handleNewNote} title="Nuevo cuaderno">
              <Plus size={14} />
            </button>
          </div>
          <div className="notebooks-list">
            <button 
              className={`sidebar-notebook-item create-btn ${activeView === 'notebook' && !activeNote.id ? 'active' : ''}`}
              onClick={handleNewNote}
            >
              <Plus size={14} style={{ opacity: 0.7 }} />
              <span>+ Nuevo cuaderno</span>
            </button>
            {notes.map(note => (
              <div 
                key={note.id} 
                className={`sidebar-notebook-item ${activeView === 'notebook' && activeNote?.id === note.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveNote(note);
                  setActiveView('notebook');
                }}
              >
                <BookOpen size={13} className="item-icon" />
                <span className="item-text">{note.title || 'Cuaderno sin título'}</span>
                <button 
                  className="notebook-delete-btn" 
                  onClick={(e) => handleDeleteNote(note.id, e)} 
                  title="Eliminar cuaderno"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section: Chats Recientes */}
        {sidebarTab === 'chats' ? (
          <div className="sidebar-section chat-history-section">
            <span className="sidebar-section-title">Reciente</span>
            <div className="history-list">
              {filteredChats.length === 0 ? (
                <div className="empty-history-text">Sin chats recientes</div>
              ) : (
                filteredChats.map(c => (
                  <div 
                    key={c.id} 
                    className={`history-item ${activeChatId === c.id && activeView === 'chat' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveChatId(c.id);
                      setActiveView('chat');
                      if (window.innerWidth <= 768) {
                        setIsSidebarOpen(false);
                      }
                    }}
                  >
                    {c.pinned && <Pin size={11} className="pin-indicator-icon" />}
                    <span className="history-item-text">{c.title}</span>
                    
                    {/* Three-dots menu button */}
                    <button 
                      className="history-menu-trigger" 
                      onClick={(e) => handleToggleMenu(c.id, e)} 
                      title="Opciones de chat"
                    >
                      <MoreVertical size={14} />
                    </button>

                    {/* Context menu dropdown */}
                    {activeMenuId === c.id && (
                      <div className="context-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => handleTogglePin(c.id, e)}>
                          <Pin size={13} />
                          <span>{c.pinned ? 'Desfijar chat' : 'Fijar chat'}</span>
                        </button>
                        <button onClick={(e) => handleRenamePrompt(c.id, c.title, e)}>
                          <Edit2 size={13} />
                          <span>Cambiar nombre</span>
                        </button>
                        <button onClick={(e) => handleAddChatToNotebook(c, e)}>
                          <BookMarked size={13} />
                          <span>Agregar al cuaderno</span>
                        </button>
                        <button onClick={(e) => handleDeleteChat(c.id, e)} className="delete-option">
                          <Trash2 size={13} />
                          <span>Borrar</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="sidebar-section">
            <span className="sidebar-section-title">Archivos de Biblioteca</span>
            <div className="library-list">
              {libraryFiles.length === 0 ? (
                <div className="empty-history-text">Sin archivos en chats</div>
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
                        setActiveView('chat');
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
          </div>
        )}
      </div>

      {/* User profile footer */}
      <div className="sidebar-footer">
        <div className="user-profile-widget" onClick={(e) => { e.stopPropagation(); setShowSettingsMenu(!showSettingsMenu); }}>
          <div className="user-avatar">{getInitials()}</div>
          <div className="user-info">
            <span className="user-name">{user?.full_name || user?.username || 'Usuario'}</span>
            <span className="user-role">{user?.role_name || 'Personal'}</span>
          </div>
          <button className="settings-btn" title="Configuración de cuenta">
            <Settings size={16} />
          </button>

          {showSettingsMenu && (
            <div className="settings-dropdown-menu" onClick={(e) => e.stopPropagation()}>
              <div className="dropdown-user-header">
                <strong>{user?.full_name || user?.username}</strong>
                <span>{user?.email}</span>
              </div>
              <div className="dropdown-divider"></div>
              <button onClick={handleLogout} className="logout-option">
                <LogOut size={14} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
