import { getCategoryMeta } from '../lib/relations';
import { escapeHtml } from '../lib/security';

/**
 * Hand-drawn sketchbook character illustrations inspired by the Doodle Crew Footer.
 * Every SVG uses CSS theme custom properties (--ink-primary, --bg-surface, --bg-elevated,
 * --accent, --topic-accent) so linework, fills, and ink hatching look crisp in BOTH
 * Warm Newsprint Light Mode and Obsidian Dark Mode.
 */

export function renderMastheadNibSvg(): string {
  return `<svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true" class="shrink-0">
    <rect x="2" y="2" width="28" height="28" rx="8" fill="var(--bg-surface)" stroke="var(--ink-primary)" stroke-width="2"/>
    <path d="M9.5 22.5L13 11.5L20.5 8.5L23.5 11.5L20.5 19L9.5 22.5Z" fill="var(--bg-elevated)" stroke="var(--ink-primary)" stroke-width="1.9" stroke-linejoin="round"/>
    <path d="M9.5 22.5L15.8 16.2" stroke="var(--ink-primary)" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="16.5" cy="15.5" r="1.7" fill="var(--accent)"/>
    <path d="M23 6.5L24 4.5M25.5 9L27.5 8" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;
}

export function renderHeroCrewSceneSvg(): string {
  return `<svg viewBox="0 0 380 268" width="100%" height="100%" fill="none" role="img" aria-label="Illustrated sketchbook desk with the Pyvren crew crafting stories together" class="crew-hero-svg select-none">
    <defs>
      <pattern id="hero-ink-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(34)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="var(--ink-primary)" stroke-width="1.15" stroke-opacity="0.22"/>
      </pattern>
      <pattern id="hero-dot-grid" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.9" fill="var(--ink-primary)" fill-opacity="0.14"/>
      </pattern>
    </defs>

    <!-- Subtle sketchbook dot backdrop -->
    <rect x="10" y="10" width="360" height="248" rx="18" fill="url(#hero-dot-grid)"/>

    <!-- Floating hand-drawn ink stars & sparks -->
    <g class="crew-float-slow" stroke-linecap="round" stroke-linejoin="round">
      <path d="M52 44 L55 52 L63 55 L55 58 L52 66 L49 58 L41 55 L49 52 Z" fill="var(--accent)" stroke="var(--ink-primary)" stroke-width="1.8"/>
      <path d="M324 34 L326 40 L332 42 L326 44 L324 50 L322 44 L316 42 L322 40 Z" fill="var(--bg-surface)" stroke="var(--ink-primary)" stroke-width="1.8"/>
      <circle cx="294" cy="54" r="3" fill="var(--accent)"/>
    </g>

    <!-- Terminal monitor card on right of desk -->
    <g transform="translate(226, 76)" stroke="var(--ink-primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <!-- Boo the Ghost peeking cheerfully above the monitor -->
      <g transform="translate(66, -26)" class="crew-bob">
        <path d="M-20 26 C-20 4 -12 -10 0 -10 C12 -10 20 4 20 26 L12 22 L4 26 L-4 22 L-12 26 Z" fill="var(--bg-surface)"/>
        <path d="M12 -4 C17 6 17 16 14 23" stroke="none" fill="url(#hero-ink-hatch)"/>
        <g class="crew-blink">
          <circle cx="-6" cy="5" r="2.7" fill="var(--ink-primary)" stroke="none"/>
          <circle cx="6" cy="5" r="2.7" fill="var(--ink-primary)" stroke="none"/>
        </g>
        <path d="M-4 12 Q0 16 4 12" fill="none" stroke-width="1.9"/>
      </g>

      <!-- Sketchbook terminal window -->
      <rect x="0" y="14" width="118" height="84" rx="10" fill="var(--bg-surface)"/>
      <rect x="0" y="14" width="118" height="20" rx="10" fill="url(#hero-ink-hatch)"/>
      <line x1="0" y1="34" x2="118" y2="34"/>
      <circle cx="12" cy="24" r="2.5" fill="var(--accent)" stroke="none"/>
      <circle cx="21" cy="24" r="2.5" fill="var(--ink-primary)" fill-opacity="0.35" stroke="none"/>
      <path d="M14 50 L22 56 L14 62" fill="none" stroke="var(--accent)" stroke-width="2.3"/>
      <line x1="28" y1="62" x2="54" y2="62" stroke-width="2.2"/>
      <line x1="14" y1="76" x2="94" y2="76" stroke-opacity="0.45" stroke-width="2"/>
      <line x1="14" y1="85" x2="74" y2="85" stroke-opacity="0.3" stroke-width="2"/>
      <!-- Stand -->
      <path d="M48 98 L44 116 L74 116 L70 98" fill="var(--bg-elevated)"/>
    </g>

    <!-- Bruno the Horned Yeti at the center-left drafting stories -->
    <g transform="translate(132, 134)" stroke="var(--ink-primary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <!-- Curved sketchbook horns -->
      <path d="M-28 -52 C-42 -68 -40 -82 -26 -80 C-21 -79 -19 -68 -20 -56" fill="var(--bg-surface)"/>
      <path d="M28 -52 C42 -68 40 -82 26 -80 C21 -79 19 -68 20 -56" fill="var(--bg-surface)"/>
      <!-- Shaggy rounded body -->
      <path d="M-46 58 C-50 12 -44 -48 0 -54 C44 -48 50 12 46 58 Z" fill="var(--bg-surface)"/>
      <path d="M18 -46 C40 -30 45 14 42 56 L22 56 C26 16 24 -22 12 -42 Z" fill="url(#hero-ink-hatch)" stroke="none"/>
      <!-- Fur tufts -->
      <path d="M-24 -8 L-18 -3 M18 -6 L24 -1 M-30 16 L-24 20" stroke-width="1.8"/>
      <!-- Expressive eyes -->
      <g class="crew-blink">
        <circle cx="-14" cy="-24" r="6.5" fill="var(--bg-canvas)" stroke-width="2.1"/>
        <circle cx="14" cy="-24" r="6.5" fill="var(--bg-canvas)" stroke-width="2.1"/>
        <circle cx="-12.5" cy="-24" r="2.8" fill="var(--ink-primary)" stroke="none"/>
        <circle cx="15.5" cy="-24" r="2.8" fill="var(--ink-primary)" stroke="none"/>
      </g>
      <!-- Warm grin with tiny tooth -->
      <path d="M-13 -9 C-5 -3 5 -3 13 -9" fill="none"/>
      <path d="M4 -6 L7 -1 L10 -7" fill="var(--bg-surface)" stroke-width="1.8"/>

      <!-- Freshly drafted dispatch page held in Bruno's paws -->
      <g transform="translate(0, 26) rotate(-4)">
        <rect x="-36" y="-16" width="74" height="50" rx="6" fill="var(--bg-elevated)"/>
        <line x1="-24" y1="-3" x2="10" y2="-3" stroke="var(--accent)" stroke-width="2.5"/>
        <line x1="-24" y1="8" x2="24" y2="8" stroke-width="1.9" stroke-opacity="0.65"/>
        <line x1="-24" y1="18" x2="18" y2="18" stroke-width="1.9" stroke-opacity="0.45"/>
        <circle cx="23" cy="-3" r="4" fill="var(--accent)" stroke="none"/>
      </g>
      <!-- Paws -->
      <circle cx="-36" cy="28" r="8.5" fill="var(--bg-surface)"/>
      <circle cx="38" cy="24" r="8.5" fill="var(--bg-surface)"/>
    </g>

    <!-- Stack of field notebooks + Pip the Bird on left -->
    <g transform="translate(54, 174)" stroke="var(--ink-primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <!-- Notebooks -->
      <rect x="-26" y="4" width="54" height="14" rx="3.5" fill="var(--bg-elevated)"/>
      <rect x="-22" y="-10" width="50" height="14" rx="3.5" fill="var(--bg-surface)"/>
      <line x1="-14" y1="-3" x2="18" y2="-3" stroke="var(--accent)" stroke-width="2"/>
      <!-- Pip perched on top -->
      <g transform="translate(2, -28)" class="crew-bob-delayed">
        <path d="M-5 -18 C-7 -25 -2 -27 0 -20 C3 -26 7 -23 4 -17" fill="none"/>
        <ellipse cx="0" cy="0" rx="18" ry="17" fill="var(--bg-surface)"/>
        <path d="M5 -12 C16 -6 17 8 8 15 L1 15 C8 7 8 -4 2 -12 Z" fill="url(#hero-ink-hatch)" stroke="none"/>
        <circle cx="-5" cy="-3" r="2.5" fill="var(--ink-primary)" stroke="none"/>
        <circle cx="6" cy="-3" r="2.5" fill="var(--ink-primary)" stroke="none"/>
        <path d="M-2 1 L3 5 L5 0 Z" fill="var(--accent)" stroke-width="1.7"/>
        <line x1="-5" y1="17" x2="-5" y2="21"/>
        <line x1="5" y1="17" x2="5" y2="21"/>
      </g>
    </g>

    <!-- Sketchbook drafting desk baseline -->
    <line x1="22" y1="192" x2="358" y2="192" stroke="var(--ink-primary)" stroke-width="2.6" stroke-linecap="round"/>
    <line x1="48" y1="199" x2="332" y2="199" stroke="var(--ink-primary)" stroke-opacity="0.24" stroke-width="1.6" stroke-linecap="round"/>

    <!-- Hand-lettered co-work caption pill under desk -->
    <g transform="translate(190, 228)">
      <rect x="-124" y="-15" width="248" height="28" rx="14" fill="var(--bg-surface)" stroke="var(--ink-primary)" stroke-width="1.7"/>
      <circle cx="-105" cy="-1" r="4" fill="var(--accent)"/>
      <text x="6" y="3" text-anchor="middle" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="10.5" font-weight="600" letter-spacing="0.6" fill="var(--ink-primary)">HUMAN × PYVREN CO-CRAFT STUDIO</text>
    </g>
  </svg>`;
}

/**
 * Renders one of 6 unique hand-drawn Crew mascot SVGs tailored to each topic category.
 */
export function renderTopicCrewSvg(categorySlug: string, instanceKey = 't'): string {
  const slug = String(categorySlug || '').trim().toLowerCase();
  const safeId = escapeHtml(`${slug}-${instanceKey}`.replace(/[^a-z0-9_-]/gi, ''));
  const hatchId = `hatch-${safeId}`;

  let sceneInner = '';

  switch (slug) {
    case 'ai-coding-agents-mcp': {
      // Bruno the Yeti coding at a CLI prompt with { } braces
      sceneInner = `
        <g transform="translate(64, 78)" stroke="var(--ink-primary)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M-20 -36 C-30 -48 -28 -58 -18 -56 C-14 -55 -13 -47 -14 -38" fill="var(--bg-surface)"/>
          <path d="M20 -36 C30 -48 28 -58 18 -56 C14 -55 13 -47 14 -38" fill="var(--bg-surface)"/>
          <path d="M-32 36 C-35 4 -30 -34 0 -38 C30 -34 35 4 32 36 Z" fill="var(--bg-surface)"/>
          <path d="M12 -32 C28 -20 31 8 29 35 L15 35 C18 10 16 -16 8 -30 Z" fill="url(#${hatchId})" stroke="none"/>
          <circle cx="-10" cy="-16" r="4.6" fill="var(--bg-canvas)" stroke-width="2"/>
          <circle cx="10" cy="-16" r="4.6" fill="var(--bg-canvas)" stroke-width="2"/>
          <circle cx="-9" cy="-16" r="2.1" fill="var(--ink-primary)" stroke="none"/>
          <circle cx="11" cy="-16" r="2.1" fill="var(--ink-primary)" stroke="none"/>
          <path d="M-8 -5 Q0 -1 8 -5" fill="none"/>
        </g>
        <!-- Terminal card -->
        <g transform="translate(104, 42)" stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="0" y="0" width="58" height="46" rx="7" fill="var(--bg-elevated)"/>
          <path d="M10 17 L17 22 L10 27" fill="none" stroke="var(--topic-accent)" stroke-width="2.4"/>
          <line x1="22" y1="27" x2="42" y2="27" stroke="var(--ink-primary)" stroke-width="2.2"/>
          <line x1="10" y1="36" x2="46" y2="36" stroke-opacity="0.35" stroke-width="1.8"/>
        </g>
        <text x="20" y="34" font-family="'JetBrains Mono', monospace" font-size="15" font-weight="700" fill="var(--topic-accent)">{}</text>`;
      break;
    }

    case 'ai-security-jailbreaks': {
      // Patch the Cat holding a sketched keyhole shield
      sceneInner = `
        <g transform="translate(66, 78)" stroke="var(--ink-primary)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M-24 36 L-24 -12 L-30 -38 L-10 -22 L10 -22 L30 -38 L24 -12 L24 36 Z" fill="var(--bg-surface)"/>
          <path d="M8 -20 L26 -33 L21 -10 L21 34 L10 34 Z" fill="url(#${hatchId})" stroke="none"/>
          <circle cx="-9" cy="-6" r="2.6" fill="var(--ink-primary)" stroke="none"/>
          <circle cx="9" cy="-6" r="2.6" fill="var(--ink-primary)" stroke="none"/>
          <path d="M-3 1 L0 4 L3 1" fill="none"/>
          <path d="M-32 -3 L-20 -1 M-32 4 L-20 4 M20 -1 L32 -3 M20 4 L32 4" stroke-width="1.7"/>
        </g>
        <!-- Defensive shield -->
        <g transform="translate(124, 68)" stroke="var(--ink-primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M0 -30 L24 -20 L24 2 C24 18 12 29 0 34 C-12 29 -24 18 -24 2 L-24 -20 Z" fill="var(--bg-elevated)"/>
          <path d="M0 -28 L21 -19 L21 2 C21 15 11 25 0 30 Z" fill="url(#${hatchId})" stroke="none"/>
          <circle cx="0" cy="-4" r="4.5" fill="var(--topic-accent)" stroke="var(--ink-primary)" stroke-width="1.8"/>
          <path d="M0 1 L0 12" stroke="var(--ink-primary)" stroke-width="2.4"/>
        </g>`;
      break;
    }

    case 'ai-llms': {
      // Pip the Bird perched atop stacked model weight blocks
      sceneInner = `
        <!-- Stacked weight layers -->
        <g transform="translate(96, 84)" stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="-46" y="14" width="92" height="14" rx="4" fill="var(--bg-elevated)"/>
          <rect x="-38" y="-2" width="76" height="14" rx="4" fill="var(--bg-surface)"/>
          <rect x="-28" y="-18" width="56" height="14" rx="4" fill="url(#${hatchId})"/>
          <circle cx="-34" cy="21" r="2.3" fill="var(--topic-accent)" stroke="none"/>
          <circle cx="-26" cy="5" r="2.3" fill="var(--topic-accent)" stroke="none"/>
        </g>
        <!-- Pip perched proudly -->
        <g transform="translate(96, 44)" stroke="var(--ink-primary)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M-4 -18 C-6 -25 -1 -27 0 -20 C3 -26 7 -22 4 -17" fill="none"/>
          <ellipse cx="0" cy="0" rx="20" ry="18" fill="var(--bg-surface)"/>
          <ellipse cx="-19" cy="2" rx="6" ry="9" transform="rotate(-16 -19 2)" fill="var(--bg-elevated)"/>
          <circle cx="-6" cy="-3" r="2.6" fill="var(--ink-primary)" stroke="none"/>
          <circle cx="6" cy="-3" r="2.6" fill="var(--ink-primary)" stroke="none"/>
          <path d="M-3 2 L0 7 L4 2 Z" fill="var(--topic-accent)" stroke-width="1.8"/>
          <line x1="-6" y1="18" x2="-6" y2="22"/>
          <line x1="6" y1="18" x2="6" y2="22"/>
        </g>
        <path d="M36 32 L39 39 L46 42 L39 45 L36 52 L33 45 L26 42 L33 39 Z" fill="var(--topic-accent)" stroke="var(--ink-primary)" stroke-width="1.7"/>`;
      break;
    }

    case 'cloud-gpu-infra': {
      // Juno in a baseball cap riding a sketched edge cloud + GPU bolt
      sceneInner = `
        <!-- Juno head & cap -->
        <g transform="translate(76, 56)" stroke="var(--ink-primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="0" cy="0" r="19" fill="var(--bg-surface)"/>
          <path d="M-19 -5 C-18 -20 18 -20 19 -5 Z" fill="var(--ink-primary)"/>
          <path d="M12 -7 L29 -4 C28 0 21 1 13 -1 Z" fill="var(--ink-primary)"/>
          <circle cx="-5" cy="3" r="2.4" fill="var(--ink-primary)" stroke="none"/>
          <circle cx="6" cy="3" r="2.4" fill="var(--ink-primary)" stroke="none"/>
          <path d="M-4 10 Q1 14 6 10" fill="none"/>
        </g>
        <!-- Puffy sketched edge cloud -->
        <g transform="translate(88, 92)" stroke="var(--ink-primary)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M-48 16 C-58 16 -62 3 -52 -4 C-50 -16 -34 -20 -24 -12 C-16 -24 6 -24 14 -11 C26 -16 40 -8 38 4 C46 8 44 16 34 16 Z" fill="var(--bg-elevated)"/>
          <path d="M-46 14 L34 14" stroke-opacity="0.2" stroke-width="3"/>
        </g>
        <!-- GPU Lightning Bolt -->
        <path d="M138 26 L124 52 L136 52 L126 76 L150 46 L137 46 Z" fill="var(--topic-accent)" stroke="var(--ink-primary)" stroke-width="2" stroke-linejoin="round"/>`;
      break;
    }

    case 'agentic-browser-web-data': {
      // Boo the Ghost scouting the web with a magnifying glass
      sceneInner = `
        <!-- Sketched web globe -->
        <g transform="translate(126, 62)" stroke="var(--ink-primary)" stroke-width="1.9">
          <circle cx="0" cy="0" r="24" fill="var(--bg-elevated)"/>
          <ellipse cx="0" cy="0" rx="11" ry="24" fill="none" stroke-opacity="0.55"/>
          <line x1="-24" y1="0" x2="24" y2="0" stroke-opacity="0.55"/>
          <circle cx="8" cy="-8" r="3.5" fill="var(--topic-accent)" stroke="none"/>
        </g>
        <!-- Boo -->
        <g transform="translate(64, 72)" stroke="var(--ink-primary)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M-24 38 C-24 6 -16 -24 0 -24 C16 -24 24 6 24 38 L15 32 L6 38 L-4 32 L-14 38 Z" fill="var(--bg-surface)"/>
          <path d="M10 -18 C20 -4 21 16 18 33 L9 35 C12 16 11 -2 4 -16 Z" fill="url(#${hatchId})" stroke="none"/>
          <circle cx="-7" cy="-4" r="2.7" fill="var(--ink-primary)" stroke="none"/>
          <circle cx="6" cy="-4" r="2.7" fill="var(--ink-primary)" stroke="none"/>
          <circle cx="0" cy="6" r="3" fill="var(--topic-accent)" stroke="none"/>
        </g>
        <!-- Magnifying glass -->
        <g transform="translate(96, 74)" stroke="var(--ink-primary)" stroke-width="2.3" stroke-linecap="round">
          <circle cx="0" cy="0" r="11" fill="var(--bg-canvas)" fill-opacity="0.85"/>
          <line x1="8" y1="8" x2="18" y2="18" stroke="var(--topic-accent)" stroke-width="3.2"/>
        </g>`;
      break;
    }

    default: {
      // dev-tooling-benchmarks & fallback: Morel the Mushroom with wrench & patch badge
      sceneInner = `
        <g transform="translate(72, 76)" stroke="var(--ink-primary)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <!-- Stem -->
          <path d="M-16 6 L-18 36 L18 36 L16 6 Z" fill="var(--bg-surface)"/>
          <!-- Spotted dome cap -->
          <path d="M-36 8 C-38 -22 -18 -34 0 -34 C18 -34 38 -22 36 8 Z" fill="var(--bg-elevated)"/>
          <path d="M8 -32 C24 -28 35 -14 34 7 L14 7 C16 -10 12 -24 4 -32 Z" fill="url(#${hatchId})" stroke="none"/>
          <circle cx="-16" cy="-12" r="4.5" fill="var(--topic-accent)" stroke="var(--ink-primary)" stroke-width="1.7"/>
          <circle cx="4" cy="-19" r="3.5" fill="var(--bg-surface)" stroke-width="1.7"/>
          <circle cx="-7" cy="18" r="2.4" fill="var(--ink-primary)" stroke="none"/>
          <circle cx="7" cy="18" r="2.4" fill="var(--ink-primary)" stroke="none"/>
          <path d="M-4 25 Q0 28 4 25" fill="none"/>
        </g>
        <!-- Verified patch badge -->
        <g transform="translate(130, 56)" stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="-18" y="-18" width="36" height="36" rx="10" fill="var(--bg-surface)"/>
          <path d="M-7 0 L-2 6 L9 -6" fill="none" stroke="var(--topic-accent)" stroke-width="2.8"/>
        </g>`;
      break;
    }
  }

  return `<svg viewBox="0 0 180 124" width="100%" height="100%" fill="none" aria-hidden="true" class="crew-topic-svg select-none">
    <defs>
      <pattern id="${hatchId}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-primary)" stroke-width="1.1" stroke-opacity="0.22"/>
      </pattern>
    </defs>
    <line x1="16" y1="114" x2="164" y2="114" stroke="var(--ink-primary)" stroke-width="2.1" stroke-linecap="round" stroke-opacity="0.65"/>
    ${sceneInner}
  </svg>`;
}

/**
 * Renders the visual media frame for a post card or hero:
 * - Always renders a theme-adaptive Crew sketchbook cover plate as the base layer
 * - When post.cover_image_url is present, overlays the real crawled reference image
 *   with lazy loading, no-referrer, and automatic error fallback to the Crew cover underneath.
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
  const hasRealImage = Boolean(opts.coverImageUrl && opts.coverImageUrl.trim().startsWith('https://'));
  const altText = (opts.coverImageAlt || opts.title || 'Story illustration').trim();

  return `<div class="story-media relative ${aspectClass} w-full overflow-hidden" style="--topic-light:${catMeta.color}; --topic-dark:${catMeta.darkColor};">
    <!-- Theme-adaptive hand-drawn Crew fallback / base plate -->
    <div class="story-crew-plate absolute inset-0 flex flex-col justify-between p-3.5 sm:p-4">
      <div class="flex items-center justify-between gap-2">
        <span class="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--topic-accent)]">
          <span class="h-1.5 w-1.5 rounded-full bg-[var(--topic-accent)]"></span>
          ${escapeHtml(catMeta.crewName)}’s Desk
        </span>
        <span class="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">${escapeHtml(archetypeLabel)}</span>
      </div>
      <div class="mx-auto h-[76%] w-full max-w-[220px]">
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
            class="story-real-img relative z-10 h-full w-full object-cover transition-transform duration-500 ease-out"
          />`
        : ''
    }
  </div>`;
}
