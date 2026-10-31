// Persian typography rules beyond the essentials. The number and quote rules
// are style choices (the Academy of Persian Language recommends them, but
// many projects keep Latin forms), so they are opt-in.
import { LETTER, WORD } from '../unicode.js';
import { eachPersianMatch } from './util.js';

const FA_DIGIT = '۰-۹';
const PROSE_EXTENSIONS = new Set(['md', 'mdx', 'markdown', 'txt', 'srt', 'vtt']);

export const spaceAfterPunctuation = {
  id: 'fa/space-after-punctuation',
  meta: {
    description: 'Persian punctuation (، ؛ ؟ !) followed directly by a Persian word needs a space after it.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    const re = new RegExp(`(?<=[${WORD}])([،؛؟!])(?=[${LETTER}])`, 'g');
    eachPersianMatch(file, re, (m, index) => {
      report({
        index,
        length: 1,
        message: `Add a space after "${m[1]}".`,
        fa: `بعد از «${m[1]}» یک فاصله بگذارید.`,
        fix: { range: [index + 1, index + 1], text: ' ' },
      });
    });
  },
};

export const doubleSpace = {
  id: 'fa/double-space',
  meta: {
    description: 'Two or more spaces between Persian words.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    const re = new RegExp(`(?<=[${WORD}])( {2,})(?=[${LETTER}])`, 'g');
    eachPersianMatch(file, re, (m, index) => {
      report({
        index,
        length: m[1].length,
        message: 'More than one space between Persian words.',
        fa: 'بین کلمه\u200Cها بیش از یک فاصله آمده است.',
        fix: { text: ' ' },
      });
    });
  },
};

export const ellipsis = {
  id: 'fa/ellipsis',
  meta: {
    description: 'Opt-in: three dots after Persian text become the ellipsis character (…).',
    fixable: true,
    level: 'off',
  },
  check(file, report) {
    const re = new RegExp(`(?<=[${WORD}»)"'] ?)\\.{3}(?!\\.)`, 'g');
    eachPersianMatch(file, re, (m, index) => {
      report({
        index,
        length: 3,
        message: 'Use the ellipsis character "…" instead of three dots.',
        fa: 'به\u200Cجای سه نقطه از نویسه\u200Cی «…» استفاده کنید.',
        fix: { text: '…' },
      });
    });
  },
};

export const percentSign = {
  id: 'fa/percent-sign',
  meta: {
    description: 'Opt-in: after Persian digits use the Persian percent sign (٪) instead of %.',
    fixable: true,
    level: 'off',
  },
  check(file, report) {
    const re = new RegExp(`(?<=[${FA_DIGIT}])%`, 'g');
    eachPersianMatch(file, re, (m, index) => {
      report({
        index,
        length: 1,
        message: 'Use the Persian percent sign "٪" after Persian digits.',
        fa: 'بعد از رقم فارسی، علامت درصد فارسی «٪» بنویسید.',
        fix: { text: '٪' },
      });
    });
  },
};

export const decimalSeparator = {
  id: 'fa/decimal-separator',
  meta: {
    description: 'Opt-in: a decimal point between Persian digits becomes the Persian decimal separator (٫).',
    fixable: true,
    level: 'off',
  },
  check(file, report) {
    // Exactly one dot: ۱.۵ is a decimal, ۱۴۰۳.۰۵.۱۲ is a date.
    const re = new RegExp(`(?<![${FA_DIGIT}.])[${FA_DIGIT}]+\\.[${FA_DIGIT}]+(?![${FA_DIGIT}.])`, 'g');
    eachPersianMatch(file, re, (m, index) => {
      const dot = m[0].indexOf('.');
      report({
        index: index + dot,
        length: 1,
        message: `Use the Persian decimal separator "٫" in "${m[0]}".`,
        fa: `در «${m[0]}» ممیز فارسی «٫» بنویسید.`,
        fix: { text: '٫' },
      });
    });
  },
};

