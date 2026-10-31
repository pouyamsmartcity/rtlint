// Lightweight scanners that turn a source file into "views": strings of the
// same length as the source in which everything a rule must not look at is
// replaced by spaces (newlines are kept). Because offsets never move, a match
// in a view is also a match position in the original text.

export function blank(s) {
  return s.replace(/[^\n]/g, ' ');
}

/** Blanks out[from, to) in a char array, keeping newlines. */
function hideRange(out, from, to) {
  for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
}

// Bracket matching gives up after this many characters or nesting levels:
// real attribute expressions are short, and adversarial input must stay linear.
const SCAN_LIMIT = 4000;
const DEPTH_LIMIT = 64;

/**
 * Masks CSS comments and the contents of CSS strings (quotes are kept), so
 * `content: "a; left: 0"` is not read as a declaration. `//` line comments
 * are masked too, except in plain CSS where `//` is not a comment.
 */
export function maskCss(text, ext = 'css') {
  const out = text.split('');
  const n = text.length;
  const lineComments = ext !== 'css';
  let i = 0;
  while (i < n) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      hideRange(out, i, stop);
      i = stop;
      continue;
    }
    if (lineComments && c === '/' && text[i + 1] === '/' && (i === 0 || /[\s;{}]/.test(text[i - 1]))) {
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? n : end;
      hideRange(out, i, stop);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      const { end, terminated } = skipQuoted(text, i);
      if (terminated) hideRange(out, i + 1, end - 1);
      i = terminated ? end : i + 1;
      continue;
    }
    i++;
  }
  return out.join('');
}

export function maskHtml(text) {
  if (!text.includes('<!--')) return text;
  let out = '';
  let pos = 0;
  for (;;) {
    const open = text.indexOf('<!--', pos);
    if (open < 0) break;
    const close = text.indexOf('-->', open + 4);
    const stop = close < 0 ? text.length : close + 3;
    out += text.slice(pos, open) + blank(text.slice(open, stop));
    pos = stop;
    if (close < 0) break;
  }
  return out + text.slice(pos);
}

/** Blanks the contents of <script> blocks (keeps the tags), so HTML rules skip code and its comments. */
export function maskScripts(text) {
  if (!/<script\b/i.test(text)) return text;
  const lower = text.toLowerCase();
  let out = '';
  let pos = 0;
  for (const m of text.matchAll(/<script\b[^>]*>/gi)) {
    const start = m.index + m[0].length;
    if (start < pos) continue;
    const close = lower.indexOf('</script', start);
    const end = close < 0 ? text.length : close;
    out += text.slice(pos, start) + blank(text.slice(start, end));
    pos = end;
  }
  return out + text.slice(pos);
}

const REGEX_PRECEDER = /[(,=:[!&|?{};+\-*%~^<>]/;
const REGEX_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'yield', 'await',
]);

/** Whether a '/' at `i` starts a regex literal, judged by the token before it. */
function regexAllowed(src, i) {
  let k = i - 1;
  while (k >= 0 && (src[k] === ' ' || src[k] === '\t' || src[k] === '\n' || src[k] === '\r')) k--;
  if (k < 0) return true;
  const p = src[k];
  if (REGEX_PRECEDER.test(p)) return true;
  if (/[\w$]/.test(p)) {
    let s = k;
    while (s > 0 && /[\w$]/.test(src[s - 1])) s--;
    return REGEX_KEYWORDS.has(src.slice(s, k + 1));
  }
  return false;
}

/** Index just past a regex literal starting at `i`, or -1 if it is not one. */
function skipRegex(src, i) {
  let j = i + 1;
  let inClass = false;
  while (j < src.length) {
    const c = src[j];
    if (c === '\n') return -1;
    if (c === '\\') { j += 2; continue; }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      j++;
      while (j < src.length && /[a-z]/.test(src[j])) j++;
      return j;
    }
    j++;
  }
  return -1;
}

// A quote that opens a JSX/HTML attribute value: <Tag … name="…".
const JSX_ATTRIBUTE = /<[A-Za-z][\w.:-]*(?:\s+[^<>;]*?)?\s[\w:.@-]+\s*=\s*$/;

