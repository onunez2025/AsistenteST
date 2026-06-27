import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    link({ href, title, text }) {
      const fullUrl = href && href.startsWith('/') ? `${API_BASE_URL}${href}` : href;
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${fullUrl || ''}" target="_blank" rel="noopener noreferrer" class="chat-link"${titleAttr}>${text}</a>`;
    },
    code({ text, lang }) {
      const validLang = lang && hljs.getLanguage(lang) ? lang : '';
      const highlighted = validLang
        ? hljs.highlight(text, { language: validLang }).value
        : hljs.highlightAuto(text).value;
      const langLabel = validLang || 'código';
      return `<div class="code-block">
        <div class="code-block-header">
          <span class="code-lang">${langLabel}</span>
          <button class="code-copy-btn">Copiar</button>
        </div>
        <pre><code class="hljs${validLang ? ` language-${validLang}` : ''}">${highlighted}</code></pre>
      </div>`;
    }
  }
});

export const parseMarkdown = (text) => {
  if (!text) return '';
  const rawHtml = marked.parse(text);
  const wrappedHtml = rawHtml
    .replace(/<table>/g, '<div class="table-responsive"><table>')
    .replace(/<\/table>/g, '</table></div>');
  return DOMPurify.sanitize(wrappedHtml, {
    ADD_ATTR: ['target', 'rel', 'class'],
  });
};
