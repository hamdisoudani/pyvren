import { Marked, type RendererObject, type Tokens } from 'marked';
import { sanitizeHtml, slugify } from './security';

export interface MarkdownHeading {
  id: string;
  level: number;
  text: string;
}

export interface CompiledMarkdown {
  html: string;
  headings: MarkdownHeading[];
  wordCount: number;
  readingTimeMinutes: number;
}

function stripTagsAndDecodeBasicEntities(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function countProseWords(markdown: string): number {
  if (!markdown) return 0;

  // Strip fenced code blocks (``` or ~~~)
  const withoutFences = markdown
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, ' ');

  // Convert markdown images/links to their readable text and strip raw HTML/script blocks
  const prose = withoutFences
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/`([^`]+)`/g, ' $1 ');

  const tokens = prose.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token));
  return tokens.length;
}

export function compileMarkdown(markdown: string): CompiledMarkdown {
  const source = typeof markdown === 'string' ? markdown : '';
  const headings: MarkdownHeading[] = [];
  const seenIds = new Map<string, number>();

  const renderer: RendererObject = {
    heading({ tokens, depth, text }: Tokens.Heading): string {
      const innerHtml = this.parser.parseInline(tokens);
      const plainText = stripTagsAndDecodeBasicEntities(innerHtml) || text.trim();

      if (depth === 2 || depth === 3) {
        const baseId = slugify(plainText, 64) || `section-${headings.length + 1}`;
        const count = seenIds.get(baseId) ?? 0;
        seenIds.set(baseId, count + 1);
        const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
        headings.push({ id, level: depth, text: plainText });
        return `<h${depth} id="${id}">${innerHtml}</h${depth}>\n`;
      }

      return `<h${depth}>${innerHtml}</h${depth}>\n`;
    },
    image({ href, title, text }: Tokens.Image): string {
      const safeSrc = (href || '').trim();
      const safeAlt = stripTagsAndDecodeBasicEntities(text || '');
      const titleAttr = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
      return `<img class="editorial-img" src="${safeSrc.replace(/"/g, '&quot;')}" alt="${safeAlt.replace(/"/g, '&quot;')}"${titleAttr} loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
    },
    paragraph({ tokens }: Tokens.Paragraph): string {
      if (tokens.length === 1 && tokens[0].type === 'image') {
        const imgToken = tokens[0] as Tokens.Image;
        const safeSrc = (imgToken.href || '').trim();
        const captionText = stripTagsAndDecodeBasicEntities(imgToken.text || imgToken.title || '');
        const titleAttr = imgToken.title
          ? ` title="${imgToken.title.replace(/"/g, '&quot;')}"`
          : '';
        const captionHtml = captionText
          ? `<figcaption class="editorial-caption">${captionText
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</figcaption>`
          : '';
        return `<figure class="editorial-figure"><img class="editorial-img" src="${safeSrc.replace(/"/g, '&quot;')}" alt="${captionText.replace(/"/g, '&quot;')}"${titleAttr} loading="lazy" decoding="async" referrerpolicy="no-referrer">${captionHtml}</figure>\n`;
      }
      return `<p>${this.parser.parseInline(tokens)}</p>\n`;
    },
  };

  const instance = new Marked();
  instance.use({
    gfm: true,
    breaks: false,
    renderer,
  });

  const rawHtml = instance.parse(source, { async: false });
  const html = sanitizeHtml(rawHtml);
  const wordCount = countProseWords(source);
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 220));

  return {
    html,
    headings,
    wordCount,
    readingTimeMinutes,
  };
}
