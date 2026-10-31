import { codePoint } from '../unicode.js';

const NAMES = {
  '\u202A': 'LEFT-TO-RIGHT EMBEDDING',
  '\u202B': 'RIGHT-TO-LEFT EMBEDDING',
  '\u202C': 'POP DIRECTIONAL FORMATTING',
  '\u202D': 'LEFT-TO-RIGHT OVERRIDE',
  '\u202E': 'RIGHT-TO-LEFT OVERRIDE',
  '\u2066': 'LEFT-TO-RIGHT ISOLATE',
  '\u2067': 'RIGHT-TO-LEFT ISOLATE',
  '\u2068': 'FIRST STRONG ISOLATE',
  '\u2069': 'POP DIRECTIONAL ISOLATE',
};
const OVERRIDES = new Set(['\u202D', '\u202E']);
const EMBEDDINGS = new Set(['\u202A', '\u202B', '\u202D', '\u202E']);
const ISOLATES = new Set(['\u2066', '\u2067', '\u2068']);

function label(c) {
  return `${NAMES[c]} (${codePoint(c)})`;
}

/**
 * Invisible bidi controls can make source code display differently from how
 * it is compiled ("Trojan Source", CVE-2021-42574). In code and stylesheets
 * every control is reported; in text, markup and translation files only the
 * dangerous ones are: overrides and controls left unterminated on their line.
 */
export const bidiControl = {
  id: 'security/bidi-control',
  meta: {
    description:
      'Invisible bidirectional control characters that can hide code (Trojan Source, CVE-2021-42574) or leak direction across a line.',
    fixable: false,
    level: 'error',
  },
  check(file, report) {
    const { text } = file;
    if (!/[\u202A-\u202E\u2066-\u2069]/.test(text)) return;
    const strict = file.kind === 'script' || file.kind === 'code' || file.kind === 'css';
    const starts = file.lineStarts;
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i];
      const end = i + 1 < starts.length ? starts[i + 1] : text.length;
      const line = text.slice(start, end);
      if (!/[\u202A-\u202E\u2066-\u2069]/.test(line)) continue;
      const open = [];
      for (let j = 0; j < line.length; j++) {
        const c = line[j];
        if (!NAMES[c]) continue;
        const index = start + j;
        if (strict) {
          report({
            index,
            length: 1,
            message: `Invisible ${label(c)} in source code can make it read differently than it runs (Trojan Source, CVE-2021-42574). Remove it or write it as an escape such as \\u${c.charCodeAt(0).toString(16)}.`,
          });
          continue;
        }
        if (OVERRIDES.has(c)) {
          report({
            index,
            length: 1,
            message: `Invisible ${label(c)} reverses the visual order of the text that follows; it is almost never needed in real text. Use an isolate (U+2067…U+2069) or a mark (U+200F).`,
          });
        }
        if (EMBEDDINGS.has(c) || ISOLATES.has(c)) {
          open.push({ c, index });
        } else if (c === '\u202C' || c === '\u2069') {
          const wanted = c === '\u202C' ? EMBEDDINGS : ISOLATES;
          const k = open.findLastIndex((o) => wanted.has(o.c));
          if (k < 0) {
            report({ index, length: 1, message: `Stray ${label(c)} with nothing to close.` });
          } else open.splice(k, 1);
        }
      }
      for (const o of open) {
        report({
          index: o.index,
          length: 1,
          message: `${label(o.c)} is never closed on this line, so its direction leaks into whatever is rendered next. Close it with ${EMBEDDINGS.has(o.c) ? 'U+202C' : 'U+2069'}.`,
        });
      }
    }
  },
};
