import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '32px',
          background: 'var(--bg-base)', color: 'var(--text-primary)',
          fontFamily: 'var(--font)'
        }}>
          <div style={{
            maxWidth: 440, width: '100%', textAlign: 'center',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '40px',
            boxShadow: 'var(--shadow-md)'
          }}>
            <p style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</p>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>
              Algo salió mal
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 24 }}>
              {this.state.error?.message || 'Error inesperado. Recarga la página.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)',
                padding: '12px 28px', fontSize: '1rem', fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