export const thousandsSeparator = {
  id: 'fa/thousands-separator',
  meta: {
    description: 'Opt-in: commas grouping Persian digits become the Persian thousands separator (٬).',
    fixable: true,
    level: 'off',
  },
  check(file, report) {
    const re = new RegExp(`(?<![${FA_DIGIT},])[${FA_DIGIT}]{1,3}(?:,[${FA_DIGIT}]{3})+(?![${FA_DIGIT}])`, 'g');
    eachPersianMatch(file, re, (m, index) => {
      const fixed = m[0].replace(/,/g, '٬');
      report({
        index,
        length: m[0].length,
        message: `Use the Persian thousands separator: "${fixed}".`,
        fa: `جداکننده\u200Cی هزارگان فارسی بنویسید: «${fixed}».`,
        fix: { text: fixed },
      });
    });
  },
};

const toPersian = (s) => s.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

export const latinDigits = {
  id: 'fa/latin-digits',
  meta: {
    description: 'Opt-in: Latin digits inside a Persian sentence become Persian digits (not in codes like 3D, v2 or 1080p).',
    fixable: true,
    level: 'off',
  },
  check(file, report) {
    // Digits standing on their own between Persian words or punctuation.
    const re = new RegExp(`(?<=(?:^|[\\s(«،؛]))[0-9]+(?=(?:$|[\\s)»،؛؟!.:]))`, 'g');
    eachPersianMatch(file, re, (m, index) => {
      const line = m.input;
      // Only when a Persian word is the nearest word on at least one side.
      const before = line.slice(0, m.index).match(/(\S+)\s*$/)?.[1] ?? '';
      const after = line.slice(m.index + m[0].length).match(/^\s*(\S+)/)?.[1] ?? '';
      const persianNeighbour = new RegExp(`[${LETTER}]`).test(before + after);
      const latinNeighbour = /[A-Za-z]/.test(before.slice(-1) + after.slice(0, 1));
      if (!persianNeighbour || latinNeighbour) return;
      const fixed = toPersian(m[0]);
      report({
        index,
        length: m[0].length,
        message: `Latin digits "${m[0]}" in Persian text; use "${fixed}".`,
        fa: `رقم لاتین «${m[0]}» در متن فارسی؛ «${fixed}» بنویسید.`,
        fix: { text: fixed },
      });
    });
  },
};

export const guillemets = {
  id: 'fa/guillemets',
  meta: {
    description: 'Opt-in, prose files only: straight double quotes around Persian text become «guillemets».',
    fixable: true,
    level: 'off',
  },
  check(file, report) {
    if (!PROSE_EXTENSIONS.has(file.ext)) return;
    const re = new RegExp(`"([^"\\n]*[${LETTER}][^"\\n]*)"`, 'g');
    eachPersianMatch(file, re, (m, index) => {
      report({
        index,
        length: m[0].length,
        message: 'Use «guillemets» for quotations in Persian text.',
        fa: 'در متن فارسی برای نقل\u200Cقول از گیومه\u200Cی «» استفاده کنید.',
        fix: { text: `«${m[1]}»` },
      });
    });
  },
};

export const arrowDirection = {
  id: 'fa/arrow-direction',
  meta: {
    description: 'A right-pointing arrow (→) in Persian text points backwards: Persian reads right to left, so "next" is ←.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    eachPersianMatch(file, /[→⟶➜➔]/g, (m, index) => {
      // Between two Latin/code tokens (margin-left → margin-inline-start) the
      // arrow belongs to left-to-right content and is correct.
      const before = m.input.slice(0, m.index).trimEnd().slice(-1);
      const after = m.input.slice(m.index + 1).trimStart().slice(0, 1);
      if (/[\x01\x21-\x7e]/.test(before) && /[\x01\x21-\x7e]/.test(after)) return;
      report({
        index,
        length: 1,
        message: `"${m[0]}" points backwards in Persian text, which reads right to left; use "←".`,
        fa: `«${m[0]}» در متن فارسی (که از راست به چپ خوانده می\u200Cشود) به عقب اشاره می\u200Cکند؛ «←» بنویسید.`,
        fix: { text: '←' },
      });
    });
  },
};
