/** Runs a global regex over every Persian line; `cb(match, absoluteIndex)`. */
export function eachPersianMatch(file, re, cb) {
  for (const { start, text } of file.persianLines) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) cb(m, start + m.index);
  }
}

export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits a region of `text` into whitespace-separated tokens with their offsets. */
export function tokens(text, [start, end]) {
  const out = [];
  const re = /\S+/g;
  const slice = text.slice(start, end);
  for (const m of slice.matchAll(re)) out.push({ text: m[0], index: start + m.index });
  return out;
}

/** Splits a CSS value on top-level whitespace (not inside parentheses). */
export function splitCssValue(value) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const c of value) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (/\s/.test(c) && depth === 0) {
      if (cur) parts.push(cur);
      cur = '';
    } else cur += c;
  }
  if (cur) parts.push(cur);
  return parts;
}

/** Reads an attribute from an HTML/JSX attribute string. */
export function getAttr(attrs, name) {
  const re = new RegExp(
    `(?<![\\w:.-])${escapeRe(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^}]*)\\}|([^\\s"'=<>\`{}]+))`,
    'i',
  );
  const m = attrs.match(re);
  if (!m) {
    const bare = new RegExp(`(?<![\\w:.-])${escapeRe(name)}(?![\\w:.-]|\\s*=)`, 'i');
    return bare.test(attrs) ? { present: true, value: '', dynamic: false, index: -1 } : null;
  }
  if (m[4] !== undefined) {
    // Unquoted HTML value: lang=fa, type=email.
    const value = m[4].replace(/\/$/, '');
    return { present: true, value, dynamic: false, index: m.index, valueStart: m.index + m[0].length - m[4].length };
  }
  const valueStart = m.index + m[0].length - (m[1] ?? m[2] ?? m[3]).length - 1;
  if (m[3] !== undefined) {
    const literal = m[3].match(/^\s*(["'`])([^"'`$]*)\1\s*$/);
    if (literal) return { present: true, value: literal[2], dynamic: false, index: m.index, valueStart };
    return { present: true, value: m[3], dynamic: true, index: m.index, valueStart };
  }
  const value = m[1] ?? m[2];
  const dynamic = /\{\{|\{%|<\?|%[\w.]+%|\$\{/.test(value);
  return { present: true, value, dynamic, index: m.index, valueStart };
}

const DIRECTION_WORD = /rtl|ltr|\bdir\b|direction|I18nManager/i;
const CONDITION_BEFORE = /(?:rtl|ltr|\bdir\b|direction|I18nManager)[^;\n]*?(?:\?|&&|\|\|)[^;\n]*$/i;

/**
 * True when the code at [index, index + length) is picked by a direction
 * check, e.g. `isRtl ? 'mr-2' : 'ml-2'`, `{ 'ml-2': !isRtl }` or
 * `marginLeft: isRTL ? 0 : 8`. Such code already handles RTL, and converting
 * it to logical properties would swap the sides a second time.
 */
export function directionConditional(src, index, length) {
  if (CONDITION_BEFORE.test(src.slice(Math.max(0, index - 160), index))) return true;
  // A key whose value depends on direction: `'ml-2': !isRtl` or `marginLeft: isRTL ? 0 : 8`.
  const after = src.slice(index + length, index + length + 120);
  if (!/^['"`]?\s*:/.test(after)) return false;
  const stop = after.search(/[,;}\n]/);
  return DIRECTION_WORD.test(stop < 0 ? after : after.slice(0, stop));
}
