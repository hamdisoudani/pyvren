import { getCategoryMeta } from '../lib/relations';
import { escapeHtml } from '../lib/security';

/**
 * Pyvren Sketchbook Art & Custom Hand-Drawn Iconography
 *
 * Mascot Identity:
 *  - "Py": A charming, expressive cartoon Python snake with S-coils, belly scale ticks,
 *    diagonal ink cross-hatching, big animated eyes, and a cheeky crimson forked tongue.
 *  - "Vren": A scrappy little crested Wren songbird wearing round spectacles and holding
 *    an ink nib, perched right on Py's head or nestled in Py's coil.
 *  Together: Py + Vren = PYVREN.
 *
 * Zero generic colored-circle dots anywhere — every category and UI affordance uses
 * bespoke dry-brush sketchbook SVG linework that adapts seamlessly to Light & Dark modes.
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

/**
 * Masthead & Avatar Emblem: Cartoon Py (Python snake) + Vren (Wren crest/perch) stamp.
 */
export function renderMastheadNibSvg(size = 34): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 44 44" fill="none" aria-hidden="true" class="pyvren-emblem-svg shrink-0 select-none">
    <!-- Hand-inked sketchbook stamp frame -->
    <rect x="2" y="2" width="40" height="40" rx="11" fill="var(--bg-surface)" stroke="var(--ink-primary)" stroke-width="2.2"/>
    <path d="M5 37.5 C14 39 30 39 39 37.5" stroke="var(--ink-primary)" stroke-opacity="0.14" stroke-width="2" stroke-linecap="round"/>

    <!-- Tiny Vren (Wren bird) perched on top of Py's head -->
    <g transform="translate(23, 10)" stroke="var(--ink-primary)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <!-- Cocked wren tail -->
      <path d="M-6 2 L-10 -3 L-7 -4 L-4 0" fill="var(--bg-elevated)"/>
      <!-- Round wren body -->
      <ellipse cx="0" cy="2" rx="6.2" ry="5" fill="var(--bg-elevated)"/>
      <circle cx="2.2" cy="1" r="1.2" fill="var(--ink-primary)" stroke="none"/>
      <!-- Little orange-red beak -->
      <path d="M6 1 L9.5 2.2 L6 3.5 Z" fill="var(--accent)" stroke-width="1.3"/>
    </g>

    <!-- Py (Cartoon Python Snake) S-neck + smiling head -->
    <g stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <!-- Lower coil resting at bottom of stamp -->
      <path d="M9.5 34 C9.5 28.5 16 27.5 23 28.5 C30.5 29.5 34.5 27 34.5 23 C34.5 18.2 28.5 15.5 21.5 15.5 C14.5 15.5 10.5 19 11.2 23.5 C11.8 27 16.5 28 22.5 27.2" fill="var(--bg-surface)"/>
      <!-- Belly scale ticks -->
      <path d="M15 32.5 L16.5 30 M20.5 33 L21.5 30.2 M26 32.8 L26.5 30" stroke-width="1.4" stroke-opacity="0.55"/>
      <!-- Big cartoon eyes on Py's head -->
      <circle cx="17.5" cy="20.5" r="3.1" fill="var(--bg-canvas)" stroke-width="1.8"/>
      <circle cx="25.2" cy="20.5" r="3.1" fill="var(--bg-canvas)" stroke-width="1.8"/>
      <circle cx="18.2" cy="20.5" r="1.4" fill="var(--ink-primary)" stroke="none"/>
      <circle cx="25.9" cy="20.5" r="1.4" fill="var(--ink-primary)" stroke="none"/>
      <!-- Cheeky smile + crimson forked tongue -->
      <path d="M17.8 25 C20 26.8 23.2 26.8 25.4 25" fill="none" stroke-width="1.7"/>
      <path d="M28.5 24.2 L33.2 24.8 M33.2 24.8 L35.4 23.3 M33.2 24.8 L35.2 26.5" stroke="var(--accent)" stroke-width="1.8"/>
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

