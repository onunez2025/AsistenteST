import React, { useState } from 'react';
import { Copy, Check, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';

export default function MessageActions({ messageContent, onRegenerate, isLastAiMessage }) {
  const [copied,    setCopied]    = useState(false);
  const [thumbUp,   setThumbUp]   = useState(false);
  const [thumbDown, setThumbDown] = useState(false);

  const handleCopy = async () => {
    try {
      const plain = (messageContent || '').replace(/<[^>]+>/g, '');
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  const handleThumbUp = () => { setThumbUp(v => !v); setThumbDown(false); };
  const handleThumbDown = () => { setThumbDown(v => !v); setThumbUp(false); };

  return (
    <div className="message-actions">
      <button
        className={`msg-action-btn${copied ? ' copied' : ''}`}
        onClick={handleCopy}
        title={copied ? '¡Copiado!' : 'Copiar respuesta'}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
      <button
        className={`msg-action-btn${thumbUp ? ' active-thumb' : ''}`}
        onClick={handleThumbUp}
        title="Buena respuesta"
      >
        <ThumbsUp size={15} />
      </button>
      <button
        className={`msg-action-btn${thumbDown ? ' active-thumb' : ''}`}
        onClick={handleThumbDown}
        title="Mala respuesta"
      >
        <ThumbsDown size={15} />
      </button>
      {isLastAiMessage && onRegenerate && (
        <button
          className="msg-action-btn"
          onClick={onRegenerate}
          title="Regenerar respuesta"
        >
          <RefreshCw size={15} />
        </button>
      )}
    </div>
  );
}
