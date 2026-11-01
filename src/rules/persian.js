import { codePoint, LETTER, toPersianDigits, WORD, ZWNJ } from '../unicode.js';
import { eachPersianMatch } from './util.js';

/**
 * A lone letter, or letters inside a regex class or alternation, in code are a
 * reference to the character (normalisers such as replaceAll('ي', 'ی')), not
 * Persian text.
 */
function isCharacterReference(file, index, word) {
  if (word.length === 1) return true;
  if (file.kind !== 'script' && file.kind !== 'code') return false;
  const before = file.text[index - 1] ?? '';
  const after = file.text[index + word.length] ?? '';
  return /[[|]/.test(before) || /[\]|]/.test(after);
}

const QUOTED = /«[^«»]*»|﴿[^﴿﴾]*﴾|"[^"]*"|“[^”]*”/g;
const PERSIAN_ONLY = /[پچژگیک]/;

/**
 * True when `offset` of a Persian line falls inside a quotation that is
 * Arabic: a ﴿Quran﴾ span, or a «quote» with no Persian-only letter that reads
 * as Arabic (the article ال, vocalisation, إ ى ء ة). Quoted Arabic keeps its
 * own spelling.
 */
let quoteCache = { line: null, spans: [] };

function inArabicQuote(line, offset) {
  // Rules call this for many words of the same line; find its quotes once.
  if (quoteCache.line !== line) quoteCache = { line, spans: [...line.matchAll(QUOTED)] };
  for (const q of quoteCache.spans) {
    if (offset < q.index || offset >= q.index + q[0].length) continue;
    if (q[0].startsWith('﴿')) return true;
    const inner = q[0].slice(1, -1);
    if (PERSIAN_ONLY.test(inner)) return false;
    const words = inner.match(/[\u0621-\u064A\u0671-\u06D3]+/g) ?? [];
    const articles = words.filter((w) => w.startsWith('ال')).length;
    return (words.length > 0 && articles / words.length >= 0.2) || /[\u064B-\u0652]{2}|[إى\u0621ة]/.test(inner);
  }
  return false;
}

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
      if (isCharacterReference(file, index, word) || inArabicQuote(m.input, m.index)) return;
      const fixed = word.replace(/[\u064A\u0643\u0649]/g, (c) => ARABIC_FORMS[c]);
      const found = [...new Set(word.match(/[\u064A\u0643\u0649]/g))]
        .map((c) => `"${c}" (${codePoint(c)})`)
        .join(', ');
      const foundFa = [...new Set(word.match(/[\u064A\u0643\u0649]/g))]
        .map((c) => `«${c}» عربی (${codePoint(c)})`)
        .join('، ');
      report({
        index,
        length: word.length,
        message: `Arabic ${found} in Persian word "${word}"; use "${fixed}".`,
        fa: `در «${word}» ${foundFa} آمده؛ «${fixed}» با حروف فارسی بنویسید.`,
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
      if (inArabicQuote(m.input, m.index)) return;
      const fixed = toPersianDigits(m[0]);
      report({
        index,
        length: m[0].length,
        message: `Arabic-Indic digits "${m[0]}" in Persian text; use Persian digits "${fixed}".`,
        fa: `رقم عربی «${m[0]}» در متن فارسی؛ رقم فارسی «${fixed}» بنویسید.`,
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
        fa: `عدد «${n}» رقم لاتین و فارسی را قاطی کرده؛ «${fixed}» بنویسید.`,
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
        fa: `به\u200Cجای فاصله نیم\u200Cفاصله بگذارید: «${m[1]} ${m[3]}» ← «${m[1]}${ZWNJ}${m[3]}».`,
        fix: { text: ZWNJ },
      });
    });
  },
};

const PLURAL = 'هایشان|هایتان|هایمان|هایی|هایم|هایت|هایش|های|ها';
// «تر» alone also means "wet" (میوه تر، لباس تر), so by default it is only
// joined after common adjectives; «ترین» is always a superlative.
const ADJECTIVES = [
  'بزرگ', 'کوچک', 'بیش', 'کم', 'به', 'بد', 'خوب', 'سریع', 'زیبا', 'مهم', 'ساده', 'آسان', 'سخت', 'دشوار',
  'دور', 'نزدیک', 'بالا', 'پایین', 'قوی', 'ضعیف', 'ارزان', 'گران', 'جدید', 'تازه', 'قدیمی', 'بلند', 'کوتاه',
  'سنگین', 'سبک', 'گرم', 'سرد', 'تند', 'کند', 'زیاد', 'مناسب', 'روشن', 'تاریک', 'دقیق', 'کامل', 'مطمئن',
  'امن', 'راحت', 'جذاب', 'جالب', 'عمیق', 'وسیع', 'محکم', 'شاد', 'مفید', 'پیشرفته', 'سالم', 'هوشمند',
  'پرطرفدار', 'کارآمد', 'آرام', 'شلوغ', 'خلوت', 'پهن', 'باریک', 'چاق', 'لاغر', 'جوان', 'پیر',
];
// rtlint-disable-next-line fa/* -- example or regex, not prose
// The last alternative is the ezafe: «خانه ی من» → «خانه\u200Cی من».
const AFTER_HEH = 'ایی|ای|ام|ات|اش|ایم|اید|اند|ی';

