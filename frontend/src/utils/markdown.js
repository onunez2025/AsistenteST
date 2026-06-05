import { marked } from 'marked';
import DOMPurify from 'dompurify';

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

// Configure marked with custom link renderer and GFM features
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    link({ href, title, text }) {
      const fullUrl = href && href.startsWith('/') ? `${API_BASE_URL}${href}` : href;
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${fullUrl || ''}" target="_blank" rel="noopener noreferrer" class="chat-link"${titleAttr}>${text}</a>`;
    }
  }
});

/**
 * Parses markdown text into sanitized HTML, keeping custom link targets and wrapping tables.
 * @param {string} text - The raw markdown text.
 * @returns {string} The parsed and sanitized HTML.
 */
export const parseMarkdown = (text) => {
  if (!text) return '';
  
  // Parse markdown using configured marked
  const rawHtml = marked.parse(text);
  
  // Wrap tables in a responsive container to match App.jsx styling
  const wrappedHtml = rawHtml
    .replace(/<table>/g, '<div class="table-responsive"><table>')
    .replace(/<\/table>/g, '</table></div>');
  
  // Sanitize output, explicitly allowing target and rel attributes for links
  const cleanHtml = DOMPurify.sanitize(wrappedHtml, {
    ADD_ATTR: ['target', 'rel', 'class']
  });
  
  return cleanHtml;
};