/**
 * Hero Studio Scene: Cartoon Py (the Python snake) & Vren (the spectacled Wren bird)
 * co-crafting dispatches at a sketchbook desk alongside a syntax-colored terminal.
 */
export function renderHeroCrewSceneSvg(): string {
  return `<svg viewBox="0 0 400 282" width="100%" height="100%" fill="none" role="img" aria-label="Py the cartoon Python snake and Vren the spectacled Wren bird co-crafting engineering stories at a sketchbook desk" class="crew-hero-svg pyvren-mascot-svg select-none">
    <defs>
      <pattern id="pyvren-hero-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(34)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="var(--ink-primary)" stroke-width="1.15" stroke-opacity="0.22"/>
      </pattern>
      <pattern id="pyvren-hero-dots" width="15" height="15" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.9" fill="var(--ink-primary)" fill-opacity="0.12"/>
      </pattern>
    </defs>

    <!-- Sketchbook grid paper backdrop -->
    <rect x="8" y="8" width="384" height="266" rx="18" fill="url(#pyvren-hero-dots)"/>

    <!-- Floating ink stars -->
    <g class="crew-float-slow" stroke="var(--ink-primary)" stroke-width="1.8" stroke-linejoin="round">
      <path d="M46 42 L49 50 L57 53 L49 56 L46 64 L43 56 L35 53 L43 50 Z" fill="var(--accent)"/>
      <path d="M348 34 L350 40 L356 42 L350 44 L348 50 L346 44 L340 42 L346 40 Z" fill="var(--bg-surface)"/>
    </g>

    <!-- Right side: Sketchbook Code Terminal Window with colored syntax bars -->
    <g transform="translate(232, 68)" stroke="var(--ink-primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="0" y="0" width="138" height="104" rx="11" fill="#15171D"/>
      <path d="M0 11 C0 5 5 0 11 0 H127 C133 0 138 5 138 11 V23 H0 Z" fill="#20242E"/>
      <line x1="0" y1="23" x2="138" y2="23"/>
      <circle cx="13" cy="11.5" r="2.8" fill="#EF5350" stroke="none"/>
      <circle cx="23" cy="11.5" r="2.8" fill="#F59E0B" stroke="none"/>
      <circle cx="33" cy="11.5" r="2.8" fill="#34D399" stroke="none"/>
      <text x="124" y="15" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="8.5" font-weight="600" fill="#9CA3AF" stroke="none">pyvren.py</text>

      <!-- Colored code syntax lines inside terminal -->
      <g stroke-width="3" stroke-linecap="round">
        <line x1="14" y1="39" x2="36" y2="39" stroke="#FF7B72"/>
        <line x1="44" y1="39" x2="86" y2="39" stroke="#79C0FF"/>
        <line x1="22" y1="52" x2="54" y2="52" stroke="#D2A8FF"/>
        <line x1="62" y1="52" x2="118" y2="52" stroke="#A5D6FF"/>
        <line x1="22" y1="65" x2="46" y2="65" stroke="#FF7B72"/>
        <line x1="54" y1="65" x2="104" y2="65" stroke="#7EE787"/>
        <line x1="14" y1="78" x2="72" y2="78" stroke="#FFA657"/>
        <line x1="80" y1="78" x2="122" y2="78" stroke="#79C0FF"/>
        <line x1="14" y1="91" x2="58" y2="91" stroke="#6E7681"/>
      </g>
      <!-- Stand -->
      <path d="M56 104 L51 132 L87 132 L82 104 Z" fill="var(--bg-elevated)"/>
    </g>

    <!-- Center-Left: PY THE CARTOON PYTHON SNAKE + VREN THE WREN BIRD -->
    <g transform="translate(132, 148)" stroke="var(--ink-primary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <!-- Py's expressive tail curling up on left holding a drafted page -->
      <g transform="translate(-76, -12) rotate(-8)">
        <rect x="-18" y="-34" width="56" height="68" rx="6" fill="var(--bg-elevated)"/>
        <line x1="-8" y1="-20" x2="22" y2="-20" stroke="var(--accent)" stroke-width="2.5"/>
        <line x1="-8" y1="-9" x2="28" y2="-9" stroke-width="1.8" stroke-opacity="0.65"/>
        <line x1="-8" y1="1" x2="24" y2="1" stroke-width="1.8" stroke-opacity="0.5"/>
        <line x1="-8" y1="11" x2="18" y2="11" stroke-width="1.8" stroke-opacity="0.4"/>
      </g>
      <!-- Tail tip wrapping around the sheet -->
      <path d="M-46 38 C-74 36 -86 18 -76 -2 C-71 -12 -60 -10 -56 -2" fill="none" stroke-width="7" stroke="var(--ink-primary)"/>
      <path d="M-46 38 C-74 36 -86 18 -76 -2 C-71 -12 -60 -10 -56 -2" fill="none" stroke-width="3.6" stroke="var(--bg-surface)"/>

      <!-- Py's stacked figure-8 S-coils on the desk -->
      <path d="M-48 52 C-54 26 -30 16 4 18 C38 20 58 30 52 52 Z" fill="var(--bg-surface)"/>
      <path d="M12 20 C42 22 56 32 51 51 L26 51 C30 36 22 25 4 21 Z" fill="url(#pyvren-hero-hatch)" stroke="none"/>
      <!-- Belly scale ribs on lower coil -->
      <path d="M-28 48 C-26 39 -22 35 -18 34 M-8 49 C-7 39 -4 35 0 34 M12 49 C13 40 16 36 20 35 M30 49 C31 41 34 38 37 37" stroke-width="1.6" stroke-opacity="0.5"/>

      <!-- Py's middle coil & graceful S-neck rising to cartoon head -->
      <path d="M-32 24 C-36 2 -14 -8 10 -4 C30 -1 40 10 34 24 Z" fill="var(--bg-elevated)"/>
      <!-- Neck rising -->
      <path d="M-14 4 C-22 -22 -18 -54 2 -60 C24 -66 42 -50 40 -30 C38 -14 22 -8 6 -10 C-4 -11 -8 -2 -6 10" fill="var(--bg-surface)"/>
      <!-- Dorsal diamond markings on Py -->
      <path d="M-11 -20 L-6 -25 L-1 -20 L-6 -15 Z" fill="var(--accent)" fill-opacity="0.22" stroke-width="1.5"/>

      <!-- Py's Cartoon Eyes + Expressive Brows -->
      <g class="crew-blink">
        <circle cx="-1" cy="-42" r="7.2" fill="var(--bg-canvas)" stroke-width="2.2"/>
        <circle cx="19" cy="-42" r="7.2" fill="var(--bg-canvas)" stroke-width="2.2"/>
        <circle cx="1" cy="-42" r="3.1" fill="var(--ink-primary)" stroke="none"/>
        <circle cx="21" cy="-42" r="3.1" fill="var(--ink-primary)" stroke="none"/>
        <circle cx="2.2" cy="-43.5" r="1" fill="var(--bg-canvas)" stroke="none"/>
        <circle cx="22.2" cy="-43.5" r="1" fill="var(--bg-canvas)" stroke="none"/>
      </g>
      <path d="M-7 -52 Q-1 -56 5 -52 M13 -52 Q19 -56 25 -52" fill="none" stroke-width="2"/>

      <!-- Py's Big Friendly Cartoon Grin + Forked Crimson Tongue -->
      <path d="M0 -26 C8 -19 20 -19 28 -25" fill="none" stroke-width="2.2"/>
      <path d="M35 -29 L48 -28 M48 -28 L54 -33 M48 -28 L54 -23" stroke="var(--accent)" stroke-width="2.3"/>

      <!-- VREN THE WREN BIRD perched right on Py's head wearing editor spectacles! -->
      <g transform="translate(6, -77)" class="crew-bob">
        <!-- Upright cocked wren tail -->
        <path d="M-14 2 L-24 -10 L-17 -12 L-10 -2 Z" fill="var(--bg-elevated)"/>
        <!-- Plump wren body -->
        <ellipse cx="0" cy="2" rx="15" ry="13" fill="var(--bg-surface)"/>
        <path d="M2 -9 C12 -5 14 5 8 12 L0 13 C6 6 6 -3 0 -9 Z" fill="url(#pyvren-hero-hatch)" stroke="none"/>
        <!-- Wing holding a tiny crimson fountain nib -->
        <path d="M-8 2 C-2 0 2 5 -3 10 C-8 11 -11 7 -8 2 Z" fill="var(--bg-elevated)"/>
        <!-- Editor spectacles on Vren -->
        <circle cx="6" cy="-1" r="4.2" fill="var(--bg-canvas)" stroke-width="1.8"/>
        <circle cx="6.6" cy="-1" r="1.7" fill="var(--ink-primary)" stroke="none"/>
        <line x1="1.5" y1="-1" x2="-4" y2="-2" stroke-width="1.6"/>
        <!-- Crisp wren beak -->
        <path d="M13 -2 L22 1 L13 4 Z" fill="var(--accent)" stroke-width="1.8"/>
        <!-- Tiny legs gripping Py's crown -->
        <line x1="-4" y1="15" x2="-5" y2="19" stroke-width="1.9"/>
        <line x1="4" y1="15" x2="5" y2="19" stroke-width="1.9"/>
      </g>
    </g>

    <!-- Drafting desk ground line -->
    <line x1="20" y1="200" x2="380" y2="200" stroke="var(--ink-primary)" stroke-width="2.7" stroke-linecap="round"/>
    <line x1="46" y1="207" x2="354" y2="207" stroke="var(--ink-primary)" stroke-opacity="0.22" stroke-width="1.6" stroke-linecap="round"/>

    <!-- Hand-lettered sketchbook nameplate -->
    <g transform="translate(200, 240)">
      <rect x="-138" y="-16" width="276" height="30" rx="9" fill="var(--bg-surface)" stroke="var(--ink-primary)" stroke-width="1.9"/>
      <text x="0" y="3.5" text-anchor="middle" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="10.5" font-weight="600" letter-spacing="0.5" fill="var(--ink-primary)">PY (SNAKE) + VREN (WREN) &times; HAMDI</text>
    </g>
  </svg>`;
}

