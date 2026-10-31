import { codePoint, LETTER, toPersianDigits, WORD, ZWNJ } from '../unicode.js';
import { eachPersianMatch } from './util.js';

const ARABIC_FORMS = { '\u064A': 'ی', '\u0643': 'ک', '\u0649': 'ی' };
const WORD_RE = new RegExp(`[${WORD}\\u0640\\u200C]+`, 'g');

export const arabicLetters = {
  id: 'fa/arabic-letters',
  meta: {
    description:
      'Arabic yeh (\u064A), kaf (\u0643) and alef maksura (\u0649) in Persian text break search, sorting and rendering; use ی and ک.',
    fixable: true,
    level: 'error',
  },
  check(file, report) {
    eachPersianMatch(file, WORD_RE, (m, index) => {
      const word = m[0];
      if (!/[\u064A\u0643\u0649]/.test(word)) return;
      const fixed = word.replace(/[\u064A\u0643\u0649]/g, (c) => ARABIC_FORMS[c]);
      const found = [...new Set(word.match(/[\u064A\u0643\u0649]/g))]
        .map((c) => `"${c}" (${codePoint(c)})`)
        .join(', ');
      report({
        index,
        length: word.length,
        message: `Arabic ${found} in Persian word "${word}"; use "${fixed}".`,
        fix: { text: fixed },
      });
    });
  },
};

export const arabicDigits = {
  id: 'fa/arabic-digits',
  meta: {
    description: 'Arabic-Indic digits (\u0664\u0665\u0666) in Persian text; use Persian digits (\u06F4\u06F5\u06F6).',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    eachPersianMatch(file, /[\u0660-\u0669]+/g, (m, index) => {
      const fixed = toPersianDigits(m[0]);
      report({
        index,
        length: m[0].length,
        message: `Arabic-Indic digits "${m[0]}" in Persian text; use Persian digits "${fixed}".`,
        fix: { text: fixed },
      });
    });
  },
};

export const mixedDigits = {
  id: 'fa/mixed-digits',
  meta: {
    description: 'A number written with a mix of Latin and Persian/Arabic digits (e.g. \u06F1\u06F23).',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    eachPersianMatch(file, /[0-9\u06F0-\u06F9\u0660-\u0669]+/g, (m, index) => {
      const n = m[0];
      if (!/[0-9]/.test(n) || !/[\u06F0-\u06F9\u0660-\u0669]/.test(n)) return;
      const fixed = toPersianDigits(n);
      report({
        index,
        length: n.length,
        message: `Number "${n}" mixes Latin and Persian digits; use "${fixed}".`,
        fix: { text: fixed },
      });
    });
  },
};

// Words after which "می" is far more likely a standalone word than a prefix.
const NOT_A_VERB = new Set([
  'و', 'که', 'را', 'از', 'به', 'در', 'با', 'ای', 'یا', 'هم', 'نه', 'تا', 'این', 'آن', 'است', 'بود',
]);
const PREFIX_RE = new RegExp(
  `(?<![${WORD}\\u200C\\u0640])(\u0646?\u0645[\\u06CC\\u064A])( +)(?=([${LETTER}]+))`,
  'g',
);

export const zwnjPrefix = {
  id: 'fa/zwnj-prefix',
  meta: {
    description:
      'The verb prefixes می/نمی are joined to the verb with a zero-width non-joiner (نیم\u200Cفاصله), not a space: «می\u200Cروم».',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    eachPersianMatch(file, PREFIX_RE, (m, index) => {
      if (NOT_A_VERB.has(m[3])) return;
      report({
        index: index + m[1].length,
        length: m[2].length,
        message: `Use a zero-width non-joiner (نیم\u200Cفاصله) instead of a space: "${m[1]} ${m[3]}" → "${m[1]}${ZWNJ}${m[3]}".`,
        fix: { text: ZWNJ },
      });
    });
  },
};

const PLURAL = 'هایشان|هایتان|هایمان|هایی|هایم|هایت|هایش|های|ها';
const COMPARATIVE = 'ترین|تر';
const AFTER_HEH = 'ایی|ای|ام|ات|اش|ایم|اید|اند';

function suffixRegexes(comparatives) {
  const plain = comparatives ? `${PLURAL}|${COMPARATIVE}` : PLURAL;
  return [
    new RegExp(`(?<=[${WORD}])( +)(${plain})(?![${WORD}\\u200C])`, 'g'),
    // rtlint-disable-next-line fa/*
    // "خانه ای", "رفته اند": only after a word of three letters or more ending in ه,
    // so که / چه / نه / به are never touched.
    new RegExp(`(?<=[${LETTER}]{2}\\u0647)( +)(${AFTER_HEH})(?![${WORD}\\u200C])`, 'g'),
  ];
}

