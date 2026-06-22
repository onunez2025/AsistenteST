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
        <h1 className="landing-hero-title">
          El asistente inteligente de<br />
          <span>Grupo SOLE / Rinnai</span>
        </h1>
        <p className="landing-hero-subtitle">
          Consulta servicios, NPS, reportes y SAP C4C en lenguaje natural. Conectado en tiempo real a tus sistemas.
        </p>
        <button className="landing-cta-btn" onClick={onLoginClick}>
          Comenzar
        </button>
      </div>
    </div>
  );
}
