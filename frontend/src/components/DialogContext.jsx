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
              border: '1px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem' }}>
                {dialog.title}
              </h3>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {dialog.message}
              </p>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: 10, padding: '0 24px 24px' }}>
              <button
                onClick={handleCancel}
                style={{
                  flex: 1,
                  height: 44,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                {dialog.cancelLabel}
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 1,
                  height: 44,
                  background: 'var(--color-accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 700,
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