/**
 * Masks JavaScript/TypeScript comments while keeping strings and template
 * literals intact. Regex literals are skipped as a unit, so `/\/*$/` does
 * not open a comment.
 *
 * With `strings: true` the contents of string literals are masked too, except
 * JSX attribute values and templates tagged html`…` or svg`…` (lit, htm), so
 * markup rules see JSX and HTML templates but not messages that mention a tag.
 */
export function maskJs(src, { strings = false } = {}) {
  const out = src.split('');
  const n = src.length;
  const modes = [{ template: false, depth: 0 }];
  let i = 0;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    const top = modes[modes.length - 1];
    if (top.template) {
      if (c === '\\') {
        if (top.hidden) hideRange(out, i, i + 2);
        i += 2;
      } else if (c === '`') { modes.pop(); i++; }
      else if (c === '$' && d === '{') { modes.push({ template: false, depth: 0 }); i += 2; }
      else {
        if (top.hidden) hideRange(out, i, i + 1);
        i++;
      }
      continue;
    }
    if (c === '/' && d === '/') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? n : end;
      hideRange(out, i, stop);
      i = stop;
      continue;
    }
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      hideRange(out, i, stop);
      i = stop;
      continue;
    }
    if (c === '/' && regexAllowed(src, i)) {
      const end = skipRegex(src, i);
      if (end > 0) {
        if (strings) hideRange(out, i, end);
        i = end;
        continue;
      }
    }
    if (c === '"' || c === "'") {
      const { end, terminated } = skipQuoted(src, i);
      // An apostrophe in JSX text ("Don't") never closes; it is not a string.
      if (!terminated) { i++; continue; }
      if (strings && !JSX_ATTRIBUTE.test(src.slice(Math.max(0, i - 200), i))) hideRange(out, i + 1, end - 1);
      i = end;
      continue;
    }
    if (c === '`') {
      const tagged = /\b(?:html|svg)\s*$/.test(src.slice(Math.max(0, i - 12), i));
      modes.push({ template: true, depth: 0, hidden: strings && !tagged });
      i++;
      continue;
    }
    if (c === '{') top.depth++;
    else if (c === '}') {
      if (top.depth === 0 && modes.length > 1) { modes.pop(); i++; continue; }
      top.depth--;
    }
    i++;
  }
  return out.join('');
}

/**
 * Scans a '…' or "…" string starting at `i`. `terminated` is false when a
 * newline or the end of input comes first (JS and CSS strings cannot do that).
 */
function skipQuoted(src, i) {
  const q = src[i];
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (c === q) return { end: j + 1, terminated: true };
    if (c === '\n') return { end: j, terminated: false };
    j++;
  }
  return { end: src.length, terminated: false };
}

/**
 * Scans a template literal whose opening backtick is at `i`. Returns the
 * static text pieces and the `${…}` holes as [start, end) ranges, and the
 * index past the closing backtick.
 */
export function scanTemplate(src, i, depth = 0) {
  const pieces = [];
  const holes = [];
  let start = i + 1;
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '`') { pieces.push([start, j]); return { pieces, holes, end: j + 1 }; }
    if (c === '$' && src[j + 1] === '{') {
      pieces.push([start, j]);
      const close = matchClose(src, j + 1, '{', '}', depth + 1);
      holes.push([j + 2, close]);
      j = close;
      start = j + 1;
    }
    j++;
  }
  pieces.push([start, src.length]);
  return { pieces, holes, end: src.length };
}

/**
 * Index of the bracket that closes the one at `i`, skipping strings and
 * templates. Gives up (returns the scan limit) on runaway or deeply nested input.
 */
export function matchClose(src, i, open, close, depth = 0) {
  const limit = Math.min(src.length, i + SCAN_LIMIT);
  if (depth > DEPTH_LIMIT) return limit;
  let level = 0;
  let j = i;
  while (j < limit) {
    const c = src[j];
    if (c === '"' || c === "'") {
      const q = skipQuoted(src, j);
      j = q.terminated ? q.end : j + 1;
      continue;
    }
    if (c === '`') { j = scanTemplate(src, j, depth + 1).end; continue; }
    if (c === open) level++;
    else if (c === close && --level === 0) return j;
    j++;
  }
  return limit;
}

