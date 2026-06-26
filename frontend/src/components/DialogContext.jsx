import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    resolve: null,
  });

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' }) => {
    return new Promise((resolve) => {
      setDialog({ isOpen: true, title, message, confirmLabel, cancelLabel, resolve });
    });
  }, []);

  const handleConfirm = () => {
    dialog.resolve?.(true);
    setDialog(prev => ({ ...prev, isOpen: false, resolve: null }));
  };

  const handleCancel = () => {
    dialog.resolve?.(false);
    setDialog(prev => ({ ...prev, isOpen: false, resolve: null }));
  };

  useEffect(() => {
    if (!dialog.isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog.isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}
      {dialog.isOpen && (
        <div
          className="login-overlay"
          onClick={handleCancel}
          style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 400,
              width: '100%',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>
              {dialog.title}
            </h3>
            <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {dialog.message}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancel}
                style={{
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {dialog.cancelLabel}
              </button>
              <button
                className="login-btn"
                onClick={handleConfirm}
                style={{
                  width: 'auto',
                  padding: '10px 24px',
                  background: 'var(--color-accent)',
                  fontSize: '0.875rem',
                }}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
}
