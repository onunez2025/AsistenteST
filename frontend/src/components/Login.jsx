import React, { useState } from 'react';

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

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

const Login = ({ showLoginForm, onBack, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (showLoginForm === false) {
    return null;
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Credenciales incorrectas');
      }

      const data = await response.json();
      
      // Save details to localStorage
      localStorage.setItem('siatc_token', data.token);
      localStorage.setItem('siatc_user', JSON.stringify(data.user));
      
      // Execute success callback
      if (onLoginSuccess) {
        onLoginSuccess(data.token, data.user);
      }
      
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
    <div className="login-container">
      <div className="login-card-wrapper">
        <header className="login-card-header">
          <div className="login-logo">
            <BotSparkleIcon />
            <span>SIATC.IA</span>
          </div>
          <button className="login-back-btn" onClick={onBack} title="Volver al inicio">
            ←
          </button>
        </header>
        
        <h2 className="login-title">Bienvenido</h2>
        <p className="login-subtitle">Inicia sesión con tus credenciales de Grupo SOLE</p>
        
        <form className="login-form" onSubmit={handleLoginSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Usuario o Correo</label>
            <input 
              type="text" 
              id="username" 
              className="form-input" 
              placeholder="Ej. RAARBIETO"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
};

export default Login;