function suffixRegexes(comparatives) {
  const plain = comparatives === 'all' ? `${PLURAL}|ترین|تر` : comparatives ? `${PLURAL}|ترین` : PLURAL;
  const adjectives = comparatives === true
    ? [new RegExp(`(?<=(?:^|[^${WORD}\\u200C])(?:${ADJECTIVES.join('|')}))( +)(تر)(?![${WORD}\\u200C])`, 'g')]
    : [];
  return [
    ...adjectives,
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
      'Suffixes such as ها/های/تر/ترین, and ای/ام/اند or the ezafe ی after a final ه, attach with a zero-width non-joiner, not a space: «کتاب\u200Cها», «خانه\u200Cی من».',
    fixable: true,
    level: 'warn',
  },
  check(file, report, options) {
    for (const re of suffixRegexes(options.comparatives ?? true)) {
      eachPersianMatch(file, re, (m, index) => {
        report({
          index,
          length: m[1].length,
          message: `Attach "${m[2]}" with a zero-width non-joiner (نیم\u200Cفاصله), not a space.`,
          fa: `«${m[2]}» را با نیم\u200Cفاصله بچسبانید، نه با فاصله.`,
          fix: { text: ZWNJ },
        });
      });
    }
  },
};

// Any letter or mark, in any script: a ZWNJ between "sanitize" and a Persian
// suffix, or around a tatweel in «طلایی\u200Cـ\u200Cمشکی», is deliberate.
const ZWJ = String.fromCharCode(0x200d);

const WORD_CHAR = /[\p{L}\p{M}]/u;

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
      // Look past Markdown emphasis: in **فیزیکی**\u200Cاند the ZWNJ still separates two letters.
      let b = m.index - 1;
      while (b >= 0 && /[*_~`]/.test(line[b])) b--;
      let a = m.index + m[0].length;
      while (a < line.length && /[*_~`]/.test(line[a])) a++;
      const before = line[b] ?? '';
      const after = line[a] ?? '';
      const inside = WORD_CHAR.test(before) && WORD_CHAR.test(after);
      if (inside && m[0].length === 1) return;
      report({
        index,
        length: m[0].length,
        message: inside
          ? 'Repeated zero-width non-joiner; one is enough.'
          : 'Zero-width non-joiner outside a word (next to a space, digit or punctuation) does nothing; remove it.',
        fa: inside
          ? 'نیم\u200Cفاصله\u200Cی تکراری؛ یکی کافی است.'
          : 'نیم\u200Cفاصله\u200Cی بیرون از کلمه (کنار فاصله، عدد یا علامت) کاری نمی\u200Cکند؛ حذفش کنید.',
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
        fa: `یک ${m[0] === ZWJ ? 'اتصال\u200Cدهنده\u200Cی بی\u200Cعرض (ZWJ)' : 'فاصله\u200Cی بی\u200Cعرض (ZWSP)'} داخل کلمه\u200Cی فارسی است؛ نیم\u200Cفاصله\u200Cی درست نویسه\u200Cی U+200C است.`,
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
    // Commas separate fields in CSV and items in YAML/TOML flow lists.
    if (file.ext === 'csv' || file.ext === 'tsv') return;
    const flow = file.ext === 'yaml' || file.ext === 'yml' || file.ext === 'toml';
    const rules = [
      [new RegExp(`${BEFORE}[ \\t]*,${AFTER_WORD}`, 'g'), '،'],
      [new RegExp(`${BEFORE}[ \\t]*;${AFTER_WORD}`, 'g'), '؛'],
      [new RegExp(`${BEFORE}[ \\t]*\\?(?=\\s*(?:[${LETTER}«"'»)\\]]|$))`, 'g'), '؟'],
    ];
    for (const [re, persian] of rules) {
      eachPersianMatch(file, re, (m, index) => {
        // YAML/TOML flow lists (`tags: [a, b]`), also in Markdown front matter.
        const listLine = flow ? /[[{]/.test(m.input) : /^\s*[\w-]+\s*:\s*[[{]/.test(m.input);
        if (persian === '،' && listLine) return;
        report({
          index,
          length: m[0].length,
          message: `Latin "${m[0].trim()}" in Persian text; use "${persian}".`,
          fa: `«${m[0].trim()}» لاتین در متن فارسی؛ «${persian}» بنویسید.`,
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
        fa: 'در فارسی قبل از علامت\u200Cهای نگارشی فاصله نمی\u200Cآید.',
        fix: { text: '' },
      });
    });
    // (?<![ \t]) tries a run of spaces only from its first space: without it a
    // long run before » backtracks quadratically.
    eachPersianMatch(file, /«([ \t]+)|(?<![ \t])([ \t]+)»/g, (m, index) => {
      const opening = m[1] !== undefined;
      const spaces = opening ? m[1] : m[2];
      report({
        index: opening ? index + 1 : index,
        length: spaces.length,
        message: opening ? 'No space after «.' : 'No space before ».',
        fa: opening ? 'بعد از گیومه\u200Cی باز («) فاصله نمی\u200Cآید.' : 'قبل از گیومه\u200Cی بسته (») فاصله نمی\u200Cآید.',
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
        fa: 'کشیده (ـ) داخل کلمه\u200Cی فارسی؛ حذفش کنید.',
        fix: { text: '' },
      });
    });
  },
};
