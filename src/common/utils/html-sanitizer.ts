import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

const ALLOWED_TAGS = [
  'p', 'br', 'div', 'section', 'article',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'strong', 'em',
  'span', 'blockquote', 'pre', 'code', 'img',
];

const ALLOWED_ATTR = ['href', 'class', 'id', 'data-affiliate', 'src', 'alt', 'title'];

export function sanitizeHtml(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
  });
}
