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

export const physicalStyle = {
  id: 'jsx/physical-style',
  meta: {
    description:
      'Inline style objects (React, React Native, Solid, Preact) using marginLeft, paddingRight, textAlign: "left"… do not mirror in RTL.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    if (file.kind !== 'script') return;
    const isJsx = file.ext === 'jsx' || file.ext === 'tsx';
    if (!isJsx && !UI_HINT.test(file.text)) return;
    const native = REACT_NATIVE.test(file.text);
    const map = native ? NATIVE : WEB;
    const view = file.scriptView;
    for (const m of view.matchAll(KEY)) {
      const logical = map[m[3]];
      if (!logical) continue;
      const index = m.index + m[1].length + m[2].length;
      report({
        index,
        length: m[3].length,
        message: `"${m[3]}" is physical and will not mirror in RTL; use "${logical}"${native ? ' (React Native)' : ''}.`,
        fix: { text: logical },
      });
    }
    if (native) return;
    for (const m of view.matchAll(VALUE)) {
      const index = m.index + m[0].length - 1 - m[5].length;
      const logical = LOGICAL_VALUE[m[3]][m[5]];
      report({
        index,
        length: m[5].length,
        message: `${m[3]}: '${m[5]}' will not mirror in RTL; use '${logical}'.`,
        fix: { text: logical },
      });
    }
  },
};
