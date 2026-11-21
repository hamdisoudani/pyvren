import type {
  Archetype,
  FaqItem,
  HumanitySignals,
  KeyFact,
  LintResult,
  QualityBreakdown,
} from '../types';
import { ARCHETYPES } from './skills';

export const BANNED_SLOP_PHRASES: string[] = [
  'delve',
  'delving',
  "in today's fast-paced",
  'ever-evolving',
  'testament to',
  'game-changer',
  'unlock the power',
  'unlocking the power',
  'it is important to note',
  "it's worth noting",
  'in conclusion',
  'without further ado',
  'tapestry',
  'realm of',
  'paradigm shift',
  'seamless',
  'seamlessly',
  'leverage',
  'leveraging',
  "in today's digital landscape",
  'crucial role',
  'robust solution',
  'comprehensive guide',
  'cutting-edge',
  'revolutionize',
  'revolutionizing',
  'navigate the complexities',
  'spearhead',
  'pivotal',
  'paramount',
  'meticulous',
  'meticulously',
  'intricate',
  'beacon',
  'vibrant',
  'foster a',
  'it is worth mentioning',
  "let's dive in",
  'dive deep into',
  'at the end of the day',
  'unlocking the full potential',
  'a double-edged sword',
  'in the ever-changing',
  'stands as a',
  'in the realm of',
];

export const BANNED_GENERIC_HEADINGS: string[] = [
  'introduction',
  'overview',
  'conclusion',
  'final thoughts',
  'summary',
  'wrapping up',
  'key takeaways',
  'executive summary',
];

const AI_AUTHOR_TOKEN_REGEX = /\b(ai|bot|agent|chatgpt|claude|gemini|llm|gpt)\b/i;

const PLACEHOLDER_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: '[TBD]', regex: /\[tbd\]/i },
  { label: '[TODO]', regex: /\[todo\]/i },
  { label: '[Insert', regex: /\[insert\b/i },
  { label: '[XX]', regex: /\[xx\]/i },
  { label: '[PLACEHOLDER]', regex: /\[placeholder\]/i },
  { label: 'placeholder CVE (CVE-YYYY-XXXX)', regex: /\bCVE-(?:\d{4}|Y{4}|X{4})-X{3,}\b/i },
  { label: 'TODO:', regex: /\btodo:/i },
  { label: 'example.com', regex: /\bexample\.com\b/i },
  { label: 'lorem ipsum', regex: /\blorem\s+ipsum\b/i },
];

const UNSAFE_ADSENSE_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  {
    label: 'actionable jailbreak bypass copy-paste instruction',
    regex:
      /\b(?:copy[- ]and[- ]paste|paste\s+this\s+prompt|use\s+this\s+exact\s+prompt)\b[^.\n]{0,80}\b(?:bypass|jailbreak|override\s+safety|disable\s+guardrails)\b/i,
  },
  {
    label: 'actionable weaponized exploit or malware distribution',
    regex:
      /\b(?:weaponized\s+exploit\s+download|download\s+cracked\s+(?:software|license)|reverse\s+shell\s+payload\s+for\s+unauthorized|ransomware\s+builder)\b/i,
  },
  {
    label: 'spammy affiliate or prohibited AdSense vertical',
    regex:
      /\b(?:buy\s+cheap\s+viagra|online\s+casino\s+bonus|guaranteed\s+crypto\s+returns|click\s+here\s+to\s+claim\s+free\s+bitcoin)\b/i,
  },
];

const PROFANITY_REGEX = /\b(?:fuck(?:ing|ed|er)?|shit(?:ty)?|bitch|cunt|asshole)\b/gi;

