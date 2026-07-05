import React from 'react';
import { SiatcLogoFull } from './icons';

export default function Landing({ onLoginClick }) {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <SiatcLogoFull size={28} />
        </div>
        <button className="landing-login-btn" onClick={onLoginClick}>
          Iniciar sesión
        </button>
      </nav>

      <div className="landing-hero">
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
      </div>
    </div>
  );
}