export const zwnjSuffix = {
  id: 'fa/zwnj-suffix',
  meta: {
    description:
      'Suffixes such as ها/های/تر/ترین and ای/ام/اند after a final ه attach with a zero-width non-joiner, not a space: «کتاب\u200Cها».',
    fixable: true,
    level: 'warn',
  },
  check(file, report, options) {
    for (const re of suffixRegexes(options.comparatives !== false)) {
      eachPersianMatch(file, re, (m, index) => {
        report({
          index,
          length: m[1].length,
          message: `Attach "${m[2]}" with a zero-width non-joiner (نیم\u200Cفاصله), not a space.`,
          fix: { text: ZWNJ },
        });
      });
    }
  },
};

const WORD_CHAR = new RegExp(`[${WORD}]`);

export const zwnjInvalid = {
  id: 'fa/zwnj-invalid',
  meta: {
    description:
      'Zero-width non-joiners that are doubled, next to a space or outside a word, and ZWJ/ZWSP used where a ZWNJ was meant.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    eachPersianMatch(file, /\u200C+/g, (m, index) => {
      const line = m.input;
      const before = line[m.index - 1] ?? '';
      const after = line[m.index + m[0].length] ?? '';
      const inside = WORD_CHAR.test(before) && WORD_CHAR.test(after);
      if (inside && m[0].length === 1) return;
      report({
        index,
        length: m[0].length,
        message: inside
          ? 'Repeated zero-width non-joiner; one is enough.'
          : 'Zero-width non-joiner outside a word (next to a space, digit or punctuation) does nothing; remove it.',
        fix: { text: inside ? ZWNJ : '' },
      });
    });
    const joiner = new RegExp(`(?<=[${LETTER}])[\\u200D\\u200B](?=[${LETTER}])`, 'g');
    eachPersianMatch(file, joiner, (m, index) => {
      const name = m[0] === '\u200D' ? 'zero-width joiner (ZWJ)' : 'zero-width space (ZWSP)';
      report({
        index,
        length: 1,
        message: `A ${name} sits inside a Persian word; the half-space is the zero-width non-joiner (U+200C).`,
        fix: { text: ZWNJ },
      });
    });
  },
};

const BEFORE = `(?<=[${WORD}])`;
const AFTER_WORD = `(?=\\s*(?:[${LETTER}]|$))`;

export const punctuation = {
  id: 'fa/punctuation',
  meta: {
    description: 'Latin comma, semicolon and question mark between Persian words; use ، ؛ ؟',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    const rules = [
      [new RegExp(`${BEFORE},${AFTER_WORD}`, 'g'), '،'],
      [new RegExp(`${BEFORE};${AFTER_WORD}`, 'g'), '؛'],
      [new RegExp(`${BEFORE}\\?(?=\\s*(?:[${LETTER}«"'»)\\]]|$))`, 'g'), '؟'],
    ];
    for (const [re, persian] of rules) {
      eachPersianMatch(file, re, (m, index) => {
        report({
          index,
          length: 1,
          message: `Latin "${m[0]}" in Persian text; use "${persian}".`,
          fix: { text: persian },
        });
      });
    }
  },
};

export const spacing = {
  id: 'fa/punctuation-spacing',
  meta: {
    description: 'No space before ، ؛ ؟ ! . and none just inside « » guillemets.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    const before = new RegExp(`(?<=[${WORD}\\u06F0-\\u06F9»)])([ \\t]+)(?=[،؛؟!.](?:\\s|$|[»)"']))`, 'g');
    eachPersianMatch(file, before, (m, index) => {
      report({
        index,
        length: m[1].length,
        message: 'No space before punctuation in Persian.',
        fix: { text: '' },
      });
    });
    eachPersianMatch(file, /«([ \t]+)|([ \t]+)»/g, (m, index) => {
      const opening = m[1] !== undefined;
      const spaces = opening ? m[1] : m[2];
      report({
        index: opening ? index + 1 : index,
        length: spaces.length,
        message: opening ? 'No space after «.' : 'No space before ».',
        fix: { text: '' },
      });
    });
  },
};

export const kashida = {
  id: 'fa/kashida',
  meta: {
    description:
      'Kashida/tatweel (ـ) stretches words visually but breaks search and copy; use CSS text-align: justify instead.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    const re = new RegExp(`(?<=[${LETTER}])\\u0640+(?=[${WORD}])`, 'g');
    eachPersianMatch(file, re, (m, index) => {
      report({
        index,
        length: m[0].length,
        message: 'Kashida (tatweel) inside a Persian word; remove it.',
        fix: { text: '' },
      });
    });
  },
};
