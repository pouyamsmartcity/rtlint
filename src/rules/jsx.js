import { directionConditional } from './util.js';

const WEB = {
  marginLeft: 'marginInlineStart',
  marginRight: 'marginInlineEnd',
  paddingLeft: 'paddingInlineStart',
  paddingRight: 'paddingInlineEnd',
  borderLeft: 'borderInlineStart',
  borderRight: 'borderInlineEnd',
  borderLeftWidth: 'borderInlineStartWidth',
  borderRightWidth: 'borderInlineEndWidth',
  borderLeftColor: 'borderInlineStartColor',
  borderRightColor: 'borderInlineEndColor',
  borderLeftStyle: 'borderInlineStartStyle',
  borderRightStyle: 'borderInlineEndStyle',
  borderTopLeftRadius: 'borderStartStartRadius',
  borderTopRightRadius: 'borderStartEndRadius',
  borderBottomLeftRadius: 'borderEndStartRadius',
  borderBottomRightRadius: 'borderEndEndRadius',
  scrollMarginLeft: 'scrollMarginInlineStart',
  scrollMarginRight: 'scrollMarginInlineEnd',
  scrollPaddingLeft: 'scrollPaddingInlineStart',
  scrollPaddingRight: 'scrollPaddingInlineEnd',
};

// React Native has its own start/end vocabulary and flips it with I18nManager.
const NATIVE = {
  marginLeft: 'marginStart',
  marginRight: 'marginEnd',
  paddingLeft: 'paddingStart',
  paddingRight: 'paddingEnd',
  borderLeftWidth: 'borderStartWidth',
  borderRightWidth: 'borderEndWidth',
  borderLeftColor: 'borderStartColor',
  borderRightColor: 'borderEndColor',
  borderTopLeftRadius: 'borderTopStartRadius',
  borderTopRightRadius: 'borderTopEndRadius',
  borderBottomLeftRadius: 'borderBottomStartRadius',
  borderBottomRightRadius: 'borderBottomEndRadius',
};

const KEYS = Object.keys(WEB).sort((a, b) => b.length - a.length).join('|');
const KEY = new RegExp(`(^|[\\s{,(])(['"]?)(${KEYS})\\2\\s*:`, 'g');
const VALUE = /(^|[\s{,(])(['"]?)(textAlign|float|clear)\2\s*:\s*(['"])(left|right)\4/g;
const LOGICAL_VALUE = {
  textAlign: { left: 'start', right: 'end' },
  float: { left: 'inline-start', right: 'inline-end' },
  clear: { left: 'inline-start', right: 'inline-end' },
};

const REACT_NATIVE = /from\s*['"]react-native['"]|require\(\s*['"]react-native['"]\s*\)/;
const UI_HINT = /\bstyle\s*=\s*\{|StyleSheet\.create|\bstyled\b|from\s*['"]react['"]/;
const VUE_STYLE = /(?<![\w-])(?::|v-bind:)style\s*=\s*(["'])/g;

const TYPE_DECLARATION =
  /\b(?:interface\s+[\w$]+(?:\s*<[^{}]*>)?(?:\s+extends\s+[^{}]+)?|type\s+[\w$]+(?:\s*<[^=]*>)?\s*=)\s*$/;
const TYPE_VALUE =
  /^\s*(?:number|string|boolean|any|unknown|undefined|null|never|(?:React\.)?CSSProperties\b[^;,}\n]*)\s*(?:[;,}\n|]|$)/;
const DESTRUCTURING = /^\s*(?:=(?![=>])|:\s*[\w${[(]|\)\s*(?:=>|\{|:))/;

/** Index of the "{" that opens the object literal containing `index`, or -1. */
function enclosingOpen(view, index) {
  let depth = 0;
  for (let k = index - 1; k >= 0 && k > index - 4000; k--) {
    const c = view[k];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) return k;
      depth--;
    }
  }
  return -1;
}

/** Index of the "}" matching the "{" at `open`. */
function closeOf(view, open) {
  let depth = 0;
  for (let k = open; k < view.length && k < open + 8000; k++) {
    if (view[k] === '{') depth++;
    else if (view[k] === '}' && --depth === 0) return k;
  }
  return -1;
}

/**
 * True when a `marginLeft:` key is not a style value: a TypeScript interface
 * or type member (`marginLeft: number`), or a destructuring pattern
 * (`const { marginLeft: ml } = props`). Renaming those breaks the code.
 */
function notAStyle(view, keyIndex, afterColon) {
  if (TYPE_VALUE.test(view.slice(afterColon, afterColon + 80))) return true;
  const open = enclosingOpen(view, keyIndex);
  if (open < 0) return false;
  if (TYPE_DECLARATION.test(view.slice(Math.max(0, open - 200), open))) return true;
  const close = closeOf(view, open);
  return close > 0 && DESTRUCTURING.test(view.slice(close + 1, close + 40));
}

function checkObjects(view, offset, native, report) {
  const map = native ? NATIVE : WEB;
  for (const m of view.matchAll(KEY)) {
    const logical = map[m[3]];
    if (!logical) continue;
    const index = m.index + m[1].length + m[2].length;
    if (notAStyle(view, index, m.index + m[0].length)) continue;
    if (directionConditional(view, index, m[3].length + m[2].length)) continue;
    report({
      index: offset + index,
      length: m[3].length,
      message: `"${m[3]}" is physical and will not mirror in RTL; use "${logical}"${native ? ' (React Native)' : ''}.`,
      fix: { text: logical },
    });
  }
  if (native) return;
  for (const m of view.matchAll(VALUE)) {
    const index = m.index + m[0].length - 1 - m[5].length;
    if (directionConditional(view, index, m[5].length + 1)) continue;
    const logical = LOGICAL_VALUE[m[3]][m[5]];
    report({
      index: offset + index,
      length: m[5].length,
      message: `${m[3]}: '${m[5]}' will not mirror in RTL; use '${logical}'.`,
      fix: { text: logical },
    });
  }
}

export const physicalStyle = {
  id: 'jsx/physical-style',
  meta: {
    description:
      'Inline style objects (React, React Native, Solid, Preact, Vue :style) using marginLeft, paddingRight, textAlign: "left"… do not mirror in RTL.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    if (file.kind === 'markup') {
      const src = file.markupView;
      for (const m of src.matchAll(VUE_STYLE)) {
        const start = m.index + m[0].length;
        const end = src.indexOf(m[1], start);
        if (end > start) checkObjects(src.slice(start, end), start, false, report);
      }
      return;
    }
    if (file.kind !== 'script') return;
    const isJsx = file.ext === 'jsx' || file.ext === 'tsx';
    if (!isJsx && !UI_HINT.test(file.text)) return;
    checkObjects(file.scriptView, 0, REACT_NATIVE.test(file.text), report);
  },
};
