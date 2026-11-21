import { getCategoryMeta } from '../lib/relations';
import { escapeHtml } from '../lib/security';

/**
 * Pyvren Brand Art & Custom Iconography
 *
 * Mascot identity — "Py", the house python:
 *  - One solid, geometric ink silhouette whose neck + head form a capital "P" and whose
 *    tail curls into the descender of a "y". The mark literally spells "Py", so the
 *    wordmark reads [snake]vren → Pyvren.
 *  - Python saddle markings, a big friendly eye (pointer-tracked when `live`), a brow,
 *    a smile line and a crimson forked tongue that flicks toward the "v".
 *  - Split into `.py-snake-stem` and `.py-snake-head` groups so CSS can sway the head,
 *    flick the tongue and blink the eye without any JS animation library.
 *
 * Every drawing is inline SVG driven by theme tokens, so it adapts to Light & Dark modes.
 */

export type UiIconKind =
  | 'pen'
  | 'clock'
  | 'calendar'
  | 'spark'
  | 'note'
  | 'ledger'
  | 'source'
  | 'external'
  | 'search'
  | 'chevron-down'
  | 'layers'
  | 'qa'
  | 'linkedin';

/* -------------------------------------------------------------------------- */
/* Py — canonical snake geometry (viewBox 0 0 68 74)                           */
/* -------------------------------------------------------------------------- */

export const PY_SNAKE_VIEWBOX = { width: 68, height: 74 } as const;

const PY_STEM_PATH =
  'M10.5 26 L21.5 26 L21.5 52 C21.5 62.5 15.5 70.5 7 70.5 C4 70.5 1.6 69 0.6 66.2 C3.6 67 7.2 66 8.8 62.6 C10 60 10.5 57 10.5 53 Z';
const PY_HEAD_PATH =
  'M10.5 40 L10.5 22 C10.5 11 19 3.5 31 3.5 C43.5 3.5 52.5 9.5 55.2 17.5 C57 23 54.2 28.6 47.6 30.2 C40.6 31.9 31.5 30.4 26.2 33.4 C23 35.2 21.5 38 21.5 42 Z';
const PY_TONGUE_PATH = 'M55.4 22.2 H61.5 M61.5 22.2 L66 18.8 M61.5 22.2 L66 25.6';

export interface SnakePalette {
  /** Body silhouette colour. */
  ink: string;
  /** "Negative space" colour used for markings, mouth & eye ring (usually the page background). */
  gap: string;
  /** Forked tongue colour. */
  tongue: string;
  sclera?: string;
  pupil?: string;
}

const THEME_SNAKE_PALETTE: SnakePalette = {
  ink: 'var(--snake-ink, var(--ink-primary))',
  gap: 'var(--snake-gap, var(--bg-canvas))',
  tongue: 'var(--snake-tongue, var(--accent))',
};

/**
 * Raw `<g>` markup for Py in the 68×74 coordinate space. Embed it inside any SVG with a
 * `transform` to place/scale it. `live` adds `data-snake-pupil` so the layout script can
 * make the eye follow the pointer.
 */
export function renderPySnakeFigure(palette: SnakePalette = THEME_SNAKE_PALETTE, live = false): string {
  const sclera = palette.sclera || '#FFFDF8';
  const pupil = palette.pupil || '#15171D';
  return `<g class="py-snake-stem">
      <path d="${PY_STEM_PATH}" fill="${palette.ink}"/>
      <g fill="${palette.gap}" opacity="0.9">
        <path d="M16 44 l2.6 3.2 -2.6 3.2 -2.6 -3.2z"/>
        <path d="M15.4 53.6 l2.4 3 -2.4 3 -2.4 -3z"/>
      </g>
    </g>
    <g class="py-snake-neck"><g class="py-snake-head">
      <path d="${PY_HEAD_PATH}" fill="${palette.ink}"/>
      <g fill="${palette.gap}">
        <path d="M16 34.5 l2.6 3.2 -2.6 3.2 -2.6 -3.2z" opacity="0.9"/>
        <path d="M15.6 16 l2.4 2.8 -2.4 2.8 -2.4 -2.8z" opacity="0.75"/>
        <path d="M21 8.6 l2.2 2.4 -2.2 2.4 -2.2 -2.4z" opacity="0.55"/>
        <circle cx="49.5" cy="14.6" r="1.1"/>
      </g>
      <path d="M53.6 23.4 C48 26.4 40.5 26.6 35.5 24.6" stroke="${palette.gap}" stroke-width="1.7" stroke-linecap="round"/>
      <path class="py-snake-brow" d="M28.6 8.4 C31.6 6.6 36.6 6.4 40.6 8.6" stroke="${palette.gap}" stroke-width="1.5" stroke-linecap="round"/>
      <g class="py-snake-eye">
        <circle cx="35" cy="14.8" r="5.6" fill="${sclera}" stroke="${palette.gap}" stroke-width="1.6"/>
        <g class="py-snake-pupil"${live ? ' data-snake-pupil' : ''}>
          <circle cx="36" cy="14.8" r="2.6" fill="${pupil}"/>
          <circle cx="37" cy="13.6" r="0.9" fill="${sclera}"/>
        </g>
      </g>
      <path class="py-snake-tongue" d="${PY_TONGUE_PATH}" stroke="${palette.tongue}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
    </g></g>`;
}

