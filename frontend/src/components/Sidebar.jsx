import React from 'react';
import { Menu, Plus, Search, Trash2 } from 'lucide-react';
import { BotSparkleIcon } from './icons';

function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  chats,
  activeChatId,
  setActiveChatId,
  handleNewChat,
  handleDeleteChat,
  searchQuery,
  setSearchQuery,
  sidebarTab,
  setSidebarTab,
  libraryFiles,
  formatDateTime
}) {
  const filteredChats = chats.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
          <span className="brand-subtitle">Grupo SOLE / Rinnai</span>
        </div>
      </div>

      <div className="new-chat-container">
        <button className="new-chat-btn" onClick={handleNewChat}>
          <Plus size={18} />
          <span>Nuevo Chat</span>
        </button>
      </div>

      <div className="search-chat-container" style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '26px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, display: 'flex', alignItems: 'center' }}>
          <Search size={18} />
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
                    <Trash2 size={14} />
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
  );
}

export default Sidebar;
