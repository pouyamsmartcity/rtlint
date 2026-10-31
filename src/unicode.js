// Character classes shared by the Persian and bidi rules. Kept as regex
// source fragments so rules can compose them into larger patterns.

/** Arabic-script letters: no digits, punctuation, tatweel or combining marks. */
export const LETTER =
  '\\u0621-\\u063A\\u0641-\\u064A\\u066E\\u066F\\u0671-\\u06D3\\u06D5\\u06EE\\u06EF\\u06FA-\\u06FC\\u06FF';

/** Combining marks (harakat, superscript alef, Quranic marks) that live inside words. */
export const MARK = '\\u064B-\\u065F\\u0670\\u06D6-\\u06ED';

/** Everything that can sit inside an Arabic-script word. */
export const WORD = LETTER + MARK;

export const ZWNJ = '\u200C';

/** Letters only Persian uses among the large Arabic-script languages, plus Persian digits. */
export const PERSIAN_SIGNAL = /[\u067E\u0686\u0698\u06AF\u06A9\u06CC\u06F0-\u06F9]/;

/** Persian letters Arabic never uses: the strongest file-level signal. */
export const PERSIAN_STRONG = /[\u067E\u0686\u0698\u06AF]/g;

/**
 * Letters that mark a line as Arabic (taa marbuta), Urdu, Kurdish, Pashto or
 * Uyghur rather than Persian. A line containing any of them is left alone.
 */
export const NOT_PERSIAN =
  /[\u0629\u0679\u0688\u0691\u06BA\u06BE\u06C1\u06D2\u06D3\u0695\u06B5\u06C6\u06CE\u06D5\u067C\u0681\u0685\u0689\u0693\u0696\u069A\u06BC\u06CD\u06D0\u06C7\u06C8\u06CB]/;

export const HAS_ARABIC_SCRIPT = new RegExp(`[${LETTER}]`);

const PERSIAN_DIGIT_OFFSET = 0x06f0;

/** Converts Latin and Arabic-Indic digits to Persian digits. */
export function toPersianDigits(s) {
  return s.replace(/[0-9\u0660-\u0669]/g, (d) => {
    const code = d.charCodeAt(0);
    const n = code <= 0x39 ? code - 0x30 : code - 0x0660;
    return String.fromCharCode(PERSIAN_DIGIT_OFFSET + n);
  });
}

/** Hex code point label, e.g. U+064A. */
export function codePoint(ch) {
  return 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
}
