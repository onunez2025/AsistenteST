import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Create the Context
const ToastContext = createContext(null);

// Custom Hook to use the Toast notification system
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// SVG Icons for different Toast types
const SuccessIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="toast-icon-svg success">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

const ErrorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="toast-icon-svg error">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" x2="12" y1="8" y2="12"/>
    <line x1="12" x2="12.01" y1="16" y2="16"/>
  </svg>
);

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="toast-icon-svg info">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4"/>
    <path d="M12 8h.01"/>
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
);

// Individual Toast Component
const ToastItem = ({ id, type, message, description, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 4500); // Auto close after 4.5 seconds
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success': return <SuccessIcon />;
      case 'error': return <ErrorIcon />;
      case 'info':
      default:
        return <InfoIcon />;
    }
  };

  return (
    <div className={`toast-item ${type}`}>
      <div className="toast-icon-wrapper">
        {getIcon()}
      </div>
      <div className="toast-content">
        <div className="toast-message">{message}</div>
        {description && <div className="toast-description">{description}</div>}
      </div>
      <button className="toast-close-btn" onClick={() => onClose(id)} aria-label="Close">
        <CloseIcon />
      </button>
    </div>
  );
};

// Toast Provider Component
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', description = '') => {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, message, description }]);
  }, []);

  const hideToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toastSuccess = useCallback((message, description) => showToast(message, 'success', description), [showToast]);
  const toastError = useCallback((message, description) => showToast(message, 'error', description), [showToast]);
  const toastInfo = useCallback((message, description) => showToast(message, 'info', description), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, toastSuccess, toastError, toastInfo }}>
      {children}
      
      {/* Toast Container placed at the top level */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            description={toast.description}
            onClose={hideToast}
          />
        ))}
      </div>

      {/* Self-contained styling with high-performance CSS transitions */}
      <style>{`
        .toast-container {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 360px;
          width: calc(100% - 48px);
          pointer-events: none;
        }

        .toast-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: var(--bg-secondary, #1e1f20);
          border: 1px solid var(--border-color, #3c4043);
          border-radius: 12px;
          padding: 14px 16px;
          box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -2px rgba(0,0,0,0.05));
          pointer-events: auto;
          animation: toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        }

        /* Left-side visual indicator border */
        .toast-item::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 5px;
        }

        .toast-item.success::before {
          background-color: #10b981;
        }

        .toast-item.error::before {
          background-color: #ef4444;
        }

        .toast-item.info::before {
          background-color: #3b82f6;
        }

        .toast-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .toast-icon-svg {
          display: block;
        }

        .toast-icon-svg.success {
          color: #10b981;
        }

        .toast-icon-svg.error {
          color: #ef4444;
        }

        .toast-icon-svg.info {
          color: #3b82f6;
        }

        .toast-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .toast-message {
          font-weight: 600;
          font-size: 14px;
          color: var(--text-main, #e3e3e3);
          line-height: 1.4;
        }

        .toast-description {
          font-size: 12px;
          color: var(--text-muted, #9e9e9e);
          line-height: 1.4;
        }

        .toast-close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted, #9e9e9e);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s, color 0.2s;
          margin-top: -2px;
          margin-right: -4px;
          flex-shrink: 0;
        }

        .toast-close-btn:hover {
          background-color: rgba(255, 255, 255, 0.08);
          color: var(--text-main, #e3e3e3);
        }

        :root[data-theme='light'] .toast-close-btn:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        @keyframes toastSlideIn {
          from {
            transform: translateX(120%) translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateX(0) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