export interface LintPostPayloadInput {
  title: string;
  description: string;
  tldr_summary?: string;
  key_facts?: KeyFact[];
  faq?: FaqItem[];
  body_markdown: string;
  author: string;
  archetype: string;
  sources?: string[];
  banned_patterns?: string[];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPhraseRegex(phrase: string): RegExp {
  const escaped = escapeRegex(phrase.trim());
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');
}

function stripFencedCodeBlocks(markdown: string): string {
  // Replace ```...``` and ~~~...~~~ fenced blocks with newlines to keep line boundaries intact
  return markdown
    .replace(/```[^\n]*\n[\s\S]*?```/g, '\n')
    .replace(/~~~[^\n]*\n[\s\S]*?~~~/g, '\n');
}

function hasNonEmptyFencedCodeBlock(markdown: string): boolean {
  const regex = /(?:```|~~~)[^\n]*\n([\s\S]*?)(?:```|~~~)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    if (match[1] && match[1].trim().length > 0) {
      return true;
    }
  }
  return false;
}

function hasMarkdownPipeTable(prose: string): boolean {
  const lines = prose.split(/\r?\n/);
  const separatorRegex = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/;

  for (let i = 0; i < lines.length - 1; i++) {
    const header = lines[i].trim();
    const separator = lines[i + 1].trim();
    if (header.includes('|') && separatorRegex.test(separator)) {
      const cells = header
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length >= 2) {
        return true;
      }
    }
  }
  return false;
}

