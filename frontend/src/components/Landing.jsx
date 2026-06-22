import React from 'react';
import { BotSparkleIcon } from './icons';

export default function Landing({ onLoginClick }) {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <BotSparkleIcon />
          <span>SIATC.IA</span>
        </div>
        <button className="landing-login-btn" onClick={onLoginClick}>
          Iniciar sesión
        </button>
      </nav>

      <div className="landing-hero">
        <div className="landing-badge">
          <span>✨</span> Asistente IA · Grupo SOLE
        </div>

        <h1 className="landing-hero-title">
          El asistente inteligente de<br />
          <span>Grupo SOLE / Rinnai</span>
        </h1>

        <p className="landing-hero-subtitle">
          Consulta servicios, NPS, reportes y SAP C4C en lenguaje natural.
          Conectado en tiempo real a tus sistemas.
        </p>

        <div className="landing-cta-group">
          <button className="landing-cta-btn" onClick={onLoginClick}>
            Comenzar ahora
          </button>
        </div>

        <div className="landing-features">
          <div className="landing-feature-pill"><span>📊</span> NPS en tiempo real</div>
          <div className="landing-feature-pill"><span>🔧</span> Gestión de servicios</div>
          <div className="landing-feature-pill"><span>🏢</span> SAP C4C integrado</div>
          <div className="landing-feature-pill"><span>📈</span> Reportes automáticos</div>
        </div>
      </div>
    </div>
  );
}
