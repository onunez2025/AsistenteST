import React, { useState, useEffect } from 'react';
import { Menu, Plus, Trash2, MoreVertical, Pin, Edit2, LogOut, ChevronDown } from 'lucide-react';
import { SiatcLogoMark } from './icons';

export default function Sidebar({
  isSidebarOpen, setIsSidebarOpen,
  chats, setChats,
  activeChatId, setActiveChatId,
  handleNewChat, handleDeleteChat,
  searchQuery, setSearchQuery,
  user, handleLogout,
  activeView, setActiveView,
}) {
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const close = () => { setActiveMenuId(null); setShowUserMenu(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const stopProp = (e) => e.stopPropagation();

  const handleRename = (chatId, currentTitle, e) => {
    stopProp(e);
    setActiveMenuId(null);
    const newTitle = prompt('Renombrar conversación:', currentTitle);
    if (newTitle?.trim()) {
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle.trim() } : c));
    }
  };

  const handleTogglePin = (chatId, e) => {
    stopProp(e);
    setActiveMenuId(null);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, pinned: !c.pinned } : c));
  };

  const handleDelete = (chatId, e) => {
    stopProp(e);
    setActiveMenuId(null);
    handleDeleteChat(chatId);
  };

  const filtered = (chats || []).filter(c =>
    !searchQuery || c.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinned   = filtered.filter(c => c.pinned);
  const unpinned = filtered.filter(c => !c.pinned);

  const groupByDate = (list) => {
    const groups = { 'Hoy': [], 'Ayer': [], 'Esta semana': [], 'Anteriores': [] };
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    list.forEach(c => {
      const t = new Date(c.createdAt || Date.now()).getTime();
      const diff = todayMs - new Date(new Date(c.createdAt || Date.now()).setHours(0,0,0,0)).getTime();
      if (diff <= 0)               groups['Hoy'].push(c);
      else if (diff <= 86400000)   groups['Ayer'].push(c);
      else if (diff <= 7*86400000) groups['Esta semana'].push(c);
      else                         groups['Anteriores'].push(c);
    });
    return groups;
  };

  const groups = groupByDate(unpinned);

  const initials = user?.full_name
    ? user.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : (user?.username?.[0] || '?').toUpperCase();

  const renderChatItem = (chat) => (
    <div
      key={chat.id}
      className={`sidebar-chat-item${activeChatId === chat.id ? ' active' : ''}`}
      onClick={() => {
        setActiveChatId(chat.id);
        setActiveView('chat');
        if (isMobile) setIsSidebarOpen(false);
      }}
    >
      {chat.pinned && <Pin size={12} className="sidebar-pin-icon" />}
      <span className="sidebar-chat-title">{chat.title || 'Nueva conversación'}</span>
      <button
        className="sidebar-chat-menu-btn"
        onClick={(e) => { stopProp(e); setActiveMenuId(activeMenuId === chat.id ? null : chat.id); }}
      >
        <MoreVertical size={14} />
      </button>
      {activeMenuId === chat.id && (
        <div className="sidebar-context-menu" onClick={stopProp}>
          <button onClick={(e) => handleRename(chat.id, chat.title, e)}>
            <Edit2 size={14} /> Renombrar
          </button>
          <button onClick={(e) => handleTogglePin(chat.id, e)}>
            <Pin size={14} /> {chat.pinned ? 'Desanclar' : 'Anclar'}
          </button>
          <button className="danger" onClick={(e) => handleDelete(chat.id, e)}>
            <Trash2 size={14} /> Eliminar
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {isMobile && isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <nav className={`sidebar${isSidebarOpen ? '' : ' collapsed'}`}>
        {/* Header */}
        <div className="sidebar-header">
          <button className="sidebar-menu-btn" onClick={() => setIsSidebarOpen(false)}>
            <Menu size={20} />
          </button>
          <div className="sidebar-logo">
            <SiatcLogoMark size={28} />
            <div>
              <div className="sidebar-logo-text">SIATC<span style={{ color: '#4C5F80', fontWeight: 300 }}>.IA</span></div>
            </div>
          </div>
        </div>

        {/* New chat button */}
        <button className="sidebar-new-chat-btn" onClick={handleNewChat}>
          <Plus size={18} />
          Nueva conversación
        </button>

        {/* Search */}
        <div className="sidebar-search-wrap">
          <input
            className="sidebar-search-input"
            placeholder="Buscar conversaciones..."
            value={searchQuery || ''}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Chat list */}
        <div className="sidebar-list">
          {pinned.length > 0 && (
            <>
              <div className="sidebar-group-label">Ancladas</div>
              {pinned.map(renderChatItem)}
            </>
          )}
          {Object.entries(groups).map(([label, items]) =>
            items.length > 0 ? (
              <React.Fragment key={label}>
                <div className="sidebar-group-label">{label}</div>
                {items.map(renderChatItem)}
              </React.Fragment>
            ) : null
          )}
          {filtered.length === 0 && (
            <div style={{ padding: '16px 8px', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {searchQuery ? 'Sin resultados' : 'No hay conversaciones aún'}
            </div>
          )}
        </div>

        {/* Footer — user section */}
        <div className="sidebar-footer">
          <button
            className="sidebar-user-btn"
            onClick={(e) => { stopProp(e); setShowUserMenu(v => !v); }}
          >
            <div className="sidebar-avatar">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt={user?.full_name || 'avatar'} />
                : initials
              }
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.full_name || user?.username || 'Usuario'}</div>
              <div className="sidebar-user-role">{user?.role_name || 'SIATC.IA'}</div>
            </div>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

            {showUserMenu && (
              <div className="sidebar-user-menu" onClick={stopProp}>
                <button className="danger" onClick={(e) => { stopProp(e); handleLogout(); }}>
                  <LogOut size={14} /> Cerrar sesión
                </button>
              </div>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
