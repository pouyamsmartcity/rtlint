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
    `(?<![\\w:.-])${escapeRe(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^}]*)\\})`,
    'i',
  );
  const m = attrs.match(re);
  if (!m) {
    const bare = new RegExp(`(?<![\\w:.-])${escapeRe(name)}(?![\\w:.-]|\\s*=)`, 'i');
    return bare.test(attrs) ? { present: true, value: '', dynamic: false, index: -1 } : null;
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
