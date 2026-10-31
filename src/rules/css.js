import { blockAt, leaveAlone } from './css-context.js';
import { escapeRe, splitCssValue } from './util.js';

const PHYSICAL = {
  'margin-left': 'margin-inline-start',
  'margin-right': 'margin-inline-end',
  'padding-left': 'padding-inline-start',
  'padding-right': 'padding-inline-end',
  'border-left': 'border-inline-start',
  'border-right': 'border-inline-end',
  'border-left-width': 'border-inline-start-width',
  'border-right-width': 'border-inline-end-width',
  'border-left-style': 'border-inline-start-style',
  'border-right-style': 'border-inline-end-style',
  'border-left-color': 'border-inline-start-color',
  'border-right-color': 'border-inline-end-color',
  'border-top-left-radius': 'border-start-start-radius',
  'border-top-right-radius': 'border-start-end-radius',
  'border-bottom-left-radius': 'border-end-start-radius',
  'border-bottom-right-radius': 'border-end-end-radius',
  'scroll-margin-left': 'scroll-margin-inline-start',
  'scroll-margin-right': 'scroll-margin-inline-end',
  'scroll-padding-left': 'scroll-padding-inline-start',
  'scroll-padding-right': 'scroll-padding-inline-end',
  left: 'inset-inline-start',
  right: 'inset-inline-end',
};

const NAMES = Object.keys(PHYSICAL)
  .sort((a, b) => b.length - a.length)
  .map(escapeRe)
  .join('|');
const PHYSICAL_DECL = new RegExp(`(^|[\\s{;])(${NAMES})(\\s*:)([^;{}\\n]*)`, 'g');

const SAFE_AREA = /safe-area-inset-(?:left|right)/;

