import { escapeHtml } from '../lib/security';
import type { SiteSettings } from '../types';
import { renderPyvrenWordmark } from './crew-art';

interface DoodleLinkColumn {
  heading: string;
  links: { label: string; href: string; external?: boolean }[];
}

interface FloaterSpec {
  kind: 'flame' | 'bolt' | 'star' | 'sparkle' | 'heart' | 'spiral' | 'plane';
  x: number;
  y: number;
  phase: number;
  scale: number;
  accent?: boolean;
}

const LINK_COLUMNS: DoodleLinkColumn[] = [
  {
    heading: 'Stories',
    links: [
      { label: 'All Stories', href: '/blog' },
      { label: 'Coding & MCP', href: '/category/ai-coding-agents-mcp' },
      { label: 'AI Security', href: '/category/ai-security-jailbreaks' },
      { label: 'Frontier LLMs', href: '/category/ai-llms' },
    ],
  },
  {
    heading: 'Topics',
    links: [
      { label: 'Cloud & GPU', href: '/category/cloud-gpu-infra' },
      { label: 'Web & Search', href: '/category/agentic-browser-web-data' },
      { label: 'CVEs & Patches', href: '/category/dev-tooling-benchmarks' },
      { label: 'Search Archive', href: '/blog#search' },
    ],
  },
  {
    heading: 'The Desk',
    links: [
      { label: 'About the Co-Work', href: '/about' },
      { label: 'Editorial Standards', href: '/editorial-policy' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Connect',
    links: [
      { label: 'Hamdi on LinkedIn ↗', href: 'https://www.linkedin.com/in/hamdisoudani/', external: true },
      { label: 'RSS Feed', href: '/rss.xml' },
      { label: 'Latest Dispatches', href: '/blog' },
    ],
  },
];

const FLOATERS: FloaterSpec[] = [
  { kind: 'sparkle', x: 74, y: 94, phase: 0.2, scale: 1.0, accent: true },
  { kind: 'flame', x: 194, y: 58, phase: 1.1, scale: 0.96, accent: true },
  { kind: 'bolt', x: 392, y: 50, phase: 2.0, scale: 0.95 },
  { kind: 'star', x: 486, y: 84, phase: 2.8, scale: 0.92, accent: true },
  { kind: 'plane', x: 584, y: 46, phase: 3.5, scale: 1.0 },
  { kind: 'heart', x: 752, y: 58, phase: 4.3, scale: 0.92, accent: true },
  { kind: 'spiral', x: 930, y: 54, phase: 5.0, scale: 0.95 },
  { kind: 'sparkle', x: 1028, y: 74, phase: 0.8, scale: 0.9 },
  { kind: 'bolt', x: 1134, y: 112, phase: 1.9, scale: 0.94, accent: true },
  { kind: 'star', x: 58, y: 214, phase: 3.1, scale: 0.88 },
  { kind: 'heart', x: 1146, y: 216, phase: 4.7, scale: 0.88, accent: true },
  { kind: 'flame', x: 248, y: 90, phase: 5.6, scale: 0.86 },
];

function renderFloaterGlyph(kind: FloaterSpec['kind'], accent?: boolean): string {
  const stroke = accent ? 'var(--dcf-accent)' : 'var(--dcf-ink)';
  switch (kind) {
    case 'flame':
      return `<path d="M0 -13 C5 -7 9 -2 8 5 C7 10 3 13 0 13 C-4 13 -8 9 -8 4 C-8 -1 -4 -5 -2 -9 C-1 -6 1 -5 0 -13 Z" fill="var(--dcf-surface)" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/><path d="M0 -2 C2 1 3 4 2 7 C1 9 -1 9 -2 7 C-3 4 -1 1 0 -2 Z" fill="${stroke}" opacity="0.28"/>`;
    case 'bolt':
      return `<path d="M3 -13 L-7 1 L0 1 L-3 13 L8 -2 L1 -2 Z" fill="var(--dcf-surface)" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`;
    case 'star':
      return `<path d="M0 -12 L3.2 -3.6 L12 -3.2 L4.8 2.2 L7.4 11 L0 5.8 L-7.4 11 L-4.8 2.2 L-12 -3.2 L-3.2 -3.6 Z" fill="var(--dcf-surface)" stroke="${stroke}" stroke-width="1.9" stroke-linejoin="round"/>`;
    case 'sparkle':
      return `<path d="M0 -12 Q1.6 -1.6 12 0 Q1.6 1.6 0 12 Q-1.6 1.6 -12 0 Q-1.6 -1.6 0 -12 Z" fill="var(--dcf-surface)" stroke="${stroke}" stroke-width="1.9" stroke-linejoin="round"/>`;
    case 'heart':
      return `<path d="M0 10 C-9 4 -12 -3 -8 -8 C-5 -11 -1 -9 0 -5 C1 -9 5 -11 8 -8 C12 -3 9 4 0 10 Z" fill="var(--dcf-surface)" stroke="${stroke}" stroke-width="1.9" stroke-linejoin="round"/>`;
    case 'spiral':
      return `<path d="M0 0 C2 -2 5 -1 5 2 C5 6 0 8 -4 6 C-9 4 -10 -3 -6 -7 C-1 -12 8 -11 11 -4" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>`;
    case 'plane':
      return `<path d="M-12 2 L12 -8 L4 11 L-1 4 Z M12 -8 L-1 4 L-2 9" fill="var(--dcf-surface)" stroke="${stroke}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
}

function renderBoltIcon(): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13.5 2.5L5.5 13h6l-1.5 8.5L18.5 11h-6l1-8.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderFlameIcon(): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12.5 2.5C15.5 6 19 9.2 18.6 14.2c-.3 3.8-3.1 7.3-6.6 7.3-3.8 0-6.8-3.1-6.8-7 0-3.3 2.1-5.8 3.6-8.3.3 1.7 1.3 2.7 2.2 2.9-.4-2.4.1-4.9 1.5-6.6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderArrowUpIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5m0 0l-6 6m6-6l6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderDoodleStageSvg(): string {
  const floatersSvg = FLOATERS.map(
    (f, idx) => `<g class="dcf-floater" data-idx="${idx}" data-fx="${f.x}" data-fy="${f.y}" data-phase="${f.phase}" data-scale="${f.scale}" transform="translate(${f.x}, ${f.y}) scale(${f.scale})" role="button" tabindex="0" aria-label="Pop ${f.kind} doodle">
      <circle cx="0" cy="0" r="19" fill="transparent"/>
      <g class="dcf-floater-inner">${renderFloaterGlyph(f.kind, f.accent)}</g>
    </g>`,
  ).join('\n      ');

  return `<svg class="dcf-svg" viewBox="0 0 1200 370" fill="none" role="img" aria-label="Hand-drawn PYVREN wordmark with six interactive Doodle Crew characters: Bruno, Pip, Morel, Juno, Boo, and Patch">
    <defs>
      <pattern id="pyv-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--dcf-ink)" stroke-width="1.35" stroke-opacity="0.34"/>
      </pattern>
      <filter id="pyv-boil0" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.024" numOctaves="2" seed="2" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="pyv-boil1" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.024" numOctaves="2" seed="9" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.65" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="pyv-boil2" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.024" numOctaves="2" seed="17" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="pyv-ink" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.065 0.14" numOctaves="3" seed="11" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.4" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>

    <!-- Floating interactive doodles -->
    <g class="dcf-floaters-layer">
      ${floatersSvg}
    </g>

    <!-- Boiled hand-drawn world -->
    <g class="dcf-boil" filter="url(#pyv-boil0)">

      <!-- BEHIND-LETTER LAYER: Ghost (Boo) peeking behind letter 4 (E) -->
      <g class="dcf-char" data-char="ghost" data-name="Boo" data-say="Boo! Caught a hallucination." data-bx="840" data-by="44">
        <g class="dcf-char-body" transform="translate(840, 124)">
          <path d="M-34 12 C-36 -28 -26 -64 0 -64 C26 -64 36 -28 34 12 Z" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.6" stroke-linejoin="round"/>
          <path d="M-24 -8 C-24 -36 -16 -54 0 -54 C-8 -36 -10 -16 -8 10 Z" fill="url(#pyv-hatch)"/>
          <ellipse cx="-18" cy="-18" rx="4.5" ry="2.6" fill="var(--dcf-accent)" opacity="0.34"/>
          <ellipse cx="18" cy="-18" rx="4.5" ry="2.6" fill="var(--dcf-accent)" opacity="0.34"/>
          <g class="dcf-eye-group">
            <ellipse cx="-11" cy="-30" rx="5.2" ry="6.2" fill="var(--dcf-bg)" stroke="var(--dcf-ink)" stroke-width="1.8"/>
            <ellipse cx="11" cy="-30" rx="5.2" ry="6.2" fill="var(--dcf-bg)" stroke="var(--dcf-ink)" stroke-width="1.8"/>
            <circle class="dcf-pupil" data-cx="-11" data-cy="-30" data-r="2.4" cx="-11" cy="-30" r="2.6" fill="var(--dcf-ink)"/>
            <circle class="dcf-pupil" data-cx="11" data-cy="-30" data-r="2.4" cx="11" cy="-30" r="2.6" fill="var(--dcf-ink)"/>
          </g>
          <ellipse cx="0" cy="-14" rx="4.2" ry="5.2" fill="var(--dcf-ink)"/>
        </g>
      </g>

      <!-- GIANT DRY-BRUSH INK WORDMARK: PYVREN -->
      <g class="dcf-wordmark" filter="url(#pyv-ink)" fill="var(--dcf-ink)">
        <!-- Letter 0: P -->
        <path fill-rule="evenodd" d="M108 312 L108 122 L196 122 C230 122 246 144 246 178 C246 212 228 236 192 236 L152 236 L152 312 Z M152 158 L152 200 L186 200 C198 200 205 192 205 179 C205 166 198 158 186 158 Z"/>
        <!-- Letter 1: Y -->
        <path d="M266 122 L314 122 L340 190 L366 122 L414 122 L362 232 L362 312 L318 312 L318 232 Z"/>
        <!-- Letter 2: V -->
        <path d="M434 122 L480 122 L508 250 L536 122 L582 122 L532 312 L484 312 Z"/>
        <!-- Letter 3: R -->
        <path fill-rule="evenodd" d="M604 312 L604 122 L692 122 C726 122 744 144 744 176 C744 202 732 220 710 228 L748 312 L700 312 L668 234 L648 234 L648 312 Z M648 158 L648 198 L684 198 C696 198 702 190 702 178 C702 166 696 158 684 158 Z"/>
        <!-- Letter 4: E -->
        <path d="M774 312 L774 122 L904 122 L904 160 L818 160 L818 198 L888 198 L888 234 L818 234 L818 274 L904 274 L904 312 Z"/>
        <!-- Letter 5: N -->
        <path d="M932 312 L932 122 L976 122 L1032 238 L1032 122 L1074 122 L1074 312 L1030 312 L974 196 L974 312 Z"/>
      </g>

      <!-- Subtle ink-dust puffs at letter bases -->
      <g class="dcf-dust" stroke="var(--dcf-ink)" stroke-width="1.6" stroke-linecap="round" opacity="0.48">
        <path d="M92 312 Q98 306 104 311 M252 312 Q258 307 264 312 M418 312 Q424 307 430 312 M590 312 Q595 307 601 312 M758 312 Q764 306 770 312 M914 312 Q920 307 926 312"/>
        <circle cx="96" cy="302" r="1.4" fill="var(--dcf-ink)"/>
        <circle cx="424" cy="301" r="1.3" fill="var(--dcf-ink)"/>
        <circle cx="763" cy="300" r="1.5" fill="var(--dcf-ink)"/>
        <circle cx="921" cy="302" r="1.2" fill="var(--dcf-ink)"/>
      </g>

      <!-- Sketchy ground line with grass tufts and pebbles -->
      <g class="dcf-ground" stroke="var(--dcf-ink)" stroke-linecap="round" stroke-linejoin="round">
        <path d="M36 314 Q240 310 460 315 T900 313 T1164 315" stroke-width="2.4"/>
        <path d="M74 322 Q320 319 610 323 T1128 321" stroke-width="1.2" opacity="0.42"/>
        <!-- Grass tufts -->
        <path d="M64 313 L60 301 M66 313 L67 298 M69 313 L74 303" stroke-width="1.9"/>
        <path d="M278 314 L274 303 M281 314 L283 300 M284 314 L289 304" stroke-width="1.8"/>
        <path d="M582 314 L579 304 M585 314 L588 301" stroke-width="1.8"/>
        <path d="M892 313 L888 302 M895 313 L897 299 M898 313 L903 304" stroke-width="1.8"/>
        <path d="M1138 314 L1134 303 M1141 314 L1143 299 M1144 314 L1149 304" stroke-width="1.9"/>
        <!-- Pebbles -->
        <ellipse cx="222" cy="328" rx="6" ry="2.6" fill="var(--dcf-surface)" stroke-width="1.6"/>
        <ellipse cx="386" cy="330" rx="4.5" ry="2.1" fill="var(--dcf-surface)" stroke-width="1.5"/>
        <ellipse cx="642" cy="329" rx="7" ry="2.8" fill="var(--dcf-surface)" stroke-width="1.6"/>
        <ellipse cx="826" cy="328" rx="5" ry="2.2" fill="var(--dcf-surface)" stroke-width="1.5"/>
        <ellipse cx="1008" cy="330" rx="6.2" ry="2.4" fill="var(--dcf-surface)" stroke-width="1.6"/>
      </g>

      <!-- FRONT-OF-LETTER LAYER: Ghost (Boo) gripping hands rendered OVER E's top edge -->
      <g class="dcf-char dcf-char-overlay" data-char="ghost">
        <g class="dcf-char-body" transform="translate(840, 124)">
          <path d="M-38 -2 C-38 -10 -24 -10 -24 -1 C-24 6 -37 6 -38 -2 Z" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.4" stroke-linejoin="round"/>
          <path d="M24 -1 C24 -10 38 -10 38 -2 C37 6 24 6 24 -1 Z" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.4" stroke-linejoin="round"/>
          <path d="M-33 1 L-33 -4 M-29 2 L-29 -4 M29 2 L29 -4 M33 1 L33 -4" stroke="var(--dcf-ink)" stroke-width="1.5" stroke-linecap="round"/>
        </g>
        <rect class="dcf-hit" data-target="ghost" x="794" y="54" width="92" height="84" rx="14" fill="transparent" role="button" tabindex="0" aria-label="Say hello to Boo the Ghost"/>
      </g>

      <!-- CHARACTER 1: Yeti (Bruno) standing in front of letter 0 (P) -->
      <g class="dcf-char" data-char="yeti" data-name="Bruno" data-say="Every benchmark verified at the source." data-bx="150" data-by="166">
        <g class="dcf-char-body" transform="translate(150, 314)">
          <!-- Ground shadow -->
          <ellipse cx="0" cy="2" rx="36" ry="6" fill="var(--dcf-ink)" opacity="0.14"/>
          <!-- Chunky feet -->
          <path d="M-24 -2 C-28 4 -12 5 -9 0 L-10 -14 L-23 -14 Z" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M9 0 C12 5 28 4 24 -2 L23 -14 L10 -14 Z" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linejoin="round"/>
          <!-- Horns -->
          <path d="M-24 -108 C-34 -124 -22 -134 -14 -116" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M24 -108 C34 -124 22 -134 14 -116" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- Shaggy body -->
          <path d="M-34 -14 L-40 -36 L-35 -54 L-40 -74 C-38 -104 -24 -118 0 -118 C24 -118 38 -104 40 -74 L35 -54 L40 -36 L34 -14 C16 -9 -16 -9 -34 -14 Z" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.6" stroke-linejoin="round"/>
          <!-- Hatched shaggy belly -->
          <ellipse cx="0" cy="-42" rx="24" ry="22" fill="url(#pyv-hatch)" stroke="var(--dcf-ink)" stroke-width="1.6"/>
          <!-- Arms -->
          <path d="M-36 -74 C-49 -64 -50 -42 -39 -34 C-34 -31 -30 -36 -31 -44" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M36 -74 C49 -64 50 -42 39 -34 C34 -31 30 -36 31 -44" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- Editorial crimson scarf -->
          <path d="M-26 -72 Q0 -63 26 -72 L24 -62 Q0 -54 -24 -62 Z" fill="var(--dcf-accent)" stroke="var(--dcf-ink)" stroke-width="2" stroke-linejoin="round"/>
          <path d="M14 -64 L22 -44 L12 -42 L7 -61 Z" fill="var(--dcf-accent)" stroke="var(--dcf-ink)" stroke-width="2" stroke-linejoin="round"/>
          <!-- Face plate -->
          <ellipse cx="0" cy="-90" rx="22" ry="16" fill="var(--dcf-bg)" stroke="var(--dcf-ink)" stroke-width="2"/>
          <g class="dcf-eye-group">
            <circle cx="-9" cy="-92" r="5" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="1.8"/>
            <circle cx="9" cy="-92" r="5" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="1.8"/>
            <circle class="dcf-pupil" data-cx="-9" data-cy="-92" data-r="2.2" cx="-9" cy="-92" r="2.4" fill="var(--dcf-ink)"/>
            <circle class="dcf-pupil" data-cx="9" data-cy="-92" data-r="2.2" cx="9" cy="-92" r="2.4" fill="var(--dcf-ink)"/>
          </g>
          <!-- Smile & tiny fang -->
          <path d="M-9 -82 Q0 -75 9 -82" stroke="var(--dcf-ink)" stroke-width="2" stroke-linecap="round"/>
          <path d="M4 -80 L6 -76 L8 -81" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="1.4" stroke-linejoin="round"/>
        </g>
        <rect class="dcf-hit" data-target="yeti" x="102" y="180" width="96" height="140" rx="16" fill="transparent" role="button" tabindex="0" aria-label="Say hello to Bruno the Yeti"/>
      </g>

      <!-- CHARACTER 2: Bird (Pip) sitting on top of letter 1 (Y) -->
      <g class="dcf-char" data-char="bird" data-name="Pip" data-say="Fresh benchmarks just dropped!" data-bx="290" data-by="52">
        <g class="dcf-char-body" transform="translate(290, 122)">
          <!-- Twig feet gripping top of Y -->
          <path d="M-8 0 L-8 -10 M-12 0 L-4 0 M6 0 L6 -10 M2 0 L10 0" stroke="var(--dcf-ink)" stroke-width="2.2" stroke-linecap="round"/>
          <!-- Tail feathers -->
          <path d="M-20 -20 L-36 -30 L-30 -16 L-38 -12 L-20 -11 Z" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.3" stroke-linejoin="round"/>
          <!-- Plump songbird body -->
          <path d="M-22 -24 C-22 -48 -6 -60 12 -54 C24 -50 28 -36 24 -20 C20 -8 -16 -6 -22 -24 Z" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linejoin="round"/>
          <!-- Tuft crest -->
          <path d="M2 -55 C0 -66 7 -69 9 -58 C12 -65 18 -64 15 -53" fill="var(--dcf-accent)" stroke="var(--dcf-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- Folded hatched wing -->
          <path d="M-14 -30 C-2 -34 10 -24 6 -15 C-4 -12 -14 -18 -14 -30 Z" fill="url(#pyv-hatch)" stroke="var(--dcf-ink)" stroke-width="2" stroke-linejoin="round"/>
          <!-- Beak -->
          <path d="M24 -40 L37 -36 L24 -31 Z" fill="var(--dcf-accent)" stroke="var(--dcf-ink)" stroke-width="2" stroke-linejoin="round"/>
          <!-- Eye -->
          <g class="dcf-eye-group">
            <circle cx="12" cy="-42" r="5.5" fill="var(--dcf-bg)" stroke="var(--dcf-ink)" stroke-width="1.9"/>
            <circle class="dcf-pupil" data-cx="12" data-cy="-42" data-r="2.4" cx="12" cy="-42" r="2.6" fill="var(--dcf-ink)"/>
          </g>
        </g>
        <rect class="dcf-hit" data-target="bird" x="250" y="50" width="82" height="76" rx="14" fill="transparent" role="button" tabindex="0" aria-label="Say hello to Pip the Bird"/>
      </g>

      <!-- CHARACTER 3: Mushroom (Morel) standing in front of letter 2 (V) -->
      <g class="dcf-char" data-char="mushroom" data-name="Morel" data-say="Checked CISA KEV twice today." data-bx="508" data-by="202">
        <g class="dcf-char-body" transform="translate(508, 314)">
          <ellipse cx="0" cy="2" rx="30" ry="5.5" fill="var(--dcf-ink)" opacity="0.14"/>
          <!-- Stubby legs -->
          <path d="M-12 -10 L-13 0 C-13 4 -5 4 -5 0 L-5 -10" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.4" stroke-linejoin="round"/>
          <path d="M5 -10 L5 0 C5 4 13 4 13 0 L12 -10" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.4" stroke-linejoin="round"/>
          <!-- Stout stem body -->
          <path d="M-21 -10 C-23 -28 -20 -48 -17 -54 L17 -54 C20 -48 23 -28 21 -10 C10 -6 -10 -6 -21 -10 Z" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M-18 -14 C-14 -12 -8 -11 -4 -11 L-6 -46 L-17 -46 Z" fill="url(#pyv-hatch)"/>
          <!-- Tiny arms -->
          <path d="M-21 -34 C-31 -32 -32 -22 -24 -20" stroke="var(--dcf-ink)" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M21 -34 C31 -32 32 -22 24 -20" stroke="var(--dcf-ink)" stroke-width="2.4" stroke-linecap="round"/>
          <!-- Spotted dome cap -->
          <path d="M-42 -50 C-44 -86 -22 -102 0 -102 C22 -102 44 -86 42 -50 C20 -44 -20 -44 -42 -50 Z" fill="var(--dcf-accent)" stroke="var(--dcf-ink)" stroke-width="2.6" stroke-linejoin="round"/>
          <!-- Cap spots -->
          <circle cx="-18" cy="-76" r="7" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="1.7"/>
          <circle cx="14" cy="-82" r="6" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="1.7"/>
          <circle cx="24" cy="-62" r="5" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="1.7"/>
          <circle cx="-2" cy="-62" r="4.5" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="1.6"/>
          <!-- Eyes & smile -->
          <g class="dcf-eye-group">
            <circle cx="-8" cy="-34" r="4.4" fill="var(--dcf-bg)" stroke="var(--dcf-ink)" stroke-width="1.8"/>
            <circle cx="8" cy="-34" r="4.4" fill="var(--dcf-bg)" stroke="var(--dcf-ink)" stroke-width="1.8"/>
            <circle class="dcf-pupil" data-cx="-8" data-cy="-34" data-r="1.9" cx="-8" cy="-34" r="2.2" fill="var(--dcf-ink)"/>
            <circle class="dcf-pupil" data-cx="8" data-cy="-34" data-r="1.9" cx="8" cy="-34" r="2.2" fill="var(--dcf-ink)"/>
          </g>
          <path d="M-5 -24 Q0 -20 5 -24" stroke="var(--dcf-ink)" stroke-width="1.9" stroke-linecap="round"/>
        </g>
        <rect class="dcf-hit" data-target="mushroom" x="462" y="206" width="92" height="114" rx="16" fill="transparent" role="button" tabindex="0" aria-label="Say hello to Morel the Mushroom"/>
      </g>

      <!-- CHARACTER 4: Kid (Juno) sitting on top of letter 3 (R) with legs dangling -->
      <g class="dcf-char" data-char="kid" data-name="Juno" data-say="Best seat on the edge network." data-bx="660" data-by="28">
        <g class="dcf-char-body" transform="translate(660, 122)">
          <!-- Dangling legs over front of R -->
          <g class="dcf-kid-legs">
            <path d="M-12 -2 L-16 32 C-17 37 -24 38 -24 33 C-24 29 -18 28 -16 28" fill="none" stroke="var(--dcf-ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <ellipse cx="-18" cy="34" rx="7.5" ry="4.5" fill="var(--dcf-accent)" stroke="var(--dcf-ink)" stroke-width="2"/>
            <path d="M12 -2 L15 28 C16 33 23 34 23 29" fill="none" stroke="var(--dcf-ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <ellipse cx="18" cy="31" rx="7.5" ry="4.5" fill="var(--dcf-accent)" stroke="var(--dcf-ink)" stroke-width="2"/>
          </g>
          <!-- Sweater torso -->
          <path d="M-20 2 C-22 -18 -18 -36 -14 -44 L14 -44 C18 -36 22 -18 20 2 Z" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M-19 -14 L19 -14 M-18 -26 L18 -26" stroke="var(--dcf-ink)" stroke-width="2"/>
          <rect x="-18" y="-26" width="36" height="12" fill="url(#pyv-hatch)"/>
          <!-- Hands resting on R's top bar -->
          <path d="M-18 -32 C-28 -22 -28 -6 -20 1" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M18 -32 C28 -22 28 -6 20 1" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="-20" cy="2" r="4" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2"/>
          <circle cx="20" cy="2" r="4" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2"/>
          <!-- Head -->
          <circle cx="0" cy="-64" r="20" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.5"/>
          <!-- Beanie + messy bangs -->
          <path d="M-20 -68 C-19 -88 19 -88 20 -68 Z" fill="var(--dcf-accent)" stroke="var(--dcf-ink)" stroke-width="2.3" stroke-linejoin="round"/>
          <circle cx="0" cy="-87" r="5" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2"/>
          <path d="M-14 -68 L-10 -61 M-4 -69 L-2 -62 M6 -69 L9 -62" stroke="var(--dcf-ink)" stroke-width="2" stroke-linecap="round"/>
          <!-- Eyes & grin -->
          <g class="dcf-eye-group">
            <circle cx="-7" cy="-60" r="4" fill="var(--dcf-bg)" stroke="var(--dcf-ink)" stroke-width="1.7"/>
            <circle cx="7" cy="-60" r="4" fill="var(--dcf-bg)" stroke="var(--dcf-ink)" stroke-width="1.7"/>
            <circle class="dcf-pupil" data-cx="-7" data-cy="-60" data-r="1.8" cx="-7" cy="-60" r="2.1" fill="var(--dcf-ink)"/>
            <circle class="dcf-pupil" data-cx="7" data-cy="-60" data-r="1.8" cx="7" cy="-60" r="2.1" fill="var(--dcf-ink)"/>
          </g>
          <path d="M-6 -51 Q0 -46 6 -51" stroke="var(--dcf-ink)" stroke-width="1.9" stroke-linecap="round"/>
        </g>
        <rect class="dcf-hit" data-target="kid" x="626" y="28" width="68" height="134" rx="14" fill="transparent" role="button" tabindex="0" aria-label="Say hello to Juno the Kid"/>
      </g>

      <!-- CHARACTER 6: Cat (Patch) standing front right of letter 5 (N), flipped horizontally -->
      <g class="dcf-char" data-char="cat" data-name="Patch" data-say="Arr. Nice cursor. Try popping a doodle!" data-bx="1090" data-by="192">
        <g class="dcf-char-body" transform="translate(1090, 314)">
          <g transform="scale(-1, 1)">
            <ellipse cx="0" cy="2" rx="28" ry="5.5" fill="var(--dcf-ink)" opacity="0.14"/>
            <!-- Curled pirate cat tail -->
            <path d="M-20 -18 C-42 -24 -46 -54 -32 -60 C-24 -63 -20 -55 -26 -50" fill="none" stroke="var(--dcf-ink)" stroke-width="3" stroke-linecap="round"/>
            <!-- Body -->
            <path d="M-22 -8 C-26 -30 -20 -58 -14 -68 L14 -68 C22 -56 26 -30 22 -8 C10 -3 -10 -3 -22 -8 Z" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linejoin="round"/>
            <ellipse cx="2" cy="-30" rx="13" ry="16" fill="url(#pyv-hatch)"/>
            <!-- Paws -->
            <ellipse cx="-10" cy="-3" rx="7" ry="4.2" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.2"/>
            <ellipse cx="10" cy="-3" rx="7" ry="4.2" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.2"/>
            <!-- Crimson pirate collar -->
            <path d="M-16 -64 Q0 -58 16 -64" stroke="var(--dcf-accent)" stroke-width="4" stroke-linecap="round"/>
            <!-- Head + pointed ears -->
            <path d="M-20 -78 L-23 -106 L-8 -94 C-3 -96 3 -96 8 -94 L23 -106 L20 -78 C22 -64 12 -58 0 -58 C-12 -58 -22 -64 -20 -78 Z" fill="var(--dcf-surface)" stroke="var(--dcf-ink)" stroke-width="2.5" stroke-linejoin="round"/>
            <!-- Pirate eye-patch strap + patch over left eye -->
            <path d="M-20 -84 L20 -76" stroke="var(--dcf-ink)" stroke-width="2.2"/>
            <ellipse cx="-8" cy="-81" rx="6.2" ry="5.4" fill="var(--dcf-ink)"/>
            <!-- Good eye with cursor-tracking pupil (data-flip="-1" for horizontal flip!) -->
            <g class="dcf-eye-group">
              <circle cx="9" cy="-78" r="5" fill="var(--dcf-bg)" stroke="var(--dcf-ink)" stroke-width="1.8"/>
              <circle class="dcf-pupil" data-cx="9" data-cy="-78" data-r="2.2" data-flip="-1" cx="9" cy="-78" r="2.4" fill="var(--dcf-ink)"/>
            </g>
            <!-- Nose, whiskers & smirk -->
            <path d="M-2 -71 L2 -71 L0 -68 Z" fill="var(--dcf-accent)"/>
            <path d="M-5 -66 Q0 -63 6 -67" stroke="var(--dcf-ink)" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M-18 -72 L-30 -74 M-18 -68 L-29 -66 M18 -72 L30 -74 M18 -68 L29 -66" stroke="var(--dcf-ink)" stroke-width="1.6" stroke-linecap="round"/>
          </g>
        </g>
        <rect class="dcf-hit" data-target="cat" x="1046" y="204" width="90" height="118" rx="16" fill="transparent" role="button" tabindex="0" aria-label="Say hello to Patch the Cat"/>
      </g>

    </g>
  </svg>`;
}

const DOODLE_FOOTER_INLINE_SCRIPT = `(function(){
  var footer = document.querySelector('[data-dcf-footer]');
  if (!footer || footer.getAttribute('data-dcf-init') === '1') return;
  footer.setAttribute('data-dcf-init', '1');

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var svg = footer.querySelector('.dcf-svg');
  var boilEl = footer.querySelector('.dcf-boil');
  var bubble = footer.querySelector('.dcf-bubble');
  var bubbleName = footer.querySelector('.dcf-bubble-name');
  var bubbleText = footer.querySelector('.dcf-bubble-text');
  var topBtn = footer.querySelector('[data-dcf-top]');
  var pupils = Array.prototype.slice.call(footer.querySelectorAll('.dcf-pupil'));
  var eyeGroups = Array.prototype.slice.call(footer.querySelectorAll('.dcf-eye-group'));
  var floaters = Array.prototype.slice.call(footer.querySelectorAll('.dcf-floater')).map(function(el){
    return {
      el: el,
      bx: parseFloat(el.getAttribute('data-fx') || '0'),
      by: parseFloat(el.getAttribute('data-fy') || '0'),
      x: parseFloat(el.getAttribute('data-fx') || '0'),
      y: parseFloat(el.getAttribute('data-fy') || '0'),
      vx: 0,
      vy: 0,
      phase: parseFloat(el.getAttribute('data-phase') || '0'),
      scale: parseFloat(el.getAttribute('data-scale') || '1'),
      popped: false
    };
  });

  var playing = false;
  var rafId = 0;
  var boilIdx = 0;
  var lastBoil = 0;
  var ptrX = -9999;
  var ptrY = -9999;
  var ptrSvgX = -9999;
  var ptrSvgY = -9999;
  var bubbleTimer = 0;

  function toSvgPoint(clientX, clientY) {
    if (!svg) return null;
    var rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * 1200,
      y: ((clientY - rect.top) / rect.height) * 370
    };
  }

  function lookAt() {
    if (!svg || ptrX < -9000) return;
    for (var i = 0; i < pupils.length; i++) {
      var p = pupils[i];
      var rect = p.getBoundingClientRect();
      var cx = rect.left + rect.width * 0.5;
      var cy = rect.top + rect.height * 0.5;
      var dx = ptrX - cx;
      var dy = ptrY - cy;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var maxR = parseFloat(p.getAttribute('data-r') || '2.2');
      var strength = Math.min(1, dist / 140);
      var flip = parseFloat(p.getAttribute('data-flip') || '1');
      var ox = (dx / dist) * maxR * strength * flip;
      var oy = (dy / dist) * maxR * strength;
      var baseX = parseFloat(p.getAttribute('data-cx') || '0');
      var baseY = parseFloat(p.getAttribute('data-cy') || '0');
      p.setAttribute('cx', (baseX + ox).toFixed(2));
      p.setAttribute('cy', (baseY + oy).toFixed(2));
    }
  }

  function stepFloater(f, t) {
    if (f.popped) return;
    var tx = f.bx + Math.sin(t * 0.0012 + f.phase) * 9;
    var ty = f.by + Math.cos(t * 0.0016 + f.phase * 1.3) * 7;
    f.vx += (tx - f.x) * 0.04;
    f.vy += (ty - f.y) * 0.04;
    if (ptrSvgX > -1000) {
      var dx = f.x - ptrSvgX;
      var dy = f.y - ptrSvgY;
      var d2 = dx * dx + dy * dy;
      if (d2 < 8100 && d2 > 0.01) {
        var d = Math.sqrt(d2);
        var push = (90 - d) * 0.065;
        f.vx += (dx / d) * push;
        f.vy += (dy / d) * push;
      }
    }
    f.vx *= 0.84;
    f.vy *= 0.84;
    f.x += f.vx;
    f.y += f.vy;
    var rot = Math.sin(t * 0.0015 + f.phase) * 9 + f.vx * 1.8;
    f.el.setAttribute(
      'transform',
      'translate(' + f.x.toFixed(1) + ', ' + f.y.toFixed(1) + ') rotate(' + rot.toFixed(1) + ') scale(' + f.scale + ')'
    );
  }

  function popFloater(f) {
    if (f.popped) return;
    f.popped = true;
    f.el.classList.add('is-pop');
    window.setTimeout(function(){
      f.x = f.bx;
      f.y = f.by;
      f.vx = 0;
      f.vy = 0;
      f.el.classList.remove('is-pop');
      f.popped = false;
    }, 950);
  }

  floaters.forEach(function(f){
    f.el.addEventListener('click', function(){ popFloater(f); });
    f.el.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        popFloater(f);
      }
    });
  });

  function triggerCharacter(charId) {
    var groups = footer.querySelectorAll('.dcf-char[data-char="' + charId + '"]');
    var primary = null;
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (!primary && g.getAttribute('data-say')) primary = g;
      g.classList.remove('is-hop');
      void g.getBoundingClientRect();
      g.classList.add('is-hop');
      (function(node){
        window.setTimeout(function(){ node.classList.remove('is-hop'); }, 560);
      })(g);
    }
    if (primary && bubble && bubbleName && bubbleText) {
      var name = primary.getAttribute('data-name') || '';
      var say = primary.getAttribute('data-say') || '';
      var bx = parseFloat(primary.getAttribute('data-bx') || '600');
      var by = parseFloat(primary.getAttribute('data-by') || '120');
      var leftPct = Math.max(14, Math.min(86, (bx / 1200) * 100));
      var topPct = Math.max(2, Math.min(68, (by / 370) * 100));
      bubbleName.textContent = name;
      bubbleText.textContent = say;
      bubble.style.left = leftPct.toFixed(1) + '%';
      bubble.style.top = topPct.toFixed(1) + '%';
      bubble.classList.add('is-open');
      if (bubbleTimer) window.clearTimeout(bubbleTimer);
      bubbleTimer = window.setTimeout(function(){
        bubble.classList.remove('is-open');
      }, 2600);
    }
  }

  var hits = footer.querySelectorAll('.dcf-hit');
  for (var h = 0; h < hits.length; h++) {
    (function(hit){
      var target = hit.getAttribute('data-target') || '';
      hit.addEventListener('click', function(){ triggerCharacter(target); });
      hit.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerCharacter(target);
        }
      });
    })(hits[h]);
  }

  var blinkTimer = 0;
  function scheduleBlink() {
    if (reduced || !eyeGroups.length) return;
    var delay = 2200 + Math.random() * 2600;
    blinkTimer = window.setTimeout(function(){
      if (playing) {
        var idx = Math.floor(Math.random() * eyeGroups.length);
        var eg = eyeGroups[idx];
        eg.classList.add('is-blink');
        window.setTimeout(function(){ eg.classList.remove('is-blink'); }, 140);
      }
      scheduleBlink();
    }, delay);
  }

  function tick(t) {
    if (!playing) {
      rafId = 0;
      return;
    }
    if (boilEl && t - lastBoil >= 125) {
      lastBoil = t;
      boilIdx = (boilIdx + 1) % 3;
      boilEl.setAttribute('filter', 'url(#pyv-boil' + boilIdx + ')');
    }
    lookAt();
    for (var i = 0; i < floaters.length; i++) {
      stepFloater(floaters[i], t);
    }
    rafId = window.requestAnimationFrame(tick);
  }

  function setPlay(on) {
    playing = on;
    footer.dataset.play = on ? '1' : '0';
    if (on && !reduced && !rafId) {
      rafId = window.requestAnimationFrame(tick);
    }
    if (!on && rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  window.addEventListener('pointermove', function(e){
    if (!playing) return;
    ptrX = e.clientX;
    ptrY = e.clientY;
    var pt = toSvgPoint(e.clientX, e.clientY);
    if (pt) {
      ptrSvgX = pt.x;
      ptrSvgY = pt.y;
    }
  }, { passive: true });

  footer.addEventListener('pointerleave', function(){
    ptrSvgX = -9999;
    ptrSvgY = -9999;
  }, { passive: true });

  if (topBtn) {
    topBtn.addEventListener('click', function(){
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  if (reduced) {
    footer.dataset.play = '1';
  } else if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].target === footer) {
          setPlay(entries[i].isIntersecting);
        }
      }
    }, { rootMargin: '80px 0px', threshold: 0.02 });
    io.observe(footer);
    scheduleBlink();
  } else {
    setPlay(true);
    scheduleBlink();
  }

  window.addEventListener('pagehide', function(){
    if (blinkTimer) window.clearTimeout(blinkTimer);
    setPlay(false);
  });
})();`;

export function renderDoodleCrewFooter(settings: SiteSettings): string {
  const siteName = settings.site_name || 'The Pyvren Dispatch';
  const tagline =
    settings.site_tagline ||
    'Field notes, benchmarks, and deep dives into AI systems, security, and cloud craft — co-crafted by Hamdi Soudani & Pyvren.';
  const author = settings.default_author || 'Hamdi Soudani';
  const year = new Date().getUTCFullYear();

  const columnsHtml = LINK_COLUMNS.map(
    (col) => `<div class="dcf-col">
        <h2 class="dcf-col-title">${escapeHtml(col.heading)}</h2>
        <ul class="dcf-col-list">
          ${col.links
            .map(
              (l) =>
                `<li><a href="${escapeHtml(l.href)}"${l.external ? ' target="_blank" rel="noopener noreferrer"' : ''} class="dcf-link">${escapeHtml(l.label)}</a></li>`,
            )
            .join('\n          ')}
        </ul>
      </div>`,
  ).join('\n      ');

  return `<footer class="dcf" data-dcf-footer data-play="0">
  <div class="dcf-inner">
    <div class="dcf-top">
      <div class="dcf-brand">
        ${renderPyvrenWordmark({ siteName, variant: 'footer' })}
        <p class="dcf-brand-blurb">${escapeHtml(tagline)}</p>
        <p class="dcf-brand-meta font-tabular">Co-crafted by ${escapeHtml(author)} &amp; Pyvren · Primary sources &amp; real code</p>
      </div>

      <nav class="dcf-cols" aria-label="Footer navigation">
      ${columnsHtml}
      </nav>
    </div>

    <div class="dcf-cta-band">
      <div class="dcf-cta-copy">
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true" class="shrink-0"><path d="M10 2L12.1 7.6L18 9.8L12.1 12L10 17.8L7.9 12L2 9.8L7.9 7.6L10 2Z" fill="var(--dcf-accent)" stroke="var(--dcf-ink)" stroke-width="1.5" stroke-linejoin="round"/></svg>
        <span>Tap any crew member below for a desk note — or connect with ${escapeHtml(author)} on LinkedIn.</span>
      </div>
      <div class="dcf-cta-actions">
        <a href="/blog" class="dcf-pill dcf-pill--outline">
          ${renderBoltIcon()}
          <span>Read Stories</span>
        </a>
        <a href="https://www.linkedin.com/in/hamdisoudani/" target="_blank" rel="noopener noreferrer" class="dcf-pill dcf-pill--solid">
          ${renderFlameIcon()}
          <span>Connect on LinkedIn</span>
        </a>
      </div>
    </div>

    <div class="dcf-stage-wrap">
      <div class="dcf-bubble" role="status" aria-live="polite">
        <strong class="dcf-bubble-name"></strong>
        <span class="dcf-bubble-text"></span>
      </div>
      ${renderDoodleStageSvg()}
    </div>

    <div class="dcf-bottom">
      <p class="dcf-copy">&copy; ${year} ${escapeHtml(siteName)} &middot; Co-crafted by <a href="https://www.linkedin.com/in/hamdisoudani/" target="_blank" rel="noopener noreferrer" class="underline decoration-[var(--dcf-accent)] underline-offset-4 hover:text-[var(--dcf-accent)]">${escapeHtml(author)}</a> &amp; Pyvren.</p>
      <div class="dcf-bottom-links">
        <a href="https://www.linkedin.com/in/hamdisoudani/" target="_blank" rel="noopener noreferrer" class="dcf-bottom-link font-medium">LinkedIn ↗</a>
        <span class="dcf-sep" aria-hidden="true">&middot;</span>
        <a href="/about" class="dcf-bottom-link">About</a>
        <a href="/editorial-policy" class="dcf-bottom-link">Editorial</a>
        <a href="/privacy" class="dcf-bottom-link">Privacy</a>
        <a href="/contact" class="dcf-bottom-link">Contact</a>
        <a href="/rss.xml" class="dcf-bottom-link">RSS</a>
      </div>
      <button type="button" class="dcf-top-btn" data-dcf-top aria-label="Back to top">
        <span>Back to top</span>
        ${renderArrowUpIcon()}
      </button>
    </div>
  </div>
  <script>${DOODLE_FOOTER_INLINE_SCRIPT}</script>
</footer>`;
}
