// Lightweight scanners that turn a source file into "views": strings of the
// same length as the source in which everything a rule must not look at is
// replaced by spaces (newlines are kept). Because offsets never move, a match
// in a view is also a match position in the original text.

export function blank(s) {
  return s.replace(/[^\n]/g, ' ');
}

/** Masks CSS comments. `//` line comments are masked too, except in plain CSS. */
export function maskCss(text, ext = 'css') {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (ext !== 'css') {
    out = out.replace(/(^|[\s;{}])(\/\/[^\n]*)/g, (_, pre, comment) => pre + blank(comment));
  }
  return out;
}

export function maskHtml(text) {
  return text.replace(/<!--[\s\S]*?-->/g, blank);
}

/**
 * Masks JavaScript/TypeScript comments while keeping strings and template
 * literals intact. Regex literals are not recognised; that can only cause a
 * missed report, never a false one.
 *
 * With `strings: true` the contents of string literals are masked too, except
 * templates tagged html`…` or svg`…` (lit, htm), so markup rules see JSX and
 * HTML templates but not messages that merely mention a tag.
 */
export function maskJs(src, { strings = false } = {}) {
  const out = src.split('');
  const n = src.length;
  const modes = [{ template: false, depth: 0 }];
  const hide = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  let i = 0;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    const top = modes[modes.length - 1];
    if (top.template) {
      if (c === '\\') {
        if (top.hidden) hide(i, i + 2);
        i += 2;
      } else if (c === '`') { modes.pop(); i++; }
      else if (c === '$' && d === '{') { modes.push({ template: false, depth: 0 }); i += 2; }
      else {
        if (top.hidden) hide(i, i + 1);
        i++;
      }
      continue;
    }
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') out[i++] = ' ';
      continue;
    }
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      for (; i < stop; i++) if (src[i] !== '\n') out[i] = ' ';
      continue;
    }
    if (c === '"' || c === "'") {
      const end = skipQuoted(src, i);
      // A JSX attribute value (name="…", no space before '=') stays visible.
      if (strings && !/[\w-]=\s*$/.test(src.slice(Math.max(0, i - 40), i))) hide(i + 1, end - 1);
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

/** Returns the index just past a '…' or "…" string starting at `i`. Stops at a newline. */
function skipQuoted(src, i) {
  const q = src[i];
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (c === q) return j + 1;
    if (c === '\n') return j;
    j++;
  }
  return j;
}

/**
 * Scans a template literal whose opening backtick is at `i`. Returns the
 * static text pieces as [start, end) ranges and the index past the closing
 * backtick.
 */
export function scanTemplate(src, i) {
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
      const close = matchClose(src, j + 1, '{', '}');
      holes.push([j + 2, close]);
      j = close;
      start = j + 1;
    }
    j++;
  }
  pieces.push([start, src.length]);
  return { pieces, holes, end: src.length };
}

/** Index of the bracket that closes the one at `i`, skipping strings. */
export function matchClose(src, i, open, close) {
  let depth = 0;
  let j = i;
  while (j < src.length) {
    const c = src[j];
    if (c === '"' || c === "'") { j = skipQuoted(src, j); continue; }
    if (c === '`') { j = scanTemplate(src, j).end; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return j;
    j++;
  }
  return src.length;
}

/** Ranges of the contents of every string literal between `from` and `to`. */
export function stringRanges(src, from, to) {
  const ranges = [];
  let j = from;
  while (j < to) {
    const c = src[j];
    if (c === '"' || c === "'") {
      const end = skipQuoted(src, j);
      ranges.push([j + 1, Math.min(end - 1, to)]);
      j = end;
      continue;
    }
    if (c === '`') {
      const t = scanTemplate(src, j);
      for (const [s, e] of t.pieces) ranges.push([s, Math.min(e, to)]);
      for (const [s, e] of t.holes) ranges.push(...stringRanges(src, s, Math.min(e, to)));
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

const STYLED =
  /\b(?:styled(?:\.[A-Za-z]\w*|\s*\([^()]*\))(?:\s*\.\s*attrs\s*\((?:[^()]|\([^()]*\))*\))?|css|injectGlobal|createGlobalStyle|keyframes)\s*`/g;

/** CSS regions: whole stylesheets, <style> blocks, style="" attributes, styled-components/emotion templates. */
export function cssRegions(file) {
  const { text, kind } = file;
  if (kind === 'css') return { view: maskCss(text, file.ext), regions: [[0, text.length]] };
  const regions = [];
  if (kind === 'markup') {
    const src = file.markupView;
    for (const m of src.matchAll(/<style\b[^>]*>/gi)) {
      const start = m.index + m[0].length;
      const close = src.toLowerCase().indexOf('</style', start);
      regions.push([start, close < 0 ? src.length : close]);
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
  if (!regions.length) return { view: blank(text), regions };
  return { view: maskCss(viewFromRegions(text, regions, ';'), 'css'), regions };
}

const CLASS_ATTR =
  /(?<![\w:.@-])(class|className|class:list|:class|v-bind:class|\[ngClass\]|ngClass|\[class\])\s*=\s*/g;
const CLASS_HELPER = /\b(?:cn|clsx|classnames|classNames|cx|cva|twMerge|twJoin|tv)\s*\(/g;

/**
 * Regions holding class names: class/className attributes and string
 * literals passed to class helpers such as clsx() or cn(). Each region is
 * one attribute value or one string, so rules can reason about the classes
 * that sit together.
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
      const end = src.indexOf(c, p + 1);
      if (end < 0) continue;
      if (dynamic) regions.push(...stringRanges(src, p + 1, end));
      else regions.push([p + 1, end]);
    } else if (c === '{') {
      regions.push(...stringRanges(src, p + 1, matchClose(src, p, '{', '}')));
    } else if (c === '`') {
      regions.push(...scanTemplate(src, p).pieces);
    }
  }
  for (const m of src.matchAll(CLASS_HELPER)) {
    const open = m.index + m[0].length - 1;
    regions.push(...stringRanges(src, open + 1, matchClose(src, open, '(', ')')));
  }
  for (const m of src.matchAll(/\btw\s*`/g)) {
    regions.push(...scanTemplate(src, m.index + m[0].length - 1).pieces);
  }
  return dedupeRegions(regions);
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