/** Ranges of the contents of every string literal between `from` and `to`. */
export function stringRanges(src, from, to, depth = 0) {
  const ranges = [];
  if (depth > DEPTH_LIMIT) return ranges;
  let j = from;
  while (j < to) {
    const c = src[j];
    if (c === '"' || c === "'") {
      const q = skipQuoted(src, j);
      if (!q.terminated) { j++; continue; }
      ranges.push([j + 1, Math.min(q.end - 1, to)]);
      j = q.end;
      continue;
    }
    if (c === '`') {
      const t = scanTemplate(src, j, depth + 1);
      for (const [s, e] of t.pieces) ranges.push([s, Math.min(e, to)]);
      for (const [s, e] of t.holes) ranges.push(...stringRanges(src, s, Math.min(e, to), depth + 1));
      j = t.end;
      continue;
    }
    j++;
  }
  return ranges;
}

/**
 * Builds a view that keeps `regions` of `text` and blanks everything else.
 * With a `terminator`, the first blanked character after each region becomes
 * that character, so a declaration cannot run on into the next region.
 */
export function viewFromRegions(text, regions, terminator = '') {
  const sorted = [...regions].sort((a, b) => a[0] - b[0]);
  let out = '';
  let pos = 0;
  for (const [s, e] of sorted) {
    if (e <= pos) continue;
    const from = Math.max(s, pos);
    let gap = blank(text.slice(pos, from));
    if (terminator && pos > 0 && gap[0] === ' ') gap = terminator + gap.slice(1);
    out += gap + text.slice(from, e);
    pos = e;
  }
  let tail = blank(text.slice(pos));
  if (terminator && pos > 0 && tail[0] === ' ') tail = terminator + tail.slice(1);
  return out + tail;
}

// styled.div`…`, styled(Link)`…`, styled.div<Props>`…`, css<Props>`…`, keyframes`…`.
const GENERIC = '(?:\\s*<(?:[^<>`]|<[^<>`]*>)*>)?';
const STYLED = new RegExp(
  `\\b(?:styled(?:\\.[A-Za-z]\\w*|\\s*\\([^()]*\\))(?:\\s*\\.\\s*attrs\\s*\\((?:[^()]|\\([^()]*\\))*\\))?${GENERIC}|(?:css|injectGlobal|createGlobalStyle|keyframes)${GENERIC})\\s*\``,
  'g',
);