/**
 * Standalone Py mark (the "Py" in Pyvren). Height-driven; width follows the 68:74 ratio.
 */
export function renderPySnakeMark(opts: { height?: number; className?: string; live?: boolean; label?: string } = {}): string {
  const height = opts.height ?? 48;
  const width = Math.round((height * PY_SNAKE_VIEWBOX.width) / PY_SNAKE_VIEWBOX.height * 100) / 100;
  const a11y = opts.label
    ? `role="img" aria-label="${escapeHtml(opts.label)}"`
    : 'aria-hidden="true" focusable="false"';
  return `<svg class="py-snake-mark ${escapeHtml(opts.className || '')}" width="${width}" height="${height}" viewBox="0 0 68 74" fill="none" overflow="visible" ${a11y}>
    ${renderPySnakeFigure(THEME_SNAKE_PALETTE, Boolean(opts.live))}
  </svg>`;
}

/**
 * The masthead logo: [Py snake]vren. The snake replaces "Py"; "vren" is set in the display
 * serif with per-letter spans so CSS can stagger an entrance and a hover wave while the
 * snake tilts toward the letters and flicks its tongue at the "v".
 */
export function renderPyvrenWordmark(opts: { siteName: string; variant?: 'header' | 'footer'; href?: string }): string {
  const variant = opts.variant || 'header';
  const letters = ['v', 'r', 'e', 'n']
    .map((ch, i) => `<span class="pyvren-letter" style="--i:${i}">${ch}</span>`)
    .join('');
  return `<a href="${escapeHtml(opts.href || '/')}" class="pyvren-wordmark pyvren-wordmark--${variant}" data-pyvren-wordmark aria-label="Pyvren — ${escapeHtml(opts.siteName)} home">
    ${renderPySnakeMark({ className: 'pyvren-wordmark-mark', live: true })}
    <span class="pyvren-wordmark-text" aria-hidden="true">${letters}</span>
  </a>`;
}

/**
 * Compact square emblem (avatar / author cards): Py on a stamped paper tile.
 */
