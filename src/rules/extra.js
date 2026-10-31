// Rules for CSS, classes, HTML and text added in 0.3.
import { leaveAlone, preludeChain } from './css-context.js';
import { MASK } from '../prose.js';
import { getAttr, tokens } from './util.js';

// ---------------------------------------------------------------- CSS

const TRANSITION_NAMES = {
  'margin-left': 'margin-inline-start',
  'margin-right': 'margin-inline-end',
  'padding-left': 'padding-inline-start',
  'padding-right': 'padding-inline-end',
  'border-left': 'border-inline-start',
  'border-right': 'border-inline-end',
  left: 'inset-inline-start',
  right: 'inset-inline-end',
};
const TRANSITION_DECL = /(^|[\s{;])(transition|transition-property|will-change)(\s*:\s*)([^;{}\n]+)/g;

export const physicalTransition = {
  id: 'css/physical-transition',
  meta: {
    description:
      'transition and will-change lists that name physical properties (margin-left, left …) stop animating once those properties become logical.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    const view = file.cssView;
    for (const m of view.matchAll(TRANSITION_DECL)) {
      const declStart = m.index + m[1].length;
      if (leaveAlone(file, declStart)) continue;
      const valueStart = declStart + m[2].length + m[3].length;
      for (const n of m[4].matchAll(/(?<![\w-])(margin-left|margin-right|padding-left|padding-right|border-left|border-right|left|right)(?![\w-])/g)) {
        const logical = TRANSITION_NAMES[n[1]];
        report({
          index: valueStart + n.index,
          length: n[1].length,
          message: `"${m[2]}" names the physical "${n[1]}"; use "${logical}" so the animation still runs after the switch to logical properties.`,
          fa: `در «${m[2]}» نام فیزیکی «${n[1]}» آمده؛ «${logical}» بنویسید تا بعد از تبدیل به ویژگی\u200Cهای منطقی، انیمیشن کار کند.`,
          fix: { text: logical },
        });
      }
    }
  },
};

const RTL_SCRIPT_CONTEXT =
  /:lang\(\s*["']?(?:fa|ar|ur|ps|ckb|sd|ug)\b|\[\s*lang\s*[~|^*]?=\s*["']?(?:fa|ar|ur|ps|ckb)|\[\s*dir\s*=\s*["']?rtl|:dir\(\s*rtl|\.rtl\b|\.(?:fa|persian|farsi|arabic|urdu)\b/i;

export const arabicLetterSpacing = {
  id: 'css/arabic-letter-spacing',
  meta: {
    description:
      'letter-spacing on Persian/Arabic text pulls joined letters apart; it is never right for Arabic script.',
    fixable: false,
    level: 'error',
  },
  check(file, report) {
    const view = file.cssView;
    for (const m of view.matchAll(/(^|[\s{;])letter-spacing(\s*:\s*)([^;{}\n]+)/g)) {
      const value = m[3].trim();
      if (/^(?:0(?:[a-z%]+)?|normal|inherit|initial|unset|revert)(?:\s*!important)?$/i.test(value)) continue;
      const index = m.index + m[1].length;
      if (!preludeChain(file, index).some((p) => RTL_SCRIPT_CONTEXT.test(p))) continue;
      report({
        index,
        length: 'letter-spacing'.length,
        message: `"letter-spacing: ${value}" on Persian/Arabic text breaks the joins between letters; use letter-spacing: normal (or 0) for RTL text.`,
        fa: `«letter-spacing: ${value}» روی متن فارسی یا عربی اتصال حروف را از هم جدا می\u200Cکند؛ برای متن راست\u200Cبه\u200Cچپ letter-spacing: normal (یا 0) بگذارید.`,
      });
    }
    // Tailwind: rtl:tracking-wide and friends.
    for (const [start, end] of file.classRegions) {
      for (const t of tokens(file.text, [start, end])) {
        const m = t.text.match(/^((?:[\w-]+:)*?(?:rtl|fa|ar):(?:[\w-]+:)*)(tracking-(?!normal\b)[\w[\].-]+)$/);
        if (!m) continue;
        report({
          index: t.index,
          length: t.text.length,
          message: `"${t.text}" adds letter-spacing to right-to-left text and breaks the joins between Persian/Arabic letters.`,
          fa: `«${t.text}» به متن راست\u200Cبه\u200Cچپ فاصله\u200Cی حروف می\u200Cدهد و اتصال حروف فارسی و عربی را از هم جدا می\u200Cکند.`,
        });
      }
    }
  },
};

export const directionProperty = {
  id: 'css/direction-property',
  meta: {
    description:
      'Opt-in: the CSS direction property hard-codes a direction; the HTML dir attribute (or dir="auto") is the reliable way to set it.',
    fixable: false,
    level: 'off',
  },
  check(file, report) {
    const view = file.cssView;
    for (const m of view.matchAll(/(^|[\s{;])direction(\s*:\s*)(rtl|ltr)\b/g)) {
      const index = m.index + m[1].length;
      const chain = preludeChain(file, index).join(' ');
      // Forcing LTR on phone, email and code fields is a legitimate use.
      if (/input|tel|email|url|code|pre|kbd|number/i.test(chain)) continue;
      report({
        index,
        length: 'direction'.length,
        message: `"direction: ${m[3]}" in CSS hard-codes the direction; set dir="${m[3]}" (or dir="auto") on the HTML element instead, so the text and screen readers get it too.`,
        fa: `«direction: ${m[3]}» در CSS جهت را ثابت می\u200Cکند؛ به\u200Cجای آن روی خود عنصر HTML \u200Fdir="${m[3]}" (یا dir="auto") بگذارید تا متن و صفحه\u200Cخوان هم جهت را بدانند.`,
      });
    }
  },
};

// ---------------------------------------------------------------- classes

export const spaceReverse = {
  id: 'class/space-reverse',
  meta: {
    description:
      'Opt-in (Tailwind 3 and earlier): space-x-* and divide-x-* use physical margins/borders and need rtl:space-x-reverse / rtl:divide-x-reverse.',
    fixable: true,
    level: 'off',
  },
  check(file, report) {
    for (const [start, end] of file.classRegions) {
      const list = tokens(file.text, [start, end]);
      for (const kind of ['space', 'divide']) {
        const uses = list.find((t) => new RegExp(`^(?:[\\w-]+:)*-?${kind}-x(?:-(?!0$|reverse$)[\\w[\\]./-]+)?$`).test(t.text));
        if (!uses) continue;
        if (list.some((t) => t.text.endsWith(`${kind}-x-reverse`))) continue;
        report({
          index: uses.index,
          length: uses.text.length,
          message: `"${uses.text}" uses physical sides in Tailwind 3; add "rtl:${kind}-x-reverse" so the spacing flips in RTL.`,
          fa: `«${uses.text}» در Tailwind 3 سمت فیزیکی دارد؛ «rtl:${kind}-x-reverse» را اضافه کنید تا در راست\u200Cبه\u200Cچپ برعکس شود.`,
          fix: { range: [uses.index + uses.text.length, uses.index + uses.text.length], text: ` rtl:${kind}-x-reverse` },
        });
      }
    }
  },
};

// ---------------------------------------------------------------- HTML

function markupSource(file) {
  if (file.kind === 'markup') return file.htmlView;
  if (file.kind === 'script') return file.jsxView;
  return null;
}

export const missingLang = {
  id: 'html/missing-lang',
  meta: {
    description:
      '<html> without lang: browsers, screen readers and fonts cannot tell the page is Persian, Arabic or Hebrew (and dir cannot be checked).',
    fixable: false,
    level: 'warn',
  },
  check(file, report) {
    const src = markupSource(file);
    if (!src) return;
    for (const m of src.matchAll(/<html\b([^>]*)>/gi)) {
      if (getAttr(m[1], 'lang') || getAttr(m[1], ':lang') || getAttr(m[1], 'xml:lang')) continue;
      report({
        index: m.index,
        length: 5,
        message: '<html> has no lang attribute; set it (e.g. lang="fa" dir="rtl") so browsers, fonts and screen readers handle the language correctly.',
        fa: 'تگ <html> ویژگی lang ندارد؛ آن را بگذارید (مثلاً lang="fa" dir="rtl") تا مرورگر، فونت و صفحه\u200Cخوان زبان را درست بشناسند.',
      });
    }
  },
};

const TEXT_TYPES = new Set(['', 'text', 'search']);

export const userContentDir = {
  id: 'html/user-content-dir',
  meta: {
    description:
      'Opt-in: text inputs, textareas and contenteditable areas where people type Persian or English should have dir="auto" so each entry gets its own direction.',
    fixable: true,
    level: 'off',
  },
  check(file, report) {
    const src = markupSource(file);
    if (!src) return;
    const re = /<(input|textarea|div|p|span|section)\b((?:[^>"'{]|"[^"]*"|'[^']*'|\{[^}]*\})*)>/gi;
    for (const m of src.matchAll(re)) {
      const tag = m[1].toLowerCase();
      const attrs = m[2];
      if (getAttr(attrs, 'dir')) continue;
      if (tag === 'input') {
        const type = getAttr(attrs, 'type');
        if (type?.dynamic || !TEXT_TYPES.has((type?.value ?? '').toLowerCase())) continue;
      } else if (tag !== 'textarea') {
        const editable = getAttr(attrs, 'contenteditable') ?? getAttr(attrs, 'contentEditable');
        if (!editable || /^false$/i.test(editable.value)) continue;
      }
      const at = m.index + 1 + m[1].length;
      report({
        index: m.index,
        length: m[1].length + 1,
        message: `<${m[1]}> takes text in any language; add dir="auto" so Persian entries read right to left and English ones left to right.`,
        fa: `در <${m[1]}> هر زبانی تایپ می\u200Cشود؛ dir="auto" اضافه کنید تا متن فارسی راست\u200Cبه\u200Cچپ و متن انگلیسی چپ\u200Cبه\u200Cراست نمایش داده شود.`,
        fix: { range: [at, at], text: ' dir="auto"' },
      });
    }
  },
};

// ---------------------------------------------------------------- text

// Zero-width space, word joiner, Mongolian vowel separator, BOM after the start.
const INVISIBLE = new RegExp('[\\u200B\\u2060\\u180E\\uFEFF]', 'g');
const NAMES = {
  '\u200B': 'zero-width space (U+200B)',
  '\u2060': 'word joiner (U+2060)',
  '\u180E': 'Mongolian vowel separator (U+180E)',
  '\uFEFF': 'byte order mark (U+FEFF)',
};
const NAMES_FA = {
  '\u200B': 'فاصله\u200Cی بی\u200Cعرض (U+200B)',
  '\u2060': 'اتصال\u200Cدهنده\u200Cی کلمه (U+2060)',
  '\u180E': 'جداکننده\u200Cی مغولی (U+180E)',
  '\uFEFF': 'نشانه\u200Cی BOM (U+FEFF)',
};
const ARABIC_LETTER = /[ء-يٱ-ۓ]/;

export const invisibleCharacters = {
  id: 'text/invisible-characters',
  meta: {
    description:
      'Invisible characters (zero-width space, word joiner, a stray BOM) that break search, word wrapping and string comparison.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    const { text } = file;
    for (const m of text.matchAll(INVISIBLE)) {
      const c = m[0];
      if (c === '\uFEFF' && m.index === 0) continue;
      // In code, regex literals and character tables (normalisers, RegExp('[\u2026]')) name the character on purpose.
      if ((file.kind === 'script' || file.kind === 'code') && file.prose[m.index] === MASK) continue;
      // Inside a Persian word a ZWSP is a mistyped half-space: fa/zwnj-invalid handles it.
      if (c === '\u200B' && ARABIC_LETTER.test(text[m.index - 1] ?? '') && ARABIC_LETTER.test(text[m.index + 1] ?? '')) continue;
      report({
        index: m.index,
        length: 1,
        message: `Invisible ${NAMES[c]}; it breaks search, wrapping and comparisons. Remove it.`,
        fa: `${NAMES_FA[c]} نامرئی است و جست\u200Cوجو، شکستن خط و مقایسه\u200Cی متن را خراب می\u200Cکند؛ حذفش کنید.`,
        fix: { text: '' },
      });
    }
  },
};
