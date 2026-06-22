import React from 'react';
import { SiatcLogoFull, SiatcHeroMark } from './icons';

export default function Landing({ onLoginClick }) {
  return (
    <div className="landing-page">
      {/* Fondo animado: orbes y partículas CSS */}
      <div className="landing-bg" aria-hidden="true">
        <div className="landing-orb landing-orb-1" />
        <div className="landing-orb landing-orb-2" />
        <div className="landing-orb landing-orb-3" />
        <div className="landing-grid" />
      </div>

      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <SiatcLogoFull size={28} />
        </div>
        <button className="landing-login-btn" onClick={onLoginClick}>
          Iniciar sesión
        </button>
      </nav>

      {/* Hero */}
      <div className="landing-hero">
        <div className="landing-hero-icon">
          <SiatcHeroMark size={96} />
        </div>

        <div className="landing-badge">
          <span className="landing-badge-dot" />
          Sistema Integral de Atención al Cliente IA
        </div>

        <h1 className="landing-hero-title">
          El asistente inteligente<br />
          de <span>Grupo SOLE / Rinnai</span>
        </h1>

        <p className="landing-hero-subtitle">
          Consulta servicios, NPS, reportes y SAP C4C en lenguaje natural.
          Conectado en tiempo real a todos tus sistemas.
        </p>

        <div className="landing-cta-group">
          <button className="landing-cta-btn" onClick={onLoginClick}>
            Comenzar ahora
          </button>
          <span className="landing-cta-hint">Acceso solo para colaboradores SOLE</span>
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
