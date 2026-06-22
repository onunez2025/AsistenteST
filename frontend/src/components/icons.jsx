import React from 'react';

/* ─── SIATC.IA LOGO MARK (icon cuadrado 40×40) ─── */
export const SiatcLogoMark = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mark-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4C5F80"/>
        <stop offset="1" stopColor="#2C3A56"/>
      </linearGradient>
      <linearGradient id="mark-accent" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#E93333"/>
        <stop offset="1" stopColor="#FF6B6B"/>
      </linearGradient>
      <filter id="mark-glow">
        <feGaussianBlur stdDeviation="1.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    {/* Background rounded square */}
    <rect width="40" height="40" rx="10" fill="url(#mark-bg)"/>
    {/* Subtle inner border glow */}
    <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="9.5" stroke="white" strokeWidth="0.5" opacity="0.15"/>
    {/* Connection lines (neural network) */}
    <line x1="20" y1="10" x2="11" y2="22" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="20" y1="10" x2="29" y2="22" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="11" y1="22" x2="29" y2="22" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="11" y1="22" x2="20" y2="32" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="29" y1="22" x2="20" y2="32" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="20" y1="10" x2="20" y2="32" stroke="white" strokeWidth="0.75" opacity="0.2"/>
    {/* Outer nodes */}
    <circle cx="20" cy="10" r="2.5" fill="white" opacity="0.85"/>
    <circle cx="11" cy="22" r="2.5" fill="white" opacity="0.85"/>
    <circle cx="29" cy="22" r="2.5" fill="white" opacity="0.85"/>
    <circle cx="20" cy="32" r="2.5" fill="white" opacity="0.7"/>
    {/* Center node — accent */}
    <circle cx="20" cy="20" r="4" fill="url(#mark-accent)" filter="url(#mark-glow)"/>
    <circle cx="20" cy="20" r="2" fill="white"/>
  </svg>
);

/* ─── SIATC.IA LOGO FULL (icon + wordmark) ─── */
export const SiatcLogoFull = ({ size = 32, textColor = 'currentColor' }) => (
  <svg width={size * 5.2} height={size} viewBox="0 0 186 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="full-bg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4C5F80"/>
        <stop offset="1" stopColor="#2C3A56"/>
      </linearGradient>
      <linearGradient id="full-accent" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop stopColor="#E93333"/>
        <stop offset="1" stopColor="#FF6B6B"/>
      </linearGradient>
    </defs>
    {/* Icon mark */}
    <rect width="36" height="36" rx="9" fill="url(#full-bg)"/>
    <rect x="0.75" y="0.75" width="34.5" height="34.5" rx="8.5" stroke="white" strokeWidth="0.5" opacity="0.15"/>
    <line x1="18" y1="9" x2="10" y2="20" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="18" y1="9" x2="26" y2="20" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="10" y1="20" x2="26" y2="20" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="10" y1="20" x2="18" y2="29" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="26" y1="20" x2="18" y2="29" stroke="white" strokeWidth="1" opacity="0.3"/>
    <circle cx="18" cy="9" r="2.2" fill="white" opacity="0.85"/>
    <circle cx="10" cy="20" r="2.2" fill="white" opacity="0.85"/>
    <circle cx="26" cy="20" r="2.2" fill="white" opacity="0.85"/>
    <circle cx="18" cy="29" r="2.2" fill="white" opacity="0.65"/>
    <circle cx="18" cy="18" r="3.5" fill="url(#full-accent)"/>
    <circle cx="18" cy="18" r="1.75" fill="white"/>
    {/* Wordmark */}
    <text x="46" y="24" fontFamily="Lato, 'Google Sans', sans-serif" fontWeight="900" fontSize="18" letterSpacing="0.5" fill={textColor}>SIATC</text>
    <text x="117" y="24" fontFamily="Lato, 'Google Sans', sans-serif" fontWeight="300" fontSize="18" fill="#4C5F80">.IA</text>
  </svg>
);