const INDENTED_LANGS = /\blang\s*=\s*["']?(?:sass|styl|stylus)\b/i;

/**
 * CSS regions: whole stylesheets, <style> blocks, style="" attributes and
 * styled-components/emotion templates. `indented` lists <style lang="sass">
 * blocks, where a fix must not add semicolons.
 */
export function cssRegions(file) {
  const { text, kind } = file;
  if (kind === 'css') return { view: maskCss(text, file.ext), regions: [[0, text.length]], indented: [] };
  const regions = [];
  const indented = [];
  if (kind === 'markup') {
    const src = file.markupView;
    const lower = src.toLowerCase();
    for (const m of src.matchAll(/<style\b([^>]*)>/gi)) {
      const start = m.index + m[0].length;
      const close = lower.indexOf('</style', start);
      const range = [start, close < 0 ? src.length : close];
      regions.push(range);
      if (INDENTED_LANGS.test(m[1])) indented.push(range);
    }
    for (const m of src.matchAll(/(?<![\w:.@-])style\s*=\s*(["'])/gi)) {
      const start = m.index + m[0].length;
      const close = src.indexOf(m[1], start);
      if (close > 0) regions.push([start, close]);
    }
  } else if (kind === 'script') {
    const src = file.scriptView;
    for (const m of src.matchAll(STYLED)) {
      const tick = m.index + m[0].length - 1;
      regions.push(...scanTemplate(src, tick).pieces);
    }
  }
  if (!regions.length) return { view: blank(text), regions, indented };
  // <style lang="scss"> may use // comments; plain CSS never starts a line with //.
  return { view: maskCss(viewFromRegions(text, regions, ';'), 'scss'), regions, indented };
}

const CLASS_ATTR =
  /(?<![\w:.@-])(class|className|class:list|:class|v-bind:class|\[ngClass\]|ngClass|\[class\])\s*=\s*/g;
const CLASS_HELPER = /\b(?:cn|clsx|classnames|classNames|cx|cva|twMerge|twJoin|tv)\s*\(/g;
const CLASS_DIRECTIVE = /(?<![\w-])class:([^\s=>/"'{}]+)(?=[\s=>/])/g;

/**
 * End of a quoted attribute value that may contain {…} expressions with their
 * own quotes (Svelte/Astro: class="a {x ? "b" : ""} c").
 */
function attributeEnd(src, start, quote) {
  const limit = Math.min(src.length, start + SCAN_LIMIT);
  let j = start;
  while (j < limit) {
    const c = src[j];
    if (c === quote) return j;
    if (c === '{') {
      j = matchClose(src, j, '{', '}') + 1;
      continue;
    }
    j++;
  }
  return -1;
}

/** Splits a static attribute value into its literal text and the strings inside its {…} expressions. */
function staticValueRanges(src, start, end) {
  const ranges = [];
  let pos = start;
  let j = start;
  while (j < end) {
    if (src[j] === '{') {
      ranges.push([pos, j]);
      const close = Math.min(matchClose(src, j, '{', '}'), end);
      ranges.push(...stringRanges(src, j + 1, close));
      j = close + 1;
      pos = j;
      continue;
    }
    j++;
  }
  ranges.push([pos, end]);
  return ranges;
}

/**
 * Regions holding class names: class/className attributes, Svelte class:
 * directives, and string literals passed to class helpers such as clsx() or
 * cn(). Each region is one attribute value or one string, so rules can reason
 * about the classes that sit together.
 */
export function classRegions(file) {
  const { kind } = file;
  if (kind !== 'markup' && kind !== 'script') return [];
  const src = kind === 'markup' ? file.markupView : file.scriptView;
  const regions = [];
  for (const m of src.matchAll(CLASS_ATTR)) {
    const name = m[1];
    const p = m.index + m[0].length;
    const c = src[p];
    const dynamic = name.startsWith(':') || name.startsWith('v-bind') || name.startsWith('[');
    if (c === '"' || c === "'") {
      if (dynamic) {
        const end = src.indexOf(c, p + 1);
        if (end > 0) regions.push(...stringRanges(src, p + 1, end));
      } else {
        const end = attributeEnd(src, p + 1, c);
        if (end > 0) regions.push(...staticValueRanges(src, p + 1, end));
      }
    } else if (c === '{') {
      regions.push(...stringRanges(src, p + 1, matchClose(src, p, '{', '}')));
    } else if (c === '`') {
      regions.push(...scanTemplate(src, p).pieces);
    }
  }
  if (kind === 'markup' && file.ext === 'svelte') {
    for (const m of src.matchAll(CLASS_DIRECTIVE)) {
      const start = m.index + 6;
      regions.push([start, start + m[1].length]);
    }
  }
  for (const m of src.matchAll(CLASS_HELPER)) {
    const open = m.index + m[0].length - 1;
    regions.push(...stringRanges(src, open + 1, matchClose(src, open, '(', ')')));
  }
  for (const m of src.matchAll(/\btw\s*`/g)) {
    regions.push(...scanTemplate(src, m.index + m[0].length - 1).pieces);
  }
  // styles["text-left"] is a CSS Modules lookup, not a class list.
  const memberAccess = ([s]) => /[\w$)\]]\s*\[\s*["'`]$/.test(src.slice(Math.max(0, s - 40), s));
  return dedupeRegions(regions.filter((r) => !memberAccess(r)));
}

function dedupeRegions(regions) {
  const seen = new Set();
  return regions
    .filter(([s, e]) => e > s)
    .filter(([s, e]) => {
      const key = s + ':' + e;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a[0] - b[0]);
}