/**
 * Renders the Cartoon Pyvren ("Py" the Python Snake + "Vren" the Wren) scene
 * customized with a category prop — used both on Topic Cards AND as the automatic
 * backup illustration whenever a post image doesn't exist or fails to load!
 */
export function renderTopicCrewSvg(categorySlug: string, instanceKey = 't'): string {
  const slug = String(categorySlug || '').trim().toLowerCase();
  const safeId = escapeHtml(`${slug}-${instanceKey}`.replace(/[^a-z0-9_-]/gi, ''));
  const hatchId = `pyv-hatch-${safeId}`;

  let propSvg = '';
  switch (slug) {
    case 'ai-coding-agents-mcp':
      propSvg = `
        <g transform="translate(116, 42)" stroke="var(--ink-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="0" y="0" width="50" height="42" rx="7" fill="#16181F"/>
          <path d="M9 15 L15 20 L9 25" stroke="#FF7B72" stroke-width="2.2"/>
          <line x1="19" y1="25" x2="38" y2="25" stroke="#79C0FF" stroke-width="2.2"/>
          <line x1="9" y1="33" x2="40" y2="33" stroke="#7EE787" stroke-width="1.9"/>
        </g>`;
      break;
    case 'ai-security-jailbreaks':
      propSvg = `
        <g transform="translate(136, 64)" stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M0 -26 L21 -17 V2 C21 15 11 25 0 30 C-11 25 -21 15 -21 2 V-17 Z" fill="var(--bg-elevated)"/>
          <circle cx="0" cy="-4" r="4" fill="var(--topic-accent, var(--accent))" stroke-width="1.7"/>
          <path d="M0 0 V10" stroke-width="2.2"/>
        </g>`;
      break;
    case 'ai-llms':
      propSvg = `
        <g transform="translate(136, 72)" stroke="var(--ink-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="-22" y="8" width="44" height="11" rx="3" fill="var(--bg-elevated)"/>
          <rect x="-18" y="-5" width="36" height="11" rx="3" fill="var(--bg-surface)"/>
          <rect x="-13" y="-18" width="26" height="11" rx="3" fill="url(#${hatchId})"/>
          <path d="M0 -34 L3 -27 L10 -24 L3 -21 L0 -14 L-3 -21 L-10 -24 L-3 -27 Z" fill="var(--topic-accent, var(--accent))" stroke-width="1.6"/>
        </g>`;
      break;
    case 'cloud-gpu-infra':
      propSvg = `
        <g transform="translate(134, 62)" stroke="var(--ink-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M-18 16 C-25 16 -27 7 -20 3 C-18 -6 -6 -8 0 -2 C7 -8 19 -5 20 4 C26 7 24 16 17 16 Z" fill="var(--bg-elevated)"/>
          <path d="M4 -20 L-6 -1 H3 L-3 16 L12 -4 H3 Z" fill="var(--topic-accent, var(--accent))" stroke-width="1.8"/>
        </g>`;
      break;
    case 'agentic-browser-web-data':
      propSvg = `
        <g transform="translate(134, 60)" stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round">
          <circle cx="0" cy="0" r="18" fill="var(--bg-elevated)"/>
          <ellipse cx="0" cy="0" rx="8" ry="18" fill="none" stroke-opacity="0.5"/>
          <line x1="-18" y1="0" x2="18" y2="0" stroke-opacity="0.5"/>
          <line x1="13" y1="13" x2="23" y2="23" stroke="var(--topic-accent, var(--accent))" stroke-width="3"/>
        </g>`;
      break;
    default:
      propSvg = `
        <g transform="translate(136, 62)" stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="-18" y="-18" width="36" height="36" rx="9" fill="var(--bg-elevated)"/>
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

    <line x1="14" y1="112" x2="170" y2="112" stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round" stroke-opacity="0.7"/>

    <!-- Cartoon Py (Python Snake) + Vren (Wren perched on head) -->
    <g transform="translate(62, 82)" stroke="var(--ink-primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <!-- Coiled snake base -->
      <path d="M-34 30 C-38 12 -20 5 2 6 C24 7 38 15 34 30 Z" fill="var(--bg-surface)"/>
      <path d="M8 7 C26 9 36 17 33 29 L16 29 C19 19 14 11 2 8 Z" fill="url(#${hatchId})" stroke="none"/>
      <path d="M-18 28 L-15 19 M-3 28 L-1 19 M12 28 L14 20" stroke-width="1.4" stroke-opacity="0.5"/>

      <!-- S-neck + cartoon snake head -->
      <path d="M-12 8 C-18 -10 -14 -34 2 -38 C18 -42 30 -30 28 -16 C26 -5 15 -1 4 -2 C-3 -3 -6 3 -4 10" fill="var(--bg-surface)"/>
      <circle cx="-1" cy="-24" r="5" fill="var(--bg-canvas)" stroke-width="1.9"/>
      <circle cx="13" cy="-24" r="5" fill="var(--bg-canvas)" stroke-width="1.9"/>
      <circle cx="0.5" cy="-24" r="2.2" fill="var(--ink-primary)" stroke="none"/>
      <circle cx="14.5" cy="-24" r="2.2" fill="var(--ink-primary)" stroke="none"/>
      <path d="M0 -13 C5 -8 13 -8 18 -12" fill="none" stroke-width="1.8"/>
      <!-- Forked crimson tongue -->
      <path d="M24 -15 L34 -14 M34 -14 L38 -18 M34 -14 L38 -10" stroke="var(--topic-accent, var(--accent))" stroke-width="2"/>

      <!-- Tiny Vren bird perched on Py's head -->
      <g transform="translate(4, -49)">
        <path d="M-9 2 L-15 -6 L-10 -7 L-6 -1 Z" fill="var(--bg-elevated)" stroke-width="1.7"/>
        <ellipse cx="0" cy="2" rx="9.5" ry="8" fill="var(--bg-elevated)" stroke-width="1.8"/>
        <circle cx="3.5" cy="0.5" r="1.6" fill="var(--ink-primary)" stroke="none"/>
        <path d="M8.5 0 L15 2 L8.5 4 Z" fill="var(--topic-accent, var(--accent))" stroke-width="1.5"/>
      </g>
    </g>

    ${propSvg}
  </svg>`;
}

/**
 * Standalone SVG document for `/og/fallback.svg` so ANY broken `<img>` tag (even inside
 * compiled Markdown prose!) can swap its `src` directly to the cartoon Pyvren face.
 */
export function renderStandalonePyvrenFallbackSvg(categorySlug = '', label = 'Pyvren Dispatch'): string {
  const meta = getCategoryMeta(categorySlug || 'ai-coding-agents-mcp');
  const safeLabel = escapeHtml((label || meta.navLabel || 'Pyvren Dispatch').slice(0, 48));
  const safeBeat = escapeHtml(meta.shortLabel);

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
    <pattern id="fb-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <line x1="0" y1="0" x2="0" y2="9" stroke="var(--ink)" stroke-width="1.5" stroke-opacity="0.18"/>
    </pattern>
  </defs>

  <rect width="960" height="600" fill="var(--paper)"/>
  <rect x="24" y="24" width="912" height="552" rx="24" fill="url(#fb-dots)" stroke="var(--border)" stroke-width="2"/>

  <!-- Top beat tag -->
  <g transform="translate(56, 56)">
    <rect x="0" y="0" width="220" height="36" rx="10" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>
    <text x="110" y="23" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" font-weight="700" letter-spacing="1.2" fill="var(--accent)">${safeBeat}</text>
  </g>

  <!-- Center Cartoon Py (Python Snake) + Vren (Wren Bird) Portrait -->
  <g transform="translate(480, 350)" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <!-- Ground sketchbook line -->
    <line x1="-260" y1="92" x2="260" y2="92" stroke-width="5"/>
    <line x1="-190" y1="106" x2="190" y2="106" stroke-width="3" stroke-opacity="0.25"/>

    <!-- Py's large cartoon coils -->
    <path d="M-125 90 C-140 34 -72 10 10 14 C92 18 140 44 125 90 Z" fill="var(--surface)"/>
    <path d="M24 16 C92 22 132 48 121 88 L62 88 C70 54 52 30 10 20 Z" fill="url(#fb-hatch)" stroke="none"/>
    <path d="M-68 85 L-60 56 M-16 86 L-12 56 M36 86 L40 58" stroke-width="3.2" stroke-opacity="0.45"/>

    <!-- Py's middle coil & S-neck + smiling face -->
    <path d="M-82 32 C-90 -14 -40 -34 22 -24 C70 -16 92 8 78 36 Z" fill="var(--elevated)"/>
    <path d="M-36 -8 C-56 -64 -44 -132 6 -144 C58 -156 100 -120 94 -72 C88 -34 50 -20 14 -24 C-10 -26 -20 -6 -14 22" fill="var(--surface)"/>

    <!-- Big cartoon eyes -->
    <circle cx="-2" cy="-100" r="17" fill="var(--paper)" stroke-width="4.5"/>
    <circle cx="44" cy="-100" r="17" fill="var(--paper)" stroke-width="4.5"/>
    <circle cx="3" cy="-100" r="7.5" fill="var(--ink)" stroke="none"/>
    <circle cx="49" cy="-100" r="7.5" fill="var(--ink)" stroke="none"/>
    <circle cx="6" cy="-104" r="2.5" fill="var(--paper)" stroke="none"/>
    <circle cx="52" cy="-104" r="2.5" fill="var(--paper)" stroke="none"/>

    <!-- Smile + Crimson Forked Tongue -->
    <path d="M2 -62 C20 -46 48 -46 66 -60" fill="none" stroke-width="4.5"/>
    <path d="M82 -68 L114 -65 M114 -65 L128 -77 M114 -65 L128 -53" stroke="var(--accent)" stroke-width="5"/>

    <!-- Vren the Wren perched on Py's head with spectacles -->
    <g transform="translate(14, -182)">
      <path d="M-30 6 L-52 -20 L-36 -25 L-20 -4 Z" fill="var(--elevated)" stroke-width="4"/>
      <ellipse cx="0" cy="5" rx="34" ry="29" fill="var(--surface)" stroke-width="4.5"/>
      <circle cx="13" cy="-2" r="9.5" fill="var(--paper)" stroke-width="3.8"/>
      <circle cx="14.5" cy="-2" r="4" fill="var(--ink)" stroke="none"/>
      <line x1="3" y1="-2" x2="-9" y2="-4" stroke-width="3.4"/>
      <path d="M30 -4 L52 3 L30 10 Z" fill="var(--accent)" stroke-width="4"/>
      <line x1="-9" y1="34" x2="-11" y2="43" stroke-width="4"/>
      <line x1="9" y1="34" x2="11" y2="43" stroke-width="4"/>
    </g>
  </g>

  <!-- Bottom label -->
  <text x="480" y="534" text-anchor="middle" font-family="Georgia, Cambria, serif" font-size="22" font-weight="700" fill="var(--ink)">${safeLabel}</text>
  <text x="480" y="558" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" letter-spacing="1.4" fill="var(--muted)">PY + VREN ILLUSTRATED EDITION</text>
</svg>`;
}

/**
 * Renders the visual media frame for a post card or article header:
 * - Base layer: Cartoon Pyvren ("Py" snake + "Vren" wren) sketchbook scene with custom beat icon
 * - Top layer (when coverImageUrl exists): Real crawled primary reference image with automatic
 *   fallback to the Pyvren cartoon base plate if the remote URL ever errors or fails to load.
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
  const altText = (opts.coverImageAlt || opts.title || 'Pyvren story illustration').trim();

  return `<div class="story-media relative ${aspectClass} w-full overflow-hidden" style="--topic-light:${catMeta.color}; --topic-dark:${catMeta.darkColor};">
    <!-- Auto-backup Cartoon Pyvren (Py Snake + Vren Bird) base illustration -->
    <div class="story-crew-plate absolute inset-0 flex flex-col justify-between p-3.5 sm:p-4">
      <div class="flex items-center justify-between gap-2">
        <span class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--topic-accent)]">
          ${topicIcon}
          <span>Py &amp; Vren</span>
        </span>
        <span class="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">${escapeHtml(archetypeLabel)}</span>
      </div>
      <div class="mx-auto h-[78%] w-full max-w-[232px]">
        ${crewArt}
      </div>
    </div>
    ${
      hasRealImage
        ? `<img
            src="${escapeHtml(opts.coverImageUrl!.trim())}"
            alt="${escapeHtml(altText)}"
            loading="${opts.eager ? 'eager' : 'lazy'}"
            decoding="async"
            referrerpolicy="no-referrer"
            data-story-cover="1"
            data-fallback-category="${escapeHtml(opts.categorySlug)}"
            class="story-real-img relative z-10 h-full w-full object-cover transition-transform duration-500 ease-out"
          />`
        : ''
    }
  </div>`;
}