const CENTER_TRANSLATE = /translate(?:X|3d)?\(\s*-50%|translate\s*:\s*-50%/i;

/** True when `left: 50%` is paired with a -50% translate in the same block (checked once per block). */
function isCentering(file, index, value) {
  if (!/^(?:50%|calc\(\s*50%)/.test(value.trim())) return false;
  const block = blockAt(file, index);
  const key = block ? block.open : -1;
  file._centering ??= new Map();
  if (!file._centering.has(key)) {
    const view = file.cssView;
    const text = block ? view.slice(block.open, block.close) : view;
    file._centering.set(key, CENTER_TRANSLATE.test(text));
  }
  return file._centering.get(key);
}

const SVELTE_STYLE_DIRECTIVE = new RegExp(`(?<![\\w-])style:(${NAMES})(?=[\\s=>/|])`, 'g');

export const physicalProperty = {
  id: 'css/physical-property',
  meta: {
    description: 'Physical left/right properties do not mirror in RTL; use logical properties.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    const view = file.cssView;
    for (const m of view.matchAll(PHYSICAL_DECL)) {
      const index = m.index + m[1].length;
      const name = m[2];
      const logical = PHYSICAL[name];
      // Notch/home-indicator insets are physical by nature; they must not flip.
      if (SAFE_AREA.test(m[4]) || leaveAlone(file, index)) continue;
      if ((name === 'left' || name === 'right') && isCentering(file, index, m[4])) {
        report({
          index,
          length: name.length,
          message: `"${name}: ${m[4].trim()}" with translate(-50%) is a centering trick; switching to "${logical}" alone breaks it in RTL. Center with inset-inline + margin-inline: auto, or mirror the translate too.`,
          fa: `«${name}: ${m[4].trim()}» همراه translate(-50%) یک ترفند وسط\u200Cچین است؛ اگر فقط آن را به «${logical}» تغییر دهید، در راست\u200Cبه\u200Cچپ از وسط خارج می\u200Cشود. با inset-inline و margin-inline: auto وسط\u200Cچین کنید، یا translate را هم آینه کنید.`,
        });
        continue;
      }
      report({
        index,
        length: name.length,
        message: `"${name}" is physical and will not mirror in RTL; use "${logical}".`,
        fa: `«${name}» فیزیکی است و در صفحه\u200Cی راست\u200Cبه\u200Cچپ برعکس نمی\u200Cشود؛ «${logical}» بنویسید.`,
        fix: { text: logical },
      });
    }
    if (file.ext === 'svelte') {
      for (const m of file.markupView.matchAll(SVELTE_STYLE_DIRECTIVE)) {
        const index = m.index + 6;
        report({
          index,
          length: m[1].length,
          message: `"style:${m[1]}" is physical and will not mirror in RTL; use "style:${PHYSICAL[m[1]]}".`,
          fa: `«style:${m[1]}» فیزیکی است و در راست\u200Cبه\u200Cچپ برعکس نمی\u200Cشود؛ «style:${PHYSICAL[m[1]]}» بنویسید.`,
          fix: { text: PHYSICAL[m[1]] },
        });
      }
    }
  },
};

const VALUE_DECL =
  /(^|[\s{;])(text-align|text-align-last|float|clear)(\s*:\s*)(left|right)(?=\s*(?:!important\s*)?(?:;|}|\n|$))/g;

const LOGICAL_VALUE = {
  'text-align': { left: 'start', right: 'end' },
  'text-align-last': { left: 'start', right: 'end' },
  float: { left: 'inline-start', right: 'inline-end' },
  clear: { left: 'inline-start', right: 'inline-end' },
};

export const physicalValue = {
  id: 'css/physical-value',
  meta: {
    description: 'text-align, float and clear with left/right do not mirror in RTL; use start/end.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    for (const m of file.cssView.matchAll(VALUE_DECL)) {
      if (leaveAlone(file, m.index + m[1].length)) continue;
      const index = m.index + m[1].length + m[2].length + m[3].length;
      const logical = LOGICAL_VALUE[m[2]][m[4]];
      report({
        index,
        length: m[4].length,
        message: `"${m[2]}: ${m[4]}" will not mirror in RTL; use "${m[2]}: ${logical}".`,
        fa: `«${m[2]}: ${m[4]}» در راست\u200Cبه\u200Cچپ برعکس نمی\u200Cشود؛ «${m[2]}: ${logical}» بنویسید.`,
        fix: { text: logical },
      });
    }
  },
};

const BOX = {
  margin: ['margin-block', 'margin-inline'],
  padding: ['padding-block', 'padding-inline'],
  inset: ['inset-block', 'inset-inline'],
  'scroll-margin': ['scroll-margin-block', 'scroll-margin-inline'],
  'scroll-padding': ['scroll-padding-block', 'scroll-padding-inline'],
  'border-width': ['border-block-width', 'border-inline-width'],
  'border-style': ['border-block-style', 'border-inline-style'],
  'border-color': ['border-block-color', 'border-inline-color'],
};

const SHORTHAND_DECL =
  /(^|[\s{;])(margin|padding|inset|scroll-margin|scroll-padding|border-width|border-style|border-color|border-radius)(\s*:\s*)([^;{}\n]+)/g;

const INDENTED = new Set(['sass', 'styl', 'stylus']);

/** Expands 1-4 border-radius values to [top-left, top-right, bottom-right, bottom-left]. */
function radiusCorners(v) {
  if (v.length === 1) return [v[0], v[0], v[0], v[0]];
  if (v.length === 2) return [v[0], v[1], v[0], v[1]];
  if (v.length === 3) return [v[0], v[1], v[2], v[1]];
  return v;
}

export const asymmetricShorthand = {
  id: 'css/asymmetric-shorthand',
  meta: {
    description:
      'A margin/padding/inset/border/radius shorthand with different left and right values will not mirror in RTL.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    const view = file.cssView;
    const indented = file.css.indented ?? [];
    for (const m of view.matchAll(SHORTHAND_DECL)) {
      const prop = m[2];
      const declStart = m.index + m[1].length;
      if (leaveAlone(file, declStart)) continue;
      // Sass/Less interpolation (#{$x}, @{x}) is cut short by the value pattern; skip it.
      const after = view[m.index + m[0].length];
      if (after === '{' || /[#@]$/.test(m[4].trimEnd()) || /[#@]\{/.test(m[4])) continue;
      const raw = m[4].replace(/\s+$/, '');
      const inIndented = indented.some(([s, e]) => declStart >= s && declStart < e);
      // A fix rewrites the raw text, so a comment inside the value would be lost.
      const rawText = file.text.slice(declStart, declStart + m[2].length + m[3].length + raw.length);
      const canFix = !INDENTED.has(file.ext) && !inIndented && !rawText.includes('/*');
      const important = /\s*!important$/i.test(raw) ? ' !important' : '';
      const value = raw.replace(/\s*!important$/i, '').replace(/\s+/g, ' ');
      if (/[,/]/.test(value.replace(/\([^)]*\)/g, ''))) continue;
      if (SAFE_AREA.test(value)) continue;
      const parts = splitCssValue(value);
      const index = declStart;
      const length = m[2].length + m[3].length + raw.length;

      if (prop === 'border-radius') {
        if (parts.length < 2 || parts.length > 4) continue;
        const [tl, tr, br, bl] = radiusCorners(parts);
        if (tl === tr && bl === br) continue;
        const hidden = parts.length < 4 && parts.some((p) => p.startsWith('var('));
        report({
          index,
          length,
          message: `"border-radius: ${value}" rounds left and right corners differently and will not mirror in RTL; use the logical corner properties.`,
          fa: `«border-radius: ${value}» گوشه\u200Cهای چپ و راست را متفاوت گرد می\u200Cکند و در راست\u200Cبه\u200Cچپ برعکس نمی\u200Cشود؛ از ویژگی\u200Cهای منطقی گوشه\u200Cها استفاده کنید.`,
          fix:
            canFix && !hidden
              ? {
                  text:
                    `border-start-start-radius: ${tl}${important}; border-start-end-radius: ${tr}${important}; ` +
                    `border-end-end-radius: ${br}${important}; border-end-start-radius: ${bl}${important}`,
                }
              : undefined,
        });
        continue;
      }

      if (parts.length !== 4 || parts[1] === parts[3]) continue;
      const [top, right, bottom, left] = parts;
      const [block, inline] = BOX[prop];
      const blockValue = top === bottom ? top : `${top} ${bottom}`;
      report({
        index,
        length,
        message: `"${prop}: ${value}" has different left (${left}) and right (${right}) values and will not mirror in RTL; use ${block} / ${inline}.`,
        fa: `«${prop}: ${value}» برای چپ (${left}) و راست (${right}) مقدار متفاوت دارد و در راست\u200Cبه\u200Cچپ برعکس نمی\u200Cشود؛ ${block} و ${inline} بنویسید.`,
        fix: canFix
          ? { text: `${block}: ${blockValue}${important}; ${inline}: ${left} ${right}${important}` }
          : undefined,
      });
    }
  },
};

const DIRECTIONAL_DECL =
  /(^|[\s{;])(transform|translate|background-position|background-position-x|transform-origin)(\s*:\s*)([^;{}\n]+)/g;

/** The horizontal part of a value that would need mirroring, or null. */
function directionalPart(prop, value) {
  if (prop === 'transform') {
    const m = value.match(/translate(?:X|3d)?\(\s*(-?[\d.]+[a-z%]*)/i);
    if (m && parseFloat(m[1]) !== 0 && !/^-50%$/.test(m[1])) return m[0] + '…)';
    return null;
  }
  if (prop === 'translate') {
    const x = value.trim().split(/\s+/)[0];
    return parseFloat(x) !== 0 && !Number.isNaN(parseFloat(x)) && x !== '-50%' ? x : null;
  }
  const side = value.match(/\b(left|right)\b/);
  return side ? side[1] : null;
}

export const directionalValue = {
  id: 'css/directional-value',
  meta: {
    description:
      'Opt-in: horizontal translate, background-position and transform-origin values point one way on screen and usually need an RTL counterpart.',
    fixable: false,
    level: 'off',
  },
  check(file, report) {
    const view = file.cssView;
    for (const m of view.matchAll(DIRECTIONAL_DECL)) {
      const part = directionalPart(m[2], m[4]);
      if (!part) continue;
      if (leaveAlone(file, m.index + m[1].length)) continue;
      report({
        index: m.index + m[1].length,
        length: m[2].length + m[3].length + m[4].trimEnd().length,
        message: `"${m[2]}: ${m[4].trim()}" moves or anchors things horizontally (${part}); add a [dir="rtl"] counterpart if it should follow the reading direction.`,
        fa: `«${m[2]}: ${m[4].trim()}» چیزی را افقی جابه\u200Cجا یا لنگر می\u200Cکند (${part})؛ اگر باید با جهت متن عوض شود، یک نسخه\u200Cی [dir="rtl"] هم بنویسید.`,
      });
    }
  },
};
