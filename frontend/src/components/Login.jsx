import React, { useState } from 'react';
import { BotSparkleIcon } from './icons';

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

const Login = ({ showLoginForm, onBack, onLoginSuccess }) => {
  const [username,     setUsername]     = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError,   setLoginError]   = useState('');
  const [isLoggingIn,  setIsLoggingIn]  = useState(false);

  if (showLoginForm === false) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Credenciales incorrectas');
      }
      const data = await response.json();
      localStorage.setItem('siatc_token', data.token);
      localStorage.setItem('siatc_user', JSON.stringify(data.user));
      if (onLoginSuccess) onLoginSuccess(data.token, data.user);
      setUsername('');
      setPassword('');
    } catch (err) {
      console.error('Error de login:', err);
      setLoginError(err.message || 'Error de conexión con el servidor.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="login-overlay" onClick={onBack}>
      <div className="login-card" onClick={e => e.stopPropagation()}>
        <div className="login-logo">
          <BotSparkleIcon />
          <span className="login-logo-text">SIATC.IA</span>
        </div>

        <h2 className="login-title">Bienvenido</h2>
        <p className="login-subtitle">Inicia sesión con tus credenciales de Grupo SOLE</p>

        <form onSubmit={handleLoginSubmit}>
          <div className="login-field">
            <label className="login-label" htmlFor="username">Usuario o Correo</label>
            <input
              type="text"
              id="username"
              className="login-input"
              placeholder="Ej. RAARBIETO"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="password">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                className="login-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingRight: '72px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '0.75rem', color: 'var(--text-secondary)',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {loginError && (
            <p className="login-error">{loginError}</p>
          )}

          <button
            type="submit"
            className="login-btn"
            disabled={isLoggingIn}
            style={{ marginTop: '20px' }}
          >
            {isLoggingIn ? 'Iniciando sesión...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
