import React from 'react';

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

const Landing = ({ onLoginClick }) => {
  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="landing-logo">
          <BotSparkleIcon />
          <span className="landing-logo-text">SIATC.IA</span>
        </div>
        <button className="landing-login-btn" onClick={onLoginClick}>
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
          <button className="landing-cta-btn" onClick={onLoginClick}>
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
};

export default Landing;
