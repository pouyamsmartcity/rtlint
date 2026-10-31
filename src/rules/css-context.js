// Where a CSS declaration sits decides whether converting it is safe. Code
// that already targets one direction ([dir="rtl"] .x, :dir(rtl), .rtl &,
// @include rtl, /* rtl:ignore */) must keep its physical sides, @page margins
// have no logical form, and an @supports not (…logical…) block is the fallback
// for browsers without logical properties.

// A selector or at-rule that targets a reading direction.
const DIRECTIONAL_PRELUDE = /rtl|ltr|\[\s*dir\b|:dir\(|:lang\(/i;
const SKIPPED_AT_RULE = /^\s*@(?:page\b|supports\s+not\b)/i;
// SCSS nested properties: `margin: { left: 4px }`.
const NESTED_PROPERTY = /^[\w-]+\s*:\s*$/;

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

/**
 * Computes, once per file, the ranges of the CSS view where declarations
 * must be left alone, plus each block's bounds for block-level checks.
 */
function analyse(file) {
  const view = file.cssView;
  const skip = [];
  const blocks = [];
  const stack = [];
  let boundary = 0;
  for (let i = 0; i < view.length; i++) {
    const c = view[i];
    if (c === '{') {
      // Raw text: the view masks string contents, which would hide [dir="rtl"].
      const prelude = stripComments(file.text.slice(boundary, i)).trim();
      stack.push({ open: i, prelude });
      boundary = i + 1;
    } else if (c === '}') {
      const block = stack.pop();
      if (block) {
        blocks.push({ open: block.open, close: i, prelude: block.prelude });
        const { prelude } = block;
        if (DIRECTIONAL_PRELUDE.test(prelude) || SKIPPED_AT_RULE.test(prelude) || NESTED_PROPERTY.test(prelude)) {
          skip.push([block.open, i]);
        }
      }
      boundary = i + 1;
    } else if (c === ';') {
      boundary = i + 1;
    }
  }
  for (const block of stack) {
    if (DIRECTIONAL_PRELUDE.test(block.prelude) || SKIPPED_AT_RULE.test(block.prelude)) skip.push([block.open, view.length]);
  }
  // RTLCSS: /*rtl:begin:ignore*/ … /*rtl:end:ignore*/ in the raw text.
  for (const m of file.text.matchAll(/\/\*!?\s*rtl:begin:ignore\s*\*\//g)) {
    const end = file.text.indexOf('rtl:end:ignore', m.index);
    skip.push([m.index, end < 0 ? file.text.length : end]);
  }
  skip.sort((a, b) => a[0] - b[0]);
  blocks.sort((a, b) => a.open - b.open);
  return { skip, blocks };
}

function cache(file) {
  if (!file._cssContext) Object.defineProperty(file, '_cssContext', { value: analyse(file) });
  return file._cssContext;
}

/** The innermost block containing `index`, as { open, close }, or null. */
export function blockAt(file, index) {
  const { blocks } = cache(file);
  let best = null;
  let lo = 0;
  let hi = blocks.length - 1;
  // Last block that opens before index; walk back to the innermost one containing it.
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (blocks[mid].open < index) lo = mid + 1;
    else hi = mid - 1;
  }
  for (let k = hi; k >= 0 && k > hi - 64; k--) {
    if (blocks[k].close > index) {
      best = blocks[k];
      break;
    }
  }
  return best;
}

/**
 * True when the declaration at `index` must not be reported: it is inside
 * direction-specific or skipped CSS, inside an unclosed "(" (a Sass map or
 * mixin arguments), or preceded by an RTLCSS /* rtl:… *\/ directive.
 */
export function leaveAlone(file, index) {
  const { skip } = cache(file);
  for (const [s, e] of skip) {
    if (s > index) break;
    if (index < e) return true;
  }
  const view = file.cssView;
  let k = index - 1;
  let parens = 0;
  while (k >= 0 && view[k] !== '{' && view[k] !== '}' && view[k] !== ';') {
    if (view[k] === '(') parens++;
    else if (view[k] === ')') parens--;
    k--;
  }
  if (parens > 0) return true;
  return /\/\*!?\s*rtl:/.test(file.text.slice(k + 1, index));
}

/** Selectors and at-rule preludes of every block containing `index`, outermost first. */
export function preludeChain(file, index) {
  const { blocks } = cache(file);
  return blocks.filter((b) => b.open < index && index < b.close).map((b) => b.prelude);
}
