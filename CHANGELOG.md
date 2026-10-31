# Changelog

## 0.1.0

First release.

- 18 rules: logical CSS (`css/*`), utility classes for Tailwind, UnoCSS and Bootstrap (`class/*`),
  React and React Native inline styles (`jsx/*`), document and input direction (`html/*`),
  Persian typography (`fa/*`) and Trojan Source bidi controls (`security/*`).
- Safe `--fix` that re-lints between passes. It never fixes centering pairs, safe-area insets or
  bidi characters.
- Formatters: stylish, compact, json, GitHub annotations, SARIF 2.1.0.
- Composite GitHub Action, browser playground, zero dependencies, Node.js 20+.
