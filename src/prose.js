// The "prose view" is what the Persian rules read: the text with everything
// that is not human language replaced by a mask character (newlines kept, so
// offsets still line up). A mask that is neither a letter nor whitespace also
// stops a match from running across code, e.g. "کتاب" + "ها".
//
// Masked: URLs; Markdown code spans and fences; and in code, regex literals
// and single-token string literals such as 'ي' or '٠١٢٣٤٥٦٧٨٩', which are
// almost always character tables (normalisers), keys or identifiers. Strings
// containing a space, comments and JSX text stay visible.

export const MASK = String.fromCharCode(1);

function hide(out, from, to) {
  for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = MASK;
}

const URL = /\b(?:https?|ftp|file):\/\/[^\s<>"'`)\]]+|\bwww\.[^\s<>"'`)\]]+|\bmailto:[^\s<>"'`)\]]+/g;

const HASH_COMMENTS = new Set(['py', 'rb', 'sh', 'bash', 'zsh', 'r', 'pl', 'ex', 'exs']);
const TRIPLE_QUOTES = new Set(['py', 'dart', 'kt', 'kts', 'swift', 'scala']);

const REGEX_PRECEDER = /[(,=:[!&|?{};+\-*%~^<>]/;
const REGEX_KEYWORDS = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/;

function regexStart(src, i) {
  let k = i - 1;
  while (k >= 0 && /\s/.test(src[k])) k--;
  if (k < 0) return true;
  if (REGEX_PRECEDER.test(src[k])) return true;
  return REGEX_KEYWORDS.test(src.slice(Math.max(0, k - 12), k + 1));
}

/** Index past a regex literal at `i`, or -1. */
function regexEnd(src, i) {
  let inClass = false;
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\n') return -1;
    if (c === '\\') { j++; continue; }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      j++;
      while (j < src.length && /[a-z]/.test(src[j])) j++;
      return j;
    }
  }
  return -1;
}

/** End index (exclusive) of a string literal opening at `i`, or -1 if it never closes. */
function stringEnd(src, i, triple) {
  const q = src[i];
  if (triple) {
    const close = src.indexOf(q + q + q, i + 3);
    return close < 0 ? -1 : close + 3;
  }
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') { j++; continue; }
    if (c === q) return j + 1;
    if (c === '\n' && q !== '`') return -1;
  }
  return -1;
}

/** Masks single-token string literals, regex literals and URLs in code. */
function maskCode(text, ext, js) {
  const out = text.split('');
  const hash = HASH_COMMENTS.has(ext);
  const tripleOk = TRIPLE_QUOTES.has(ext);
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];
    const d = text[i + 1];
    if ((!hash && c === '/' && d === '/') || (hash && c === '#') || (ext === 'sql' && c === '-' && d === '-')) {
      const end = text.indexOf('\n', i);
      i = end < 0 ? n : end;
      continue;
    }
    if (!hash && c === '/' && d === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (js && c === '/' && regexStart(text, i)) {
      const end = regexEnd(text, i);
      if (end > 0) {
        hide(out, i, end);
        i = end;
        continue;
      }
    }
    if (c === '"' || c === "'" || c === '`') {
      const triple = tripleOk && d === c && text[i + 2] === c;
      const end = stringEnd(text, i, triple);
      if (end < 0) { i++; continue; }
      const body = text.slice(i + (triple ? 3 : 1), end - (triple ? 3 : 1));
      // A real space makes it prose; \s alone would also count a BOM (U+FEFF) in a character table.
      if (!/[^\S\uFEFF]/.test(body.replace(/\$\{[^}]*\}/g, ''))) hide(out, i, end);
      i = end;
      continue;
    }
    i++;
  }
  return out.join('');
}

/** Masks fenced code blocks and inline code spans in Markdown. */
function maskMarkdown(text) {
  const out = text.split('');
  for (const m of text.matchAll(/^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1?\2[ \t]*$|(?![\s\S]))/gm)) {
    hide(out, m.index, m.index + m[0].length);
  }
  maskCodeSpans(text, out);
  return out.join('');
}

/**
 * Inline code: a run of N backticks up to the next run of exactly N on the
 * same line. Unpaired runs of two or more (empty ``) are hidden too. A scan,
 * not a regex: /(`+)(?!`)…\1/ retries from every backtick of a long run.
 */
function maskCodeSpans(text, out) {
  const runs = [...text.matchAll(/`+|\n/g)];
  for (let start = 0; start < runs.length; ) {
    let end = start;
    while (end < runs.length && runs[end][0] !== '\n') end++;
    // partner[k]: the next run on this line with the same length, or -1.
    const partner = new Array(end - start).fill(-1);
    const seen = new Map();
    for (let k = end - 1; k >= start; k--) {
      const len = runs[k][0].length;
      partner[k - start] = seen.get(len) ?? -1;
      seen.set(len, k);
    }
    for (let k = start; k < end; ) {
      const run = runs[k];
      const close = partner[k - start];
      if (close !== -1) {
        hide(out, run.index, runs[close].index + runs[close][0].length);
        k = close + 1;
      } else {
        if (run[0].length > 1) hide(out, run.index, run.index + run[0].length);
        k++;
      }
    }
    start = end + 1;
  }
}

const MARKDOWN = new Set(['md', 'mdx', 'markdown']);

export function proseText(file) {
  const { text, kind, ext } = file;
  let out = text;
  if (kind === 'script') out = maskCode(text, ext, true);
  else if (kind === 'code') out = maskCode(text, ext, false);
  else if (MARKDOWN.has(ext)) out = maskMarkdown(text);
  else if (kind === 'markup' && /<script\b/i.test(text)) {
    // <script> blocks of .vue/.svelte/.html files are code.
    const lower = text.toLowerCase();
    let pieces = '';
    let pos = 0;
    for (const m of text.matchAll(/<script\b[^>]*>/gi)) {
      const start = m.index + m[0].length;
      if (start < pos) continue;
      const close = lower.indexOf('</script', start);
      const end = close < 0 ? text.length : close;
      pieces += text.slice(pos, start) + maskCode(text.slice(start, end), 'js', true);
      pos = end;
    }
    out = pieces + text.slice(pos);
  }
  if (!/[:.]/.test(out)) return out;
  const chars = out.split('');
  let changed = false;
  for (const m of out.matchAll(URL)) {
    hide(chars, m.index, m.index + m[0].length);
    changed = true;
  }
  return changed ? chars.join('') : out;
}
