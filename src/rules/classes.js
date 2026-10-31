import { directionConditional, tokens } from './util.js';

// Utility-class mapping for Tailwind CSS (>= 3.3; float/clear >= 3.4), UnoCSS,
// Windi and Bootstrap 4 -> 5. The two vocabularies do not collide: Tailwind
// says border-l / rounded-l, Bootstrap 4 says border-left / rounded-left.

const SPACE = /^(?:(?:sm|md|lg|xl|xxl)-)?(?:\d+(?:\.\d+)?|px|auto|n[1-5]|\[[^\]]+\]|\([^)]+\))$/;
const INSET = /^(?:\d+(?:\.\d+)?|\d+\/\d+|px|full|auto|\[[^\]]+\]|\([^)]+\))$/;
const BORDER = /^(?:\d+|[a-z]+(?:-\d{2,3})?(?:\/\d+)?|\[[^\]]+\]|\([^)]+\))$/;
const RADIUS = /^(?:none|xs|sm|md|lg|xl|2xl|3xl|4xl|full|\[[^\]]+\]|\([^)]+\))$/;

const PREFIXES = [
  ['scroll-ml', 'scroll-ms', SPACE],
  ['scroll-mr', 'scroll-me', SPACE],
  ['scroll-pl', 'scroll-ps', SPACE],
  ['scroll-pr', 'scroll-pe', SPACE],
  ['ml', 'ms', SPACE],
  ['mr', 'me', SPACE],
  ['pl', 'ps', SPACE],
  ['pr', 'pe', SPACE],
  ['left', 'start', INSET],
  ['right', 'end', INSET],
  ['border-l', 'border-s', BORDER, true],
  ['border-r', 'border-e', BORDER, true],
  ['rounded-tl', 'rounded-ss', RADIUS, true],
  ['rounded-tr', 'rounded-se', RADIUS, true],
  ['rounded-bl', 'rounded-es', RADIUS, true],
  ['rounded-br', 'rounded-ee', RADIUS, true],
  ['rounded-l', 'rounded-s', RADIUS, true],
  ['rounded-r', 'rounded-e', RADIUS, true],
];

const EXACT = {
  'text-left': 'text-start',
  'text-right': 'text-end',
  'float-left': 'float-start',
  'float-right': 'float-end',
  'clear-left': 'clear-start',
  'clear-right': 'clear-end',
  // Bootstrap 4 -> 5
  'border-left': 'border-start',
  'border-right': 'border-end',
  'border-left-0': 'border-start-0',
  'border-right-0': 'border-end-0',
  'rounded-left': 'rounded-start',
  'rounded-right': 'rounded-end',
  dropleft: 'dropstart',
  dropright: 'dropend',
  'dropdown-menu-left': 'dropdown-menu-start',
  'dropdown-menu-right': 'dropdown-menu-end',
};

const BREAKPOINT_SIDE = /^(text|float|dropdown-menu)-(sm|md|lg|xl|xxl)-(left|right)$/;
const SIDE = { left: 'start', right: 'end' };