function countWords(text: string): number {
  const cleaned = text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_`>|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(' ').filter((tok) => /[a-zA-Z0-9]/.test(tok)).length;
}

function isDeepPrimaryHttpsUrl(rawUrl: string): { valid: boolean; normalized?: string; bareRoot?: boolean } {
  const trimmed = rawUrl.trim().replace(/[),.;]+$/, '');
  if (!trimmed) return { valid: false };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false };
    }
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('.') || host === 'example.com' || host.endsWith('.example.com')) {
      return { valid: false };
    }
    const trimmedPath = parsed.pathname.replace(/\/+$/, '');
    if (parsed.pathname.length <= 1 || trimmedPath.length === 0) {
      return { valid: false, bareRoot: true };
    }
    const normalized = `${parsed.origin}${trimmedPath}${parsed.search}`;
    return { valid: true, normalized };
  } catch {
    return { valid: false };
  }
}

function normalizeHeading(raw: string): string {
  return raw
    .replace(/[*_`~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[:.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const TABLE_SEPARATOR_REGEX = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/;
const BOLD_LEADIN_BULLET_REGEX = /^\s*[-*]\s+\*\*[^*]{2,50}:\*\*|^\s*[-*]\s+\*\*[^*]{2,50}\*\*:/;
const ROBOTIC_OPENER_REGEX =
  /^(?:[-*+]\s+|\d+\.\s+)?(?:[*_"'“”‘’(\[]+)?(?:furthermore|moreover|additionally|consequently|importantly|notably|ultimately|overall),/i;

function countConcreteMetrics(text: string): number {
  const withoutUrls = text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ');

  const patterns = [
    /\b\d+(?:\.\d+)?\s*(?:ms|sec|seconds|us|µs|ns|GB|MB|KB|TB|GiB|MiB|tok\/s|tokens\/s|tokens\/sec|req\/s|RPS|QPS|s|x|M|K)(?![a-zA-Z0-9])/gi,
    /\b\d+(?:\.\d+)?\s*(?:%|\$)/g,
    /\$\s?\d+(?:,\d{3})*(?:\.\d+)?(?:\s*\/\s*(?:1M|M|K|hr|hour|month|GB))?/gi,
    /\b(?:CVE-\d{4}-\d{4,7}|GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})\b/gi,
    /\bv\d+\.\d+(?:\.\d+)?\b/gi,
  ];
  let hits = 0;
  for (const rx of patterns) {
    const matches = withoutUrls.match(rx);
    if (matches) hits += matches.length;
  }
  return hits;
}

function isolateNaturalProse(markdownWithoutFences: string): string {
  const lines = markdownWithoutFences.split(/\r?\n/);
  const keptLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip Markdown headings
    if (/^#{1,6}\s+/.test(trimmed)) {
      keptLines.push('');
      continue;
    }

    // Skip horizontal rules
    if (/^(?:[-*_]\s*){3,}$/.test(trimmed)) {
      keptLines.push('');
      continue;
    }

    // Skip Markdown pipe tables (header + separator + contiguous pipe rows)
    if (trimmed.includes('|') && i + 1 < lines.length && TABLE_SEPARATOR_REGEX.test(lines[i + 1].trim())) {
      i += 1;
      while (i + 1 < lines.length && lines[i + 1].trim().includes('|')) {
        i += 1;
      }
      keptLines.push('');
      continue;
    }

    keptLines.push(line.replace(/^\s*>\s?/, ''));
  }

  return keptLines
    .join('\n')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/`([^`]+)`/g, '$1');
}

function extractProseSentences(naturalProse: string): string[] {
  const paragraphs = naturalProse
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sentences: string[] = [];
  for (const para of paragraphs) {
    // Protect decimal/version dots and common abbreviations before sentence splitting
    const protectedText = para
      .replace(/(?<=\d)\.(?=\d)/g, '__DOT__')
      .replace(/\b(e\.g|i\.e|etc|vs|cf|al|dr|mr|ms)\./gi, '$1__DOT__')
      .replace(/\b([A-Za-z0-9]+)\.(js|ts|py|go|rs|io|ai|com|org|dev|net|gov)\b/gi, '$1__DOT__$2');

    const rawParts = protectedText.split(/[.!?]+(?:\s+|$)/);
    for (const part of rawParts) {
      const restored = part.replace(/__DOT__/g, '.').trim();
      if (!restored) continue;
      if (countWords(restored) >= 2) {
        sentences.push(restored);
      }
    }
  }
  return sentences;
}

/**
 * Stylometric Human-Likeness & Anti-AI-Detection Analyzer.
 * Measures burstiness (sentence-length standard deviation), bold-lead-in bullet walls,
 * em-dash frequency, robotic transition openers, and concrete technical metrics.
 */
export function analyzeHumanitySignals(bodyMarkdown: string): HumanitySignals {
  const withoutFences = stripFencedCodeBlocks(bodyMarkdown || '');
  const lines = withoutFences.split(/\r?\n/);

  let boldLeadinBullets = 0;
  for (const line of lines) {
    if (BOLD_LEADIN_BULLET_REGEX.test(line)) {
      boldLeadinBullets++;
    }
  }

  const naturalProse = isolateNaturalProse(withoutFences);
  const naturalProseWords = countWords(naturalProse);

  // Count Unicode em-dashes and double-hyphen dashes (excluding triple-hyphen rules)
  const emDashMatches = naturalProse.match(/(?:—|(?<!-)--(?!-))/g);
  const emDashCount = emDashMatches ? emDashMatches.length : 0;
  const emDashPer100Words =
    naturalProseWords > 0 ? Number(((emDashCount / naturalProseWords) * 100).toFixed(2)) : 0;

  const sentences = extractProseSentences(naturalProse);
  const sentenceWordCounts = sentences.map((s) => countWords(s));
  const sentenceCount = sentenceWordCounts.length;

  let avgSentenceWords = 0;
  let sentenceLengthStdDev = 0;
  if (sentenceCount > 0) {
    const sum = sentenceWordCounts.reduce((acc, n) => acc + n, 0);
    avgSentenceWords = sum / sentenceCount;
    const variance =
      sentenceWordCounts.reduce((acc, n) => acc + Math.pow(n - avgSentenceWords, 2), 0) /
      sentenceCount;
    sentenceLengthStdDev = Math.sqrt(variance);
  }

  let roboticOpenersCount = 0;
  for (const sentence of sentences) {
    if (ROBOTIC_OPENER_REGEX.test(sentence)) {
      roboticOpenersCount++;
    }
  }

  const concreteMetricHits = countConcreteMetrics(withoutFences);

  let score = 100;
  if (sentenceCount >= 12) {
    if (sentenceLengthStdDev < 3.5) {
      score -= 25;
    } else if (sentenceLengthStdDev < 4.5) {
      score -= 15;
    }
  }

  if (boldLeadinBullets > 10) {
    score -= 22;
  } else if (boldLeadinBullets > 6) {
    score -= 12;
  }

  if (emDashPer100Words > 1.8) {
    score -= 12;
  }

  if (roboticOpenersCount >= 5) {
    score -= 20;
  } else if (roboticOpenersCount >= 3) {
    score -= 12;
  }

  if (concreteMetricHits < 3) {
    score -= 10;
  }

  return {
    sentence_count: sentenceCount,
    avg_sentence_words: Number(avgSentenceWords.toFixed(2)),
    sentence_length_std_dev: Number(sentenceLengthStdDev.toFixed(2)),
    bold_leadin_bullets: boldLeadinBullets,
    em_dash_per_100_words: emDashPer100Words,
    robotic_openers_count: roboticOpenersCount,
    concrete_metric_hits: concreteMetricHits,
    human_likeness_score: clampScore(score),
  };
}

export function lintPostPayload(input: LintPostPayloadInput): LintResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const title = (input.title || '').trim();
  const description = (input.description || '').trim();
  const tldr = (input.tldr_summary || '').trim();
  const body = (input.body_markdown || '').trim();
  const author = (input.author || '').trim();
  const archetype = (input.archetype || '').trim();
  const keyFacts = Array.isArray(input.key_facts) ? input.key_facts : [];
  const faq = Array.isArray(input.faq) ? input.faq : [];
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const customBanned = Array.isArray(input.banned_patterns) ? input.banned_patterns : [];

  const prose = stripFencedCodeBlocks(body);
  const proseWordCount = countWords(prose);
  const totalWordCount = countWords(body);
  const readingTimeMinutes = Math.max(1, Math.ceil(totalWordCount / 220));

  // 1. Title length (30..70)
  if (title.length < 30 || title.length > 70) {
    errors.push(
      `Title length must be between 30 and 70 characters (got ${title.length}). Tighten or expand "${title.slice(0, 40)}".`,
    );
  }

  // 2. Meta description length (100..170)
  if (description.length < 100 || description.length > 170) {
    errors.push(
      `Meta description length must be between 100 and 170 characters (got ${description.length}).`,
    );
  }

  // 3. Human author attribution
  let authorInvalid = false;
  if (!author) {
    authorInvalid = true;
    errors.push('Author must be a non-empty human name.');
  } else if (AI_AUTHOR_TOKEN_REGEX.test(author)) {
    authorInvalid = true;
    errors.push(
      `Author "${author}" contains a disallowed AI/bot attribution token. Use a real human editor name.`,
    );
  }

  // 4. Valid archetype
  if (!ARCHETYPES.includes(archetype as Archetype)) {
    errors.push(
      `Invalid archetype "${archetype}". Must be one of: ${ARCHETYPES.join(', ')}.`,
    );
  }

  // 5. Banned AI-slop n-grams + category banned_patterns (checked on prose without fenced code blocks)
  const allBannedPhrases = [
    ...BANNED_SLOP_PHRASES,
    ...customBanned.map((p) => p.trim()).filter(Boolean),
  ];
  const matchedSlop = new Set<string>();
  const proseForSlop = `${title}\n${description}\n${tldr}\n${prose}`;
  for (const phrase of allBannedPhrases) {
    if (buildPhraseRegex(phrase).test(proseForSlop)) {
      matchedSlop.add(phrase);
    }
  }
  if (matchedSlop.size > 0) {
    errors.push(
      `Remove banned AI cliché phrase(s) from prose: ${Array.from(matchedSlop)
        .map((p) => `"${p}"`)
        .join(', ')}.`,
    );
  }

  // 6 & 7. Headings check: no leading H1, no banned generic headings, track H2/H3 structure
  const proseLines = prose.split(/\r?\n/);
  let h1Count = 0;
  let h2Count = 0;
  let h3Count = 0;
  const matchedGenericHeadings: string[] = [];

  for (const line of proseLines) {
    const h1Match = /^#\s+\S/.exec(line);
    if (h1Match) {
      h1Count++;
    }
    const headingMatch = /^(#{1,3})\s+(.+?)\s*#*$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      if (level === 2) h2Count++;
      if (level === 3) h3Count++;
      const normalized = normalizeHeading(headingMatch[2]);
      if (BANNED_GENERIC_HEADINGS.includes(normalized)) {
        matchedGenericHeadings.push(headingMatch[2].trim());
      }
    }
  }

  if (h1Count > 0) {
    errors.push(
      `Body markdown must not contain "# " H1 headings (found ${h1Count}). Use "## " and "### " headings instead.`,
    );
  }
  if (matchedGenericHeadings.length > 0) {
    errors.push(
      `Replace banned generic heading(s) with specific technical headings: ${matchedGenericHeadings
        .map((h) => `"${h}"`)
        .join(', ')}.`,
    );
  }
  if (h2Count < 2) {
    warnings.push(`Article has only ${h2Count} H2 section heading(s); aim for at least 3 structured H2 sections.`);
  }

  // 8. Information-gain artifact (table OR non-empty fenced code block)
  const hasTable = hasMarkdownPipeTable(prose);
  const hasCodeBlock = hasNonEmptyFencedCodeBlock(body);
  if (!hasTable && !hasCodeBlock) {
    errors.push(
      'Article must include at least one information-gain artifact: a Markdown pipe table (| col | col | with | --- | separator) or a non-empty fenced code block.',
    );
  } else if (!hasTable || !hasCodeBlock) {
    warnings.push(
      !hasTable
        ? 'Consider adding a Markdown comparison or specification table to boost information gain.'
        : 'Consider adding a reproducible fenced code or config block alongside the table.',
    );
  }

  // 9. Deep-link primary citations (>= 3 distinct inline deep https:// links, >= 2 valid deep sources)
  const inlineLinkRegex = /(?<!!)\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;
  const distinctDeepInlineUrls = new Set<string>();
  const bareRootLinks: string[] = [];
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = inlineLinkRegex.exec(prose)) !== null) {
    const rawHref = linkMatch[2];
    const check = isDeepPrimaryHttpsUrl(rawHref);
    if (check.valid && check.normalized) {
      distinctDeepInlineUrls.add(check.normalized);
    } else if (check.bareRoot) {
      bareRootLinks.push(rawHref);
    }
  }

  if (distinctDeepInlineUrls.size < 3) {
    const bareHint =
      bareRootLinks.length > 0
        ? ` Bare root URLs were rejected (${bareRootLinks.slice(0, 3).join(', ')}).`
        : '';
    errors.push(
      `Body markdown must contain at least 3 distinct deep primary https:// Markdown links (found ${distinctDeepInlineUrls.size}).${bareHint}`,
    );
  }

  const validSourceUrls = new Set<string>();
  for (const src of sources) {
    if (typeof src !== 'string') continue;
    const check = isDeepPrimaryHttpsUrl(src);
    if (check.valid && check.normalized) {
      validSourceUrls.add(check.normalized);
    }
  }
  if (validSourceUrls.size < 2) {
    errors.push(
      `Sources array must contain at least 2 valid deep https:// URLs (found ${validSourceUrls.size}).`,
    );
  }

  // 10. Zero unresolved placeholders
  const combinedForPlaceholders = `${title}\n${description}\n${tldr}\n${body}`;
  const foundPlaceholders: string[] = [];
  for (const p of PLACEHOLDER_PATTERNS) {
    if (p.regex.test(combinedForPlaceholders)) {
      foundPlaceholders.push(p.label);
    }
  }
  if (foundPlaceholders.length > 0) {
    errors.push(
      `Remove unresolved placeholder token(s): ${foundPlaceholders.join(', ')}.`,
    );
  }

  // 11. Minimum prose depth (>= 350 words excluding fenced code blocks)
  if (proseWordCount < 350) {
    errors.push(
      `Prose depth must be at least 350 words excluding fenced code blocks (got ${proseWordCount} words).`,
    );
  } else if (proseWordCount < 600) {
    warnings.push(
      `Prose depth is ${proseWordCount} words; expanding to 600+ words improves depth and information-gain score.`,
    );
  }

  // 12. AdSense safety check (defensive analysis allowed; reject harmful copy-paste exploits / spam)
  let safetyViolations = 0;
  for (const rule of UNSAFE_ADSENSE_PATTERNS) {
    if (rule.regex.test(proseForSlop)) {
      safetyViolations++;
      errors.push(`AdSense safety violation detected: ${rule.label}. Keep security content strictly defensive.`);
    }
  }
  const profanityMatches = proseForSlop.match(PROFANITY_REGEX);
  if (profanityMatches && profanityMatches.length >= 2) {
    safetyViolations++;
    errors.push('AdSense safety violation: excessive profanity detected in editorial prose.');
  }

  // 13. Stylometric human-likeness & anti-AI-detection analysis
  const humanitySignals = analyzeHumanitySignals(body);

  if (humanitySignals.sentence_count >= 12 && humanitySignals.sentence_length_std_dev < 4.5) {
    warnings.push(
      `Sentence length burstiness is too flat (std dev ${humanitySignals.sentence_length_std_dev} across ${humanitySignals.sentence_count} sentences). Mix short 6-10 word direct verdicts with 20-30 word technical explanations.`,
    );
  }

  if (humanitySignals.bold_leadin_bullets >= 10) {
    errors.push(
      `Detected a wall of ${humanitySignals.bold_leadin_bullets} bold-colon bullet items ("- **Label:** ..."). Rewrite repetitive bullet lists into cohesive engineering prose paragraphs or a structured Markdown comparison table (must be < 10).`,
    );
  } else if (humanitySignals.bold_leadin_bullets > 6) {
    warnings.push(
      `Excessive bold-lead-in bullet spam detected (${humanitySignals.bold_leadin_bullets} items). Convert most "- **Label:** ..." bullets into natural prose or a Markdown table.`,
    );
  }

  if (humanitySignals.em_dash_per_100_words > 1.8) {
    warnings.push(
      `Em-dash frequency is too high (${humanitySignals.em_dash_per_100_words} per 100 words; keep <= 1.8). Replace excess em-dashes with commas, periods, or parentheses.`,
    );
  }

  if (humanitySignals.robotic_openers_count >= 4) {
    errors.push(
      `Detected ${humanitySignals.robotic_openers_count} robotic transition openers ("Furthermore,", "Moreover,", "Additionally,", "Consequently,", etc.). Rewrite transitions into direct human engineering prose (must be < 4).`,
    );
  } else if (humanitySignals.robotic_openers_count >= 3) {
    warnings.push(
      `Detected ${humanitySignals.robotic_openers_count} robotic transition openers ("Furthermore,", "Moreover,", "Additionally,", etc.). Replace them with direct technical transitions.`,
    );
  }

  // --- Deterministic 6-dimension quality scoring (0..100 each) ---

  // A. SEO structure
  let seoScore = 100;
  if (title.length < 30 || title.length > 70) {
    seoScore -= 30;
  } else if (title.length < 40 || title.length > 65) {
    seoScore -= 6;
  }
  if (description.length < 100 || description.length > 170) {
    seoScore -= 30;
  } else if (description.length < 120 || description.length > 160) {
    seoScore -= 5;
  }
  if (h1Count > 0) seoScore -= 25;
  if (h2Count < 2) seoScore -= 15;
  if (h3Count === 0 && h2Count < 4) seoScore -= 5;
  const seo_structure = clampScore(seoScore);

  // B. GEO citation readiness
  let geoScore = 0;
  if (tldr.length >= 40 && tldr.length <= 300) {
    geoScore += 30;
  } else if (tldr.length > 0) {
    geoScore += 14;
    warnings.push(`tldr_summary should ideally be 40-300 characters (got ${tldr.length}).`);
  } else {
    warnings.push('Missing tldr_summary for GEO answer-first extraction.');
  }

  const validKeyFacts = keyFacts.filter(
    (kf) => kf && typeof kf.label === 'string' && kf.label.trim() && typeof kf.value === 'string' && kf.value.trim(),
  );
  if (validKeyFacts.length >= 3) {
    geoScore += 30;
  } else {
    geoScore += validKeyFacts.length * 10;
    warnings.push(`Provide at least 3 key_facts for GEO snippet readiness (got ${validKeyFacts.length}).`);
  }

  const validFaq = faq.filter(
    (item) =>
      item &&
      typeof item.question === 'string' &&
      item.question.trim() &&
      typeof item.answer === 'string' &&
      item.answer.trim(),
  );
  if (validFaq.length >= 3) {
    geoScore += 25;
  } else if (validFaq.length === 2) {
    geoScore += 22;
  } else if (validFaq.length === 1) {
    geoScore += 10;
    warnings.push('Add at least 2 FAQ entries for structured FAQPage schema.');
  } else {
    warnings.push('Missing FAQ entries for AEO/GEO structured answers.');
  }

  const hasLists = /^\s*(?:[-*+]|\d+\.)\s+\S/m.test(prose);
  if (hasTable && hasLists) {
    geoScore += 15;
  } else if (hasTable || hasLists) {
    geoScore += 10;
  }
  const geo_citation_readiness = clampScore(geoScore);

  // C. Information gain
  let infoScore = 0;
  if (hasTable) infoScore += 25;
  if (hasCodeBlock) infoScore += 20;
  if (proseWordCount >= 700) {
    infoScore += 30;
  } else if (proseWordCount >= 600) {
    infoScore += 27;
  } else if (proseWordCount >= 450) {
    infoScore += 21;
  } else if (proseWordCount >= 350) {
    infoScore += 15;
  } else {
    infoScore += Math.floor((proseWordCount / 350) * 12);
  }
  const metricHits = humanitySignals.concrete_metric_hits;
  infoScore += Math.min(25, metricHits * 3);
  const information_gain = clampScore(infoScore);

  // D. Source grounding
  let groundingScore = 0;
  const inlineCount = distinctDeepInlineUrls.size;
  if (inlineCount >= 5) groundingScore += 60;
  else if (inlineCount === 4) groundingScore += 54;
  else if (inlineCount === 3) groundingScore += 46;
  else if (inlineCount === 2) groundingScore += 24;
  else if (inlineCount === 1) groundingScore += 10;

  const srcCount = validSourceUrls.size;
  if (srcCount >= 4) groundingScore += 40;
  else if (srcCount === 3) groundingScore += 35;
  else if (srcCount === 2) groundingScore += 28;
  else if (srcCount === 1) groundingScore += 12;
  const source_grounding = clampScore(groundingScore);

  // E. Anti-slop cleanliness (blending lexical cleanliness with stylometric human-likeness)
  const lexicalAntiSlop = clampScore(
    100 -
      matchedSlop.size * 18 -
      matchedGenericHeadings.length * 20 -
      foundPlaceholders.length * 25,
  );
  const anti_slop_cleanliness = clampScore(
    lexicalAntiSlop * 0.65 + humanitySignals.human_likeness_score * 0.35,
  );

  // F. AdSense compliance
  let adsenseRaw = 100;
  if (authorInvalid) adsenseRaw -= 40;
  adsenseRaw -= safetyViolations * 50;
  if (proseWordCount < 350) adsenseRaw -= 15;
  if (foundPlaceholders.length > 0) adsenseRaw -= 10;
  const adsense_compliance = clampScore(adsenseRaw);

  const overall = clampScore(
    seo_structure * 0.16 +
      geo_citation_readiness * 0.18 +
      information_gain * 0.22 +
      source_grounding * 0.18 +
      anti_slop_cleanliness * 0.14 +
      adsense_compliance * 0.12,
  );

  const quality_breakdown: QualityBreakdown = {
    overall,
    seo_structure,
    geo_citation_readiness,
    information_gain,
    source_grounding,
    anti_slop_cleanliness,
    adsense_compliance,
    warnings,
    humanity_signals: humanitySignals,
  };

  return {
    passed: errors.length === 0,
    errors,
    quality_score: overall,
    quality_breakdown,
    word_count: totalWordCount,
    reading_time_minutes: readingTimeMinutes,
  };
}