/* ─── SIATC.IA HERO LOGO (para landing grande) ─── */
export const SiatcHeroMark = ({ size = 80 }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hero-bg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4C5F80"/>
        <stop offset="0.5" stopColor="#3A4E70"/>
        <stop offset="1" stopColor="#2C3A56"/>
      </linearGradient>
      <linearGradient id="hero-accent" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
        <stop stopColor="#E93333"/>
        <stop offset="1" stopColor="#FF8A8A"/>
      </linearGradient>
      <filter id="hero-glow">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="hero-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" floodColor="#4C5F80" floodOpacity="0.5"/>
      </filter>
    </defs>
    {/* Shadow */}
    <rect width="80" height="80" rx="20" fill="url(#hero-bg)" filter="url(#hero-shadow)"/>
    {/* Background */}
    <rect width="80" height="80" rx="20" fill="url(#hero-bg)"/>
    {/* Subtle grid overlay */}
    <rect x="1" y="1" width="78" height="78" rx="19" stroke="white" strokeWidth="1" opacity="0.12"/>
    {/* Neural connections */}
    <line x1="40" y1="18" x2="22" y2="42" stroke="white" strokeWidth="1.5" opacity="0.25"/>
    <line x1="40" y1="18" x2="58" y2="42" stroke="white" strokeWidth="1.5" opacity="0.25"/>
    <line x1="22" y1="42" x2="58" y2="42" stroke="white" strokeWidth="1.5" opacity="0.25"/>
    <line x1="22" y1="42" x2="40" y2="62" stroke="white" strokeWidth="1.5" opacity="0.25"/>
    <line x1="58" y1="42" x2="40" y2="62" stroke="white" strokeWidth="1.5" opacity="0.25"/>
    <line x1="40" y1="18" x2="40" y2="62" stroke="white" strokeWidth="1" opacity="0.15"/>
    {/* Secondary connections */}
    <line x1="22" y1="42" x2="40" y2="18" stroke="white" strokeWidth="0.75" opacity="0.15" strokeDasharray="2 3"/>
    <line x1="58" y1="42" x2="40" y2="62" stroke="white" strokeWidth="0.75" opacity="0.15" strokeDasharray="2 3"/>
    {/* Outer nodes */}
    <circle cx="40" cy="18" r="5" fill="white" opacity="0.9"/>
    <circle cx="22" cy="42" r="5" fill="white" opacity="0.9"/>
    <circle cx="58" cy="42" r="5" fill="white" opacity="0.9"/>
    <circle cx="40" cy="62" r="4" fill="white" opacity="0.7"/>
    {/* Center accent node */}
    <circle cx="40" cy="40" r="10" fill="url(#hero-accent)" filter="url(#hero-glow)"/>
    <circle cx="40" cy="40" r="5.5" fill="white"/>
    <circle cx="40" cy="40" r="2" fill="url(#hero-accent)"/>
  </svg>
);

/* ─── LEGACY BotSparkleIcon (mantiene compatibilidad) ─── */
export const BotSparkleIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bot-bg-u" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4C5F80"/>
        <stop offset="1" stopColor="#2C3A56"/>
      </linearGradient>
      <linearGradient id="bot-acc-u" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#E93333"/>
        <stop offset="1" stopColor="#FF6B6B"/>
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="10" fill="url(#bot-bg-u)"/>
    <line x1="20" y1="10" x2="11" y2="22" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="20" y1="10" x2="29" y2="22" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="11" y1="22" x2="29" y2="22" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="11" y1="22" x2="20" y2="32" stroke="white" strokeWidth="1" opacity="0.3"/>
    <line x1="29" y1="22" x2="20" y2="32" stroke="white" strokeWidth="1" opacity="0.3"/>
    <circle cx="20" cy="10" r="2.5" fill="white" opacity="0.85"/>
    <circle cx="11" cy="22" r="2.5" fill="white" opacity="0.85"/>
    <circle cx="29" cy="22" r="2.5" fill="white" opacity="0.85"/>
    <circle cx="20" cy="32" r="2.5" fill="white" opacity="0.65"/>
    <circle cx="20" cy="20" r="4" fill="url(#bot-acc-u)"/>
    <circle cx="20" cy="20" r="2" fill="white"/>
  </svg>
);

/* ─── otros iconos de utilidad ─── */
export const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
);
export const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
);
export const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
);
export const PaperclipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
);
export const BookOpenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
);
export const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
export const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
);
export const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
);
export const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
);
export const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
export const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
);
export const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
);
export const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
);
export const ImageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
);
