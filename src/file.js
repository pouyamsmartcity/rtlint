import { proseText } from './prose.js';
import { blank, classRegions, cssRegions, maskHtml, maskJs, maskScripts } from './scan.js';
import { HAS_ARABIC_SCRIPT, NOT_PERSIAN, PERSIAN_SIGNAL, PERSIAN_STRONG } from './unicode.js';

const KINDS = {
  css: ['css', 'scss', 'sass', 'less', 'pcss', 'postcss', 'styl', 'stylus'],
  markup: [
    'html', 'htm', 'xhtml', 'vue', 'svelte', 'astro', 'php', 'erb', 'ejs', 'hbs', 'handlebars',
    'njk', 'twig', 'liquid', 'mustache', 'jinja', 'jinja2', 'j2', 'cshtml', 'razor',
  ],
  script: ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts'],
  text: [
    'md', 'mdx', 'markdown', 'txt', 'json', 'json5', 'jsonc', 'yaml', 'yml', 'po', 'pot', 'xliff',
    'xlf', 'strings', 'arb', 'properties', 'toml', 'srt', 'vtt', 'csv', 'xml', 'resx',
  ],
  code: [
    'py', 'go', 'rs', 'java', 'kt', 'kts', 'swift', 'c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'cs', 'rb',
    'sh', 'bash', 'zsh', 'dart', 'lua', 'sql', 'scala', 'ex', 'exs', 'pl', 'r',
  ],
};

const KIND_OF = new Map();
for (const [kind, exts] of Object.entries(KINDS)) for (const ext of exts) KIND_OF.set(ext, kind);

export const SUPPORTED_EXTENSIONS = [...KIND_OF.keys()];

export function extOf(path) {
  const base = path.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export function kindOf(ext) {
  return KIND_OF.get(ext) ?? 'text';
}

// Locale hints in a path, e.g. locales/ar.json, messages.fa-IR.json, i18n/ur/common.yml.
const OTHER_RTL_LOCALE = /(?:^|[\\/._-])(?:ar|ur|ps|ckb|ku|sd|ug|he|iw|yi|dv)(?:[_-][a-z]{2,4})?(?=[\\/._-]|$)/i;
const PERSIAN_LOCALE = /(?:^|[\\/._-])(?:fa|fas|persian|farsi)(?:[_-][a-z]{2,4})?(?=[\\/._-]|$)/i;

/**
 * Wraps a source text with lazily computed views and language facts that the
 * rules share. `settings` comes from the resolved configuration.
 */
export function createFile(text, path = 'input.txt', settings = {}) {
  const ext = extOf(path);
  const file = { text, path, ext, kind: kindOf(ext), settings };
  lazy(file, 'lineStarts', () => lineStarts(text));
  lazy(file, 'markupView', () => maskHtml(text));
  // Markup without the code inside <script> blocks: what HTML rules should read.
  lazy(file, 'htmlView', () => maskScripts(file.markupView));
  lazy(file, 'scriptView', () => (file.kind === 'script' ? maskJs(text) : blank(text)));
  lazy(file, 'jsxView', () => (file.kind === 'script' ? maskJs(text, { strings: true }) : blank(text)));
  lazy(file, 'css', () => cssRegions(file));
  lazy(file, 'cssView', () => file.css.view);
  lazy(file, 'classRegions', () => classRegions(file));
  lazy(file, 'prose', () => proseText(file));
  lazy(file, 'persianLines', () => persianLines(file));
  return file;
}

function lazy(obj, key, compute) {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    get() {
      const value = compute();
      Object.defineProperty(obj, key, { value, enumerable: false });
      return value;
    },
  });
}

export function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

/** 1-based line and column (in UTF-16 code units, like editors and SARIF) for an offset. */
export function position(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: index - starts[lo] + 1 };
}

/**
 * The lines of a file that hold Persian text, as { start, text } segments.
 *
 * A line counts as Persian when it contains a Persian-only letter and none of
 * the letters that identify Arabic, Urdu, Kurdish, Pashto or Uyghur. Lines
 * with Arabic script but no decisive letter (common when Persian is typed with
 * an Arabic keyboard) count as Persian when the file as a whole is Persian.
 */
function persianLines(file) {
  const mode = file.settings.persian ?? 'auto';
  if (mode === false) return [];
  const { text, path } = file;
  if (!HAS_ARABIC_SCRIPT.test(text)) return [];
  let filePersian;
  if (mode === true) filePersian = true;
  else if (OTHER_RTL_LOCALE.test(path) && !PERSIAN_LOCALE.test(path)) return [];
  else if (PERSIAN_LOCALE.test(path)) filePersian = true;
  else {
    const strong = text.match(PERSIAN_STRONG)?.length ?? 0;
    const taaMarbuta = text.match(/\u0629/g)?.length ?? 0;
    filePersian = strong >= 3 && strong > taaMarbuta * 2;
  }
  const out = [];
  const starts = file.lineStarts;
  const prose = file.prose;
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] - 1 : text.length;
    const line = prose.slice(start, end).replace(/\r$/, '');
    if (!HAS_ARABIC_SCRIPT.test(line) || NOT_PERSIAN.test(line)) continue;
    if (PERSIAN_SIGNAL.test(line) || (filePersian && !arabicLooking(line)) || neutral(line)) out.push({ start, text: line });
  }
  return out;
}

const AR_WORD = /[\u0621-\u064A\u0671-\u06D3]+/g;
const HARAKAT = /[\u064B-\u0652]/g;

/**
 * A line with no Persian-only letter that reads as Arabic: many words with
 * the article «ال», or full vocalisation (Quran, hadith, poetry).
 */
function arabicLooking(line) {
  const words = line.match(AR_WORD) ?? [];
  if (words.length >= 2 && words.filter((w) => w.startsWith('\u0627\u0644')).length / words.length >= 0.3) return true;
  return (line.match(HARAKAT)?.length ?? 0) >= 4;
}

// Letters and marks only Arabic (not Persian) uses: yeh, kaf, alef maksura, taa marbuta, Arabic-Indic digits.
const ARABIC_ONLY = /[\u064A\u0643\u0649\u0629\u0660-\u0669]/;
const ARABIC_ARTICLE = /(?:^|[^\u0621-\u06FF])\u0627\u0644[\u0621-\u06D3]{2,}/;

/**
 * A short line like «ادامه بده» has no Persian-only letter, but nothing Arabic
 * either: no Arabic-only letters or digits and no article ال. It is treated
 * as Persian; anything that could be Arabic is not.
 */
function neutral(line) {
  return !ARABIC_ONLY.test(line) && !ARABIC_ARTICLE.test(line) && !arabicLooking(line);
}