const TRIM_START = /^[{("'`,]+/;
const TRIM_END = /[}"'`,;:?]+$/;

/** Splits "md:hover:!-ml-2" into variants "md:hover:" and the utility "!-ml-2". */
export function splitVariants(token) {
  let depth = 0;
  let last = -1;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (c === ':' && depth === 0) last = i;
  }
  return { variants: token.slice(0, last + 1), utility: token.slice(last + 1) };
}

/** Logical replacement for a physical utility class, or null. */
export function logicalClass(token, prefix = '') {
  const { variants, utility } = splitVariants(token);
  if (/(?:^|:)(?:rtl|ltr):/.test(variants)) return null;
  if (token.includes('safe-area-inset')) return null;
  let u = utility;
  let important = '';
  let importantEnd = '';
  if (u.startsWith('!')) { important = '!'; u = u.slice(1); }
  if (u.endsWith('!')) { importantEnd = '!'; u = u.slice(0, -1); }
  let negative = '';
  if (u.startsWith('-')) { negative = '-'; u = u.slice(1); }
  if (prefix) {
    if (!u.startsWith(prefix)) return null;
    u = u.slice(prefix.length);
  }
  let mapped = null;
  if (!negative && EXACT[u]) mapped = EXACT[u];
  const bp = !negative && u.match(BREAKPOINT_SIDE);
  if (bp) mapped = `${bp[1]}-${bp[2]}-${SIDE[bp[3]]}`;
  if (!mapped) {
    for (const [from, to, valid, bare] of PREFIXES) {
      if (u === from && bare) { mapped = to; break; }
      if (u.startsWith(from + '-') && valid.test(u.slice(from.length + 1))) {
        mapped = to + u.slice(from.length);
        break;
      }
    }
  }
  if (!mapped) return null;
  return variants + important + negative + prefix + mapped + importantEnd;
}

const count = (s, c) => s.split(c).length - 1;

/** Class tokens of a region with surrounding quotes/braces trimmed. */
function classTokens(text, region) {
  const out = [];
  for (const t of tokens(text, region)) {
    const lead = t.text.match(TRIM_START)?.[0].length ?? 0;
    let core = t.text.slice(lead).replace(TRIM_END, '');
    // Keep the ")" of ml-(--gap); drop ones that close a surrounding call.
    while (core.endsWith(')') && count(core, ')') > count(core, '(')) core = core.slice(0, -1).replace(TRIM_END, '');
    if (core) out.push({ text: core, index: t.index + lead });
  }
  return out;
}

/** Class regions plus the arguments of @apply in CSS. */
function regionsOf(file) {
  const regions = file.classRegions.map((r) => ({ text: file.text, range: r }));
  const view = file.cssView;
  for (const m of view.matchAll(/@apply\s+([^;{}\n]+)/g)) {
    const start = m.index + m[0].length - m[1].length;
    regions.push({ text: view, range: [start, start + m[1].length] });
  }
  return regions;
}

/**
 * Variants plus the utility with its important marker and prefix removed
 * (the negative sign is kept), or null when the prefix does not match.
 */
function bare(token, prefix) {
  const { variants, utility } = splitVariants(token);
  let u = utility.replace(/^!|!$/g, '');
  const negative = u.startsWith('-') ? '-' : '';
  if (negative) u = u.slice(1);
  if (prefix) {
    if (!u.startsWith(prefix)) return null;
    u = u.slice(prefix.length);
  }
  return { variants, utility: negative + u };
}

const TRANSLATE = /^-?translate-x-/;
const INSET_UTILITY = /^-?(?:left|right)-/;

export const physicalUtility = {
  id: 'class/physical-utility',
  meta: {
    description:
      'Tailwind/UnoCSS/Bootstrap utilities such as ml-4, pr-2, left-0, text-left, border-l and rounded-r do not mirror in RTL.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    if (file.settings.classes === false) return;
    const prefix = file.settings.classPrefix ?? '';
    for (const { text, range } of regionsOf(file)) {
      const list = classTokens(text, range);
      const translates = list.some((t) => {
        const b = bare(t.text, prefix);
        return b && !/(?:rtl|ltr):/.test(b.variants) && TRANSLATE.test(b.utility);
      });
      for (const t of list) {
        const logical = logicalClass(t.text, prefix);
        if (!logical) continue;
        if (directionConditional(text, t.index, t.text.length)) continue;
        if (translates && INSET_UTILITY.test(bare(t.text, prefix)?.utility ?? '')) {
          report({
            index: t.index,
            length: t.text.length,
            message: `"${t.text}" sits next to a translate-x utility (a centering trick); "${logical}" alone breaks it in RTL. Mirror the translate with an rtl: variant too.`,
            fa: `«${t.text}» کنار یک translate-x آمده (ترفند وسط\u200Cچین)؛ اگر فقط آن را به «${logical}» تغییر دهید، در راست\u200Cبه\u200Cچپ از وسط خارج می\u200Cشود. translate را هم با یک نسخه\u200Cی rtl: آینه کنید.`,
          });
          continue;
        }
        report({
          index: t.index,
          length: t.text.length,
          message: `"${t.text}" is physical and will not mirror in RTL; use "${logical}".`,
          fa: `«${t.text}» فیزیکی است و در صفحه\u200Cی راست\u200Cبه\u200Cچپ برعکس نمی\u200Cشود؛ «${logical}» بنویسید.`,
          fix: { text: logical },
        });
      }
    }
  },
};

const DIRECTIONAL = [
  { re: /^(-?)translate-x-(.+)$/, mirror: (m) => `${m[1] ? '' : '-'}translate-x-${m[2]}` },
  { re: /^origin-(left|right|top-left|top-right|bottom-left|bottom-right)$/, mirror: (m) => `origin-${m[1].replace(/left|right/, (s) => (s === 'left' ? 'right' : 'left'))}` },
  {
    re: /^bg-(gradient|linear)-to-(l|r|tl|tr|bl|br)$/,
    mirror: (m) => `bg-${m[1]}-to-${m[2].replace(/[lr]/, (s) => (s === 'l' ? 'r' : 'l'))}`,
    gradient: true,
  },
];
// left-1/2 + -translate-x-1/2 is the usual centering pair; it stays correct
// as long as both stay physical, so the translate is not reported then.
const CENTER_INSET = /^(?:left|right)-1\/2$/;
const CENTER_TRANSLATE = /^-?translate-x-1\/2$/;

export const directionalUtility = {
  id: 'class/directional-utility',
  meta: {
    description:
      'translate-x and left/right transform origins (and, with { gradients: true }, horizontal gradients) need an rtl: counterpart to mirror.',
    fixable: false,
    level: 'warn',
  },
  check(file, report, options) {
    if (file.settings.classes === false) return;
    const prefix = file.settings.classPrefix ?? '';
    const gradients = options.gradients === true;
    for (const { text, range } of regionsOf(file)) {
      const list = classTokens(text, range);
      const centered = list.some((t) => CENTER_INSET.test(bare(t.text, prefix)?.utility ?? ''));
      // Families that already have an rtl: variant in this class list.
      const covered = new Set();
      for (const t of list) {
        const b = bare(t.text, prefix);
        if (!b || !/(?:^|:)rtl:/.test(b.variants)) continue;
        DIRECTIONAL.forEach((d, i) => d.re.test(b.utility) && covered.add(i));
      }
      for (const t of list) {
        const b = bare(t.text, prefix);
        if (!b || /(?:^|:)ltr:/.test(b.variants)) continue;
        const { variants, utility: full } = b;
        for (const [i, d] of DIRECTIONAL.entries()) {
          const m = full.match(d.re);
          if (!m || covered.has(i) || (d.gradient && !gradients)) continue;
          if (centered && CENTER_TRANSLATE.test(full)) break;
          const mirrored = d.mirror(m);
          const suggestion = `rtl:${variants}${prefix && mirrored.startsWith('-') ? '-' + prefix + mirrored.slice(1) : prefix + mirrored}`;
          report({
            index: t.index,
            length: t.text.length,
            message: `"${t.text}" moves things horizontally and will point the wrong way in RTL; add "${suggestion}".`,
            fa: `«${t.text}» چیزی را افقی جابه\u200Cجا می\u200Cکند و در راست\u200Cبه\u200Cچپ جهتش اشتباه می\u200Cشود؛ «${suggestion}» را هم اضافه کنید.`,
          });
          break;
        }
      }
    }
  },
};