export function renderMastheadNibSvg(size = 34): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 44 44" fill="none" aria-hidden="true" class="pyvren-emblem-svg shrink-0 select-none">
    <rect x="1.5" y="1.5" width="41" height="41" rx="11" fill="var(--bg-surface)" stroke="var(--ink-primary)" stroke-width="1.8"/>
    <path d="M6 38.4 C15 39.6 29 39.6 38 38.4" stroke="var(--ink-primary)" stroke-opacity="0.12" stroke-width="2" stroke-linecap="round"/>
    <g transform="translate(8.6 5.2) scale(0.44)">
      ${renderPySnakeFigure({ ink: 'var(--ink-primary)', gap: 'var(--bg-surface)', tongue: 'var(--accent)' })}
    </g>
  </svg>`;
}

/**
 * Custom hand-drawn sketchbook SVG icons for each category beat (replaces all generic colored dots).
 */
export function renderTopicSketchIcon(slugOrAll: string, size = 18): string {
  const key = String(slugOrAll || '').trim().toLowerCase();
  const common = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="sketch-icon shrink-0"`;

  switch (key) {
    case 'ai-coding-agents-mcp':
      // Sketched terminal frame with mini Py-snake curve & >_ prompt
      return `<svg ${common}>
        <rect x="2.5" y="3.5" width="19" height="17" rx="4" fill="var(--bg-surface)" stroke="currentColor" stroke-width="1.85" stroke-linejoin="round"/>
        <path d="M6.5 9.5L9.8 12L6.5 14.5" stroke="var(--topic-accent, var(--accent))" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M11.8 14.8C13.2 13.2 15.2 16.2 17.2 14.2" stroke="currentColor" stroke-width="1.85" stroke-linecap="round"/>
        <circle cx="17.6" cy="9" r="1.2" fill="var(--topic-accent, var(--accent))"/>
      </svg>`;

    case 'ai-security-jailbreaks':
      // Hand-drawn keyhole shield with diagonal ink stroke
      return `<svg ${common}>
        <path d="M12 2.6L19.5 5.8V11.6C19.5 16.2 16.2 19.8 12 21.5C7.8 19.8 4.5 16.2 4.5 11.6V5.8L12 2.6Z" fill="var(--bg-surface)" stroke="currentColor" stroke-width="1.85" stroke-linejoin="round"/>
        <circle cx="12" cy="10.6" r="2" fill="var(--topic-accent, var(--accent))" stroke="currentColor" stroke-width="1.5"/>
        <path d="M12 12.6V16.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`;

    case 'ai-llms':
      // Hand-drawn stacked model layers + 4-point spark star
      return `<svg ${common}>
        <path d="M12 3.2L20 7.4L12 11.6L4 7.4L12 3.2Z" fill="var(--bg-surface)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M4.5 12.2L12 16.2L19.5 12.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6 16.6L12 19.8L18 16.6" stroke="var(--topic-accent, var(--accent))" stroke-width="1.95" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="7.4" r="1.4" fill="var(--topic-accent, var(--accent))"/>
      </svg>`;

    case 'cloud-gpu-infra':
      // Hand-drawn puffy edge cloud + jagged GPU lightning bolt
      return `<svg ${common}>
        <path d="M6.6 17.5C4.2 17.5 2.8 15.8 3.2 13.7C3.5 12 5 11 6.5 11.2C7.4 7.8 11.5 6.8 13.8 9.2C15.6 8.3 18.2 9.4 18.6 11.6C20.4 12 21.2 13.8 20.5 15.5C20 16.8 18.8 17.5 17.2 17.5H6.6Z" fill="var(--bg-surface)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M13 10.5L10.3 14.8H13.2L11.4 19.6L15.8 14.2H12.9L13 10.5Z" fill="var(--topic-accent, var(--accent))" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>
      </svg>`;

    case 'agentic-browser-web-data':
      // Hand-drawn explorer compass / web lens
      return `<svg ${common}>
        <circle cx="11" cy="11" r="7.2" fill="var(--bg-surface)" stroke="currentColor" stroke-width="1.85"/>
        <path d="M8.5 13.5L10.2 9.8L13.8 8.2L12.1 11.9L8.5 13.5Z" fill="var(--topic-accent, var(--accent))" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M16.4 16.4L20.6 20.6" stroke="var(--topic-accent, var(--accent))" stroke-width="2.3" stroke-linecap="round"/>
      </svg>`;

    case 'dev-tooling-benchmarks':
      // Hand-drawn spanner wrench + advisory check spark
      return `<svg ${common}>
        <path d="M14.8 4.2C12.7 4.7 11.4 6.8 11.9 8.9L5.1 15.7C4.2 16.6 4.2 18 5.1 18.9C6 19.8 7.4 19.8 8.3 18.9L15.1 12.1C17.2 12.6 19.3 11.3 19.8 9.2L17 11.2L14.8 9.2L16.8 6.4C16.2 5.1 15.6 4.5 14.8 4.2Z" fill="var(--bg-surface)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M6.2 6.5L7.6 7.9L10.2 5.2" stroke="var(--topic-accent, var(--accent))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    case 'generative-media-comfyui':
      // Hand-drawn cinema frame + ComfyUI connected workflow nodes
      return `<svg ${common}>
        <rect x="2.8" y="4.2" width="18.4" height="15.6" rx="3.4" fill="var(--bg-surface)" stroke="currentColor" stroke-width="1.85" stroke-linejoin="round"/>
        <path d="M2.8 8.4H21.2" stroke="currentColor" stroke-width="1.6"/>
        <path d="M7.2 4.2L9 8.4M12.6 4.2L14.4 8.4M17.2 4.2L18.6 8.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="8" cy="14.2" r="2" fill="var(--topic-accent, var(--accent))" stroke="currentColor" stroke-width="1.4"/>
        <circle cx="16.2" cy="14.2" r="2" fill="var(--bg-surface)" stroke="var(--topic-accent, var(--accent))" stroke-width="1.8"/>
        <path d="M10 14.2C11.8 14.2 12.4 14.2 14.2 14.2" stroke="var(--topic-accent, var(--accent))" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`;

    default:
      // 'all' / folded sketchbook newspaper dispatch
      return `<svg ${common}>
        <path d="M4 5.2C4 4.3 4.7 3.6 5.6 3.6H16.4C17.3 3.6 18 4.3 18 5.2V18.4C18 19.5 18.8 20.2 19.6 20.2H6.4C4.9 20.2 4 19.1 4 17.6V5.2Z" fill="var(--bg-surface)" stroke="currentColor" stroke-width="1.85" stroke-linejoin="round"/>
        <path d="M18 8.5H20.2C20.8 8.5 21.2 9 21.2 9.6V18.2C21.2 19.4 20.4 20.2 19.3 20.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="7.5" y1="8.2" x2="14.5" y2="8.2" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
        <line x1="7.5" y1="12" x2="14.5" y2="12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        <line x1="7.5" y1="15.5" x2="12.2" y2="15.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>`;
  }
}

/**
 * Hand-drawn editorial micro-icons for bylines, timestamps, callouts, references, and controls.
 */
export function renderUiSketchIcon(kind: UiIconKind, size = 15): string {
  const common = `width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true" class="inline-block shrink-0"`;
  switch (kind) {
    case 'pen':
      return `<svg ${common}><path d="M3.2 16.8L5.6 9.8L12.9 2.8L17.2 7.1L10.2 14.4L3.2 16.8Z" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/><path d="M3.4 16.6L8.4 11.6" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="10.8" r="1.1" fill="var(--accent)"/></svg>`;
    case 'clock':
      return `<svg ${common}><circle cx="10" cy="10.5" r="6.8" stroke="currentColor" stroke-width="1.65"/><path d="M8 2.2H12" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/><path d="M10 7V10.6L12.6 12.2" stroke="var(--accent)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'calendar':
      return `<svg ${common}><rect x="2.8" y="4.2" width="14.4" height="13" rx="2.6" stroke="currentColor" stroke-width="1.6"/><path d="M2.8 8.2H17.2M6.6 2.5V5.4M13.4 2.5V5.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="6.2" y="10.8" width="2.6" height="2.6" rx="0.6" fill="var(--accent)"/></svg>`;
    case 'spark':
      return `<svg ${common}><path d="M10 2L12.1 7.6L18 9.8L12.1 12L10 17.8L7.9 12L2 9.8L7.9 7.6L10 2Z" fill="var(--accent)" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/></svg>`;
    case 'note':
      return `<svg ${common}><path d="M4.2 3H15.8V17L10 13.4L4.2 17V3Z" fill="var(--bg-elevated)" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/><path d="M7.5 7.4H12.5" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    case 'ledger':
      return `<svg ${common}><rect x="2.8" y="3.2" width="14.4" height="13.6" rx="2.4" stroke="currentColor" stroke-width="1.65"/><path d="M2.8 7.8H17.2M8.2 7.8V16.8" stroke="currentColor" stroke-width="1.55"/><circle cx="5.5" cy="5.5" r="1" fill="var(--accent)"/></svg>`;
    case 'source':
      return `<svg ${common}><path d="M8.2 11.8L11.8 8.2M6.4 13.6L5.1 14.9C3.8 16.2 3.8 18.1 5.1 19.2" stroke="var(--accent)" stroke-width="1.75" stroke-linecap="round"/><path d="M7.4 12.6L5.7 14.3C4.3 15.7 4.3 17.9 5.7 19.3" stroke="none"/><path d="M11.2 6.2L12.9 4.5C14.2 3.2 16.3 3.2 17.6 4.5C18.9 5.8 18.9 7.9 17.6 9.2L15.9 10.9M8.8 13.8L7.1 15.5C5.8 16.8 3.7 16.8 2.4 15.5C1.1 14.2 1.1 12.1 2.4 10.8L4.1 9.1" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/></svg>`;
    case 'external':
      return `<svg ${common}><path d="M6 14L14.5 5.5M8.5 5.5H14.5V11.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'search':
      return `<svg ${common}><circle cx="9" cy="9" r="5.8" stroke="currentColor" stroke-width="1.75"/><path d="M13.4 13.4L17.2 17.2" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg>`;
    case 'chevron-down':
      return `<svg ${common}><path d="M5.2 7.8L10 12.6L14.8 7.8" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'layers':
      return `<svg ${common}><path d="M10 3L17.2 6.8L10 10.6L2.8 6.8L10 3Z" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/><path d="M3.2 10.8L10 14.4L16.8 10.8M3.2 14.2L10 17.8L16.8 14.2" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'qa':
      return `<svg ${common}><path d="M3.2 4.8C3.2 3.8 4 3 5 3H15C16 3 16.8 3.8 16.8 4.8V12.2C16.8 13.2 16 14 15 14H8.6L4.6 17V14H5C4 14 3.2 13.2 3.2 12.2V4.8Z" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/><path d="M8.5 7.2C8.8 6.2 11.2 6.2 11.4 7.5C11.6 8.6 10 8.9 10 10" stroke="var(--accent)" stroke-width="1.7" stroke-linecap="round"/><circle cx="10" cy="12" r="0.9" fill="var(--accent)"/></svg>`;
    case 'linkedin':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="inline-block shrink-0"><path d="M19 3A2 2 0 0 1 21 5V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H19M18.5 18.5V13.2A3.26 3.26 0 0 0 15.24 9.94C14.39 9.94 13.4 10.46 12.92 11.24V10.13H10.13V18.5H12.92V13.57C12.92 12.8 13.54 12.17 14.31 12.17A1.4 1.4 0 0 1 15.71 13.57V18.5H18.5M6.88 8.56A1.68 1.68 0 0 0 8.56 6.88C8.56 5.95 7.81 5.19 6.88 5.19A1.69 1.69 0 0 0 5.19 6.88C5.19 7.81 5.95 8.56 6.88 8.56M8.27 18.5V10.13H5.5V18.5H8.27Z"/></svg>`;
  }
}


/** Deterministic small hash → seconds offset so many snakes on one page never flick in sync. */
function animationDelayFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `${((h % 4000) / 1000 + 0.6).toFixed(2)}s`;
}

/**
 * Hero studio scene: Py rises over the desk, tongue pointed at a syntax-coloured terminal,
 * with a "typing" bubble (research in progress), a steaming mug and a stack of notebooks.
 */
export function renderHeroCrewSceneSvg(): string {
  return `<svg viewBox="0 0 400 282" width="100%" height="100%" fill="none" role="img" aria-label="Py, the Pyvren house python, researching a story at a terminal" class="crew-hero-svg pyvren-mascot-svg select-none">
    <defs>
      <pattern id="pyv-hero-dots" width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.95" fill="var(--ink-primary)" fill-opacity="0.13"/>
      </pattern>
    </defs>

    <rect x="6" y="6" width="388" height="270" rx="16" fill="url(#pyv-hero-dots)"/>

    <!-- drifting ink stars & code glyphs -->
    <g class="crew-float-slow" stroke="var(--ink-primary)" stroke-width="1.7" stroke-linejoin="round">
      <path d="M30 38 L33 46 L41 49 L33 52 L30 60 L27 52 L19 49 L27 46 Z" fill="var(--accent)"/>
      <path d="M366 30 L368 36 L374 38 L368 40 L366 46 L364 40 L358 38 L364 36 Z" fill="var(--bg-surface)"/>
    </g>
    <text class="crew-bob-delayed" x="292" y="58" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="15" font-weight="600" fill="var(--ink-muted)">{ }</text>

    <!-- Terminal -->
    <g transform="translate(222 84)" stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M58 108 L53 138 L97 138 L92 108 Z" fill="var(--bg-elevated)"/>
      <rect x="0" y="0" width="150" height="108" rx="11" fill="#15171D"/>
      <path d="M0 11 C0 5 5 0 11 0 H139 C145 0 150 5 150 11 V22 H0 Z" fill="#20242E"/>
      <line x1="0" y1="22" x2="150" y2="22"/>
      <circle cx="13" cy="11" r="2.7" fill="#EF5350" stroke="none"/>
      <circle cx="23" cy="11" r="2.7" fill="#F59E0B" stroke="none"/>
      <circle cx="33" cy="11" r="2.7" fill="#34D399" stroke="none"/>
      <text x="137" y="14.5" text-anchor="end" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="8" font-weight="600" fill="#9CA3AF" stroke="none">sources.py</text>
      <g stroke-width="3" stroke-linecap="round">
        <line x1="14" y1="38" x2="34" y2="38" stroke="#FF7B72"/>
        <line x1="42" y1="38" x2="90" y2="38" stroke="#79C0FF"/>
        <line x1="24" y1="51" x2="54" y2="51" stroke="#D2A8FF"/>
        <line x1="62" y1="51" x2="124" y2="51" stroke="#A5D6FF"/>
        <line x1="24" y1="64" x2="48" y2="64" stroke="#FF7B72"/>
        <line x1="56" y1="64" x2="108" y2="64" stroke="#7EE787"/>
        <line x1="14" y1="77" x2="74" y2="77" stroke="#FFA657"/>
        <line x1="82" y1="77" x2="128" y2="77" stroke="#79C0FF"/>
      </g>
      <rect class="crew-cursor" x="14" y="86" width="7" height="11" rx="1" fill="#7EE787" stroke="none"/>
    </g>

    <!-- Typing bubble: Py is reading the sources -->
    <g transform="translate(150 22)">
      <path d="M10 0 H52 C57.5 0 62 4.5 62 10 V22 C62 27.5 57.5 32 52 32 H22 L10 42 L13 32 H10 C4.5 32 0 27.5 0 22 V10 C0 4.5 4.5 0 10 0 Z" fill="var(--bg-surface)" stroke="var(--ink-primary)" stroke-width="2" stroke-linejoin="round"/>
      <circle class="typing-dot" cx="19" cy="16" r="3.4" fill="var(--ink-primary)"/>
      <circle class="typing-dot" cx="31" cy="16" r="3.4" fill="var(--ink-primary)" style="animation-delay:.18s"/>
      <circle class="typing-dot" cx="43" cy="16" r="3.4" fill="var(--accent)" style="animation-delay:.36s"/>
    </g>

    <!-- Desk -->
    <ellipse cx="62" cy="223.5" rx="36" ry="3.6" fill="var(--ink-primary)" fill-opacity="0.12"/>
    <line x1="16" y1="222" x2="384" y2="222" stroke="var(--ink-primary)" stroke-width="2.6" stroke-linecap="round"/>
    <line x1="42" y1="229" x2="358" y2="229" stroke="var(--ink-primary)" stroke-opacity="0.2" stroke-width="1.5" stroke-linecap="round"/>

    <!-- Mug with steam -->
    <g transform="translate(176 196)" stroke="var(--ink-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path class="crew-steam" d="M7 -6 C4 -10 10 -13 7 -18 M15 -6 C12 -10 18 -13 15 -18" stroke-opacity="0.45"/>
      <path d="M0 0 H22 V20 C22 23 20 26 17 26 H5 C2 26 0 23 0 20 Z" fill="var(--bg-surface)"/>
      <path d="M22 6 C29 6 29 17 22 17" fill="none"/>
      <line x1="5" y1="9" x2="17" y2="9" stroke="var(--accent)" stroke-width="2.2"/>
    </g>

    <!-- Notebooks -->
    <g transform="translate(322 204)" stroke="var(--ink-primary)" stroke-width="1.9" stroke-linejoin="round">
      <rect x="0" y="9" width="52" height="9" rx="2" fill="var(--bg-elevated)"/>
      <rect x="4" y="0" width="44" height="9" rx="2" fill="var(--bg-surface)"/>
      <line x1="10" y1="4.5" x2="30" y2="4.5" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/>
    </g>

    <!-- Py, the house python -->
    <g transform="translate(40 54) scale(2.35)" class="hero-py" style="--py-delay:1.1s">
      ${renderPySnakeFigure(THEME_SNAKE_PALETTE, true)}
    </g>

    <!-- Hand-lettered caption with arrow -->
    <path d="M92 252 C78 251 68 244 64 234 M64 234 L61.5 241 M64 234 L70 238" stroke="var(--ink-muted)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="98" y="256" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="10" font-weight="500" letter-spacing="0.3" fill="var(--ink-muted)">py — our house python · reads every source</text>
  </svg>`;
}

/**
 * Category scene: Py beside a beat-specific prop. Used on topic cards and as the automatic
 * backup illustration whenever a post image doesn't exist or fails to load.
 */
export function renderTopicCrewSvg(categorySlug: string, instanceKey = 't'): string {
  const slug = String(categorySlug || '').trim().toLowerCase();
  const safeId = escapeHtml(`${slug}-${instanceKey}`.replace(/[^a-z0-9_-]/gi, ''));
  const hatchId = `pyv-hatch-${safeId}`;

  let propSvg = '';
  switch (slug) {
    case 'ai-coding-agents-mcp':
      propSvg = `
        <g transform="translate(116, 48)" stroke="var(--ink-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="0" y="0" width="54" height="44" rx="7" fill="#16181F"/>
          <path d="M9 15 L15 20 L9 25" stroke="#FF7B72" stroke-width="2.2"/>
          <line x1="19" y1="25" x2="40" y2="25" stroke="#79C0FF" stroke-width="2.2"/>
          <line x1="9" y1="34" x2="44" y2="34" stroke="#7EE787" stroke-width="1.9"/>
          <path d="M22 44 L19 58 H35 L32 44" fill="var(--bg-elevated)"/>
        </g>`;
      break;
    case 'ai-security-jailbreaks':
      propSvg = `
        <g transform="translate(142, 74)" stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M0 -28 L22 -18 V2 C22 16 12 26 0 32 C-12 26 -22 16 -22 2 V-18 Z" fill="var(--bg-elevated)"/>
          <circle cx="0" cy="-4" r="4.2" fill="var(--topic-accent, var(--accent))" stroke-width="1.7"/>
          <path d="M0 0 V11" stroke-width="2.3"/>
        </g>`;
      break;
    case 'ai-llms':
      propSvg = `
        <g transform="translate(142, 80)" stroke="var(--ink-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="-24" y="8" width="48" height="12" rx="3" fill="var(--bg-elevated)"/>
          <rect x="-19" y="-6" width="38" height="12" rx="3" fill="var(--bg-surface)"/>
          <rect x="-14" y="-20" width="28" height="12" rx="3" fill="url(#${hatchId})"/>
          <path d="M0 -38 L3 -30 L11 -27 L3 -24 L0 -16 L-3 -24 L-11 -27 L-3 -30 Z" fill="var(--topic-accent, var(--accent))" stroke-width="1.6"/>
        </g>`;
      break;
    case 'cloud-gpu-infra':
      propSvg = `
        <g transform="translate(142, 70)" stroke="var(--ink-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M-19 17 C-27 17 -29 7 -21 3 C-19 -7 -6 -9 0 -2 C7 -9 20 -6 21 4 C28 7 26 17 18 17 Z" fill="var(--bg-elevated)"/>
          <path d="M4 -22 L-6 -1 H3 L-3 17 L13 -4 H4 Z" fill="var(--topic-accent, var(--accent))" stroke-width="1.8"/>
        </g>`;
      break;
    case 'agentic-browser-web-data':
      propSvg = `
        <g transform="translate(142, 68)" stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round">
          <circle cx="0" cy="0" r="19" fill="var(--bg-elevated)"/>
          <ellipse cx="0" cy="0" rx="8.5" ry="19" fill="none" stroke-opacity="0.5"/>
          <line x1="-19" y1="0" x2="19" y2="0" stroke-opacity="0.5"/>
          <line x1="14" y1="14" x2="25" y2="25" stroke="var(--topic-accent, var(--accent))" stroke-width="3.2"/>
        </g>`;
      break;
    case 'generative-media-comfyui':
      propSvg = `
        <g transform="translate(116, 48)" stroke="var(--ink-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="0" y="6" width="52" height="38" rx="6" fill="var(--bg-elevated)"/>
          <line x1="0" y1="16" x2="52" y2="16" stroke-width="1.9"/>
          <line x1="12" y1="6" x2="17" y2="16" stroke-width="1.8"/>
          <line x1="25" y1="6" x2="30" y2="16" stroke-width="1.8"/>
          <line x1="38" y1="6" x2="43" y2="16" stroke-width="1.8"/>
          <circle cx="15" cy="30" r="5" fill="var(--topic-accent, var(--accent))"/>
          <circle cx="37" cy="30" r="5" fill="var(--bg-surface)" stroke="var(--topic-accent, var(--accent))" stroke-width="2.2"/>
          <path d="M20 30 H32" stroke="var(--topic-accent, var(--accent))" stroke-width="2.2"/>
        </g>`;
      break;
    default:
      propSvg = `
        <g transform="translate(142, 72)" stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="-19" y="-19" width="38" height="38" rx="9" fill="var(--bg-elevated)"/>
          <path d="M-7 0 L-1 6 L9 -6" stroke="var(--topic-accent, var(--accent))" stroke-width="2.7"/>
        </g>`;
      break;
  }

  return `<svg viewBox="0 0 184 124" width="100%" height="100%" fill="none" aria-hidden="true" class="crew-topic-svg pyvren-mascot-svg select-none">
    <defs>
      <pattern id="${hatchId}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-primary)" stroke-width="1.1" stroke-opacity="0.22"/>
      </pattern>
    </defs>
    <ellipse cx="38" cy="112.5" rx="22" ry="2.6" fill="var(--ink-primary)" fill-opacity="0.12"/>
    <line x1="12" y1="112" x2="172" y2="112" stroke="var(--ink-primary)" stroke-width="2" stroke-linecap="round" stroke-opacity="0.7"/>
    ${propSvg}
    <g transform="translate(18 26) scale(1.2)" style="--py-delay:${animationDelayFor(safeId)}">
      ${renderPySnakeFigure(THEME_SNAKE_PALETTE, true)}
    </g>
  </svg>`;
}

/**
 * Standalone SVG document for `/og/fallback.svg` so ANY broken `<img>` (even inside compiled
 * Markdown prose) can swap its `src` to Py. Carries its own light/dark palette because it
 * renders outside the page's CSS.
 */
export function renderStandalonePyvrenFallbackSvg(categorySlug = '', label = 'Pyvren'): string {
  const meta = getCategoryMeta(categorySlug || 'ai-coding-agents-mcp');
  const safeLabel = escapeHtml((label || meta.navLabel || 'Pyvren').slice(0, 48));
  const safeBeat = escapeHtml(meta.shortLabel);
  const palette: SnakePalette = { ink: 'var(--ink)', gap: 'var(--paper)', tongue: 'var(--accent)' };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600" fill="none">
  <style>
    :root {
      --ink: #171512;
      --paper: #FAF5EA;
      --surface: #FFFDF8;
      --elevated: #F2EBD9;
      --muted: #625A4E;
      --border: #DDD2BE;
      --accent: ${meta.color};
      --bg-surface: var(--surface);
      --topic-accent: var(--accent);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --ink: #F3EFE6;
        --paper: #12141A;
        --surface: #1A1D26;
        --elevated: #232836;
        --muted: #9D9689;
        --border: #2E3444;
        --accent: ${meta.darkColor};
      }
    }
  </style>
  <defs>
    <pattern id="fb-dots" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1.2" fill="var(--ink)" fill-opacity="0.1"/>
    </pattern>
  </defs>

  <rect width="960" height="600" fill="var(--paper)"/>
  <rect x="24" y="24" width="912" height="552" rx="24" fill="url(#fb-dots)" stroke="var(--border)" stroke-width="2"/>

  <g transform="translate(56, 56)">
    <rect x="0" y="0" width="220" height="36" rx="10" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>
    <text x="110" y="23" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" font-weight="700" letter-spacing="1.2" fill="var(--accent)">${safeBeat}</text>
  </g>

  <ellipse cx="300" cy="420" rx="92" ry="9" fill="var(--ink)" fill-opacity="0.1"/>
  <line x1="150" y1="418" x2="810" y2="418" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>
  <line x1="220" y1="432" x2="740" y2="432" stroke="var(--ink)" stroke-opacity="0.22" stroke-width="2.5" stroke-linecap="round"/>

  <g transform="translate(612 192)" style="color: var(--ink)">
    ${renderTopicSketchIcon(categorySlug || 'all', 170)}
  </g>

  <g transform="translate(252 122) scale(4.1)">
    ${renderPySnakeFigure(palette)}
  </g>

  <text x="480" y="512" text-anchor="middle" font-family="Georgia, Cambria, serif" font-size="24" font-weight="700" fill="var(--ink)">${safeLabel}</text>
  <text x="480" y="540" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" letter-spacing="1.6" fill="var(--muted)">PYVREN · ILLUSTRATED EDITION</text>
</svg>`;
}

/**
 * Visual media frame for post cards and article headers:
 *  - Base layer: Py category illustration (always present — the automatic backup image).
 *  - Skeleton layer (only when a real image exists): shimmer shown while the image loads.
 *  - Top layer: the crawled reference image, invisible until it has actually loaded. The
 *    early <head> script marks the frame `media-ready` on load or `media-fallback` on error
 *    (removing the broken <img>), so a broken icon or alt text can never show.
 */
export function renderStoryCoverMedia(opts: {
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  categorySlug: string;
  archetype?: string;
  title: string;
  instanceKey: string;
  aspectClass?: string;
  eager?: boolean;
}): string {
  const catMeta = getCategoryMeta(opts.categorySlug);
  const aspectClass = opts.aspectClass || 'aspect-[16/10]';
  const archetypeLabel = (opts.archetype || 'dispatch').replace(/-/g, ' ');
  const crewArt = renderTopicCrewSvg(opts.categorySlug, opts.instanceKey);
  const topicIcon = renderTopicSketchIcon(opts.categorySlug, 14);
  const hasRealImage = Boolean(opts.coverImageUrl && opts.coverImageUrl.trim().startsWith('https://'));
  const altText = (opts.coverImageAlt || opts.title || 'Story illustration').trim();

  return `<div class="story-media relative ${aspectClass} w-full overflow-hidden${hasRealImage ? ' has-cover' : ''}" style="--topic-light:${catMeta.color}; --topic-dark:${catMeta.darkColor};">
    <div class="story-crew-plate absolute inset-0 flex flex-col justify-between p-3.5 sm:p-4">
      <div class="flex items-center justify-between gap-2">
        <span class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--topic-accent)]">
          ${topicIcon}
          <span>${escapeHtml(catMeta.shortLabel)}</span>
        </span>
        <span class="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">${escapeHtml(archetypeLabel)}</span>
      </div>
      <div class="story-crew-art mx-auto h-[78%] max-w-full aspect-[184/124]">
        ${crewArt}
      </div>
    </div>
    ${
      hasRealImage
        ? `<div class="media-skeleton skeleton-shimmer absolute inset-0 z-[5]" aria-hidden="true">
            <span class="media-skeleton-mark">${renderPySnakeMark({ height: 34 })}</span>
          </div>
          <img
            src="${escapeHtml(opts.coverImageUrl!.trim())}"
            alt="${escapeHtml(altText)}"
            loading="${opts.eager ? 'eager' : 'lazy'}"
            ${opts.eager ? 'fetchpriority="high"' : ''}
            decoding="async"
            referrerpolicy="no-referrer"
            data-story-cover="1"
            data-fallback-category="${escapeHtml(opts.categorySlug)}"
            class="story-real-img absolute inset-0 z-10 h-full w-full object-cover"
          />`
        : ''
    }
  </div>`;
}
