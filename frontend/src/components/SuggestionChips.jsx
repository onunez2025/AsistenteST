import React from 'react';

const CHIPS = [
  { icon: '📋', text: '¿Cuántos servicios se cerraron hoy?' },
  { icon: '📊', text: 'NPS del mes actual vs meta 74.5' },
  { icon: '🏆', text: 'Técnicos con mayor eficiencia esta semana' },
  { icon: '⏳', text: 'Tickets pendientes por CAS' },
];

export default function SuggestionChips({ onSelect }) {
  return (
    <div className="suggestion-chips">
      {CHIPS.map((chip) => (
        <button
          key={chip.text}
          className="suggestion-chip"
          onClick={() => onSelect(chip.text)}
        >
          <span className="chip-icon">{chip.icon}</span>
          <span className="chip-text">{chip.text}</span>
        </button>
      ))}
    </div>
  );
}
