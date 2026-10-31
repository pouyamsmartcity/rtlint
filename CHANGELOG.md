# Changelog

## 0.2.0

- New rules:
  - `fa/zwnj-joined` fixes glued verb prefixes (`میخواهم` → `می‌خواهم`) for known verbs only.
  - `icon/directional` flags back/next icons (Lucide, Heroicons, react-icons, Font Awesome, Bootstrap Icons, Iconify, Material) that do not mirror.
  - `text/presentation-forms` fixes PDF copy-paste glyphs with NFKC, leaving ﷼ and the word ligatures alone.
  - `css/directional-value` (opt-in) reports translate, background-position and transform-origin.
- `fa/zwnj-suffix` also joins the ezafe after a final ه: `خانه ی من` → `خانه‌ی من`.
- ESLint plugin (`rtlint/eslint`, flat config, `--fix` support) and Stylelint plugin (`rtlint/stylelint`).
- TypeScript types and a JSON schema for `rtlint.config.json`.
- `.gitignore` is now read like git does: per directory, with negations and nested repositories. Files named on the command line are always linted.
- A crashing rule is reported as an internal error instead of aborting the run.
- A BOM is ignored for positions and kept when fixing.
- Fewer false positives:
  - Character references in code (`replaceAll('ي', 'ی')`, `/[يك]/`) are skipped.
  - A ZWNJ between letters of different scripts is no longer flagged.
  - `<html>`/`<input>` inside plain JS strings is ignored.
  - Notch safe-area insets, `left-1/2 -translate-x-1/2` and decorative gradients are not reported.
- Pre-release adversarial review, every finding fixed with a regression test (`test/review.test.js`):
  - Fixes no longer touch code that already targets a direction (`[dir=rtl]`, `:dir()`, `.rtl &`, RTLCSS comments, `isRtl ? … : …`), `@page`, `@supports not` fallbacks, Sass maps, nested properties, interpolation, TypeScript types or destructuring.
  - Persian rules read only prose: not URLs, Markdown code, regex literals, single-token code strings, CSV fields or YAML lists. Quoted Arabic, Quran spans, Arabic-looking lines, Sindhi and more Pashto letters are recognised. «تر» meaning "wet" is no longer joined.
  - Directives must start a comment, and their rule ids are parsed case-insensitively.
  - Scanners understand regex literals, apostrophes in JSX text, TypeScript generics on styled-components, arbitrary Tailwind variants, Svelte `class:`/`style:` directives, Vue `:style` and unquoted attributes.
  - The CLI treats existing paths with `[brackets]` as paths, reports when nothing matched, resolves config `ignore` against the config's folder, lets `--rule`/`--persian` win over overrides, validates `--max-warnings`, reads and writes UTF-16 files, emits valid SARIF URIs and prints `output` for `--fix-dry-run -f json`.
  - Adversarial inputs that took up to 37 s now finish in well under a second.
- A 1,500-case fuzz test checks that fixes converge, are idempotent and never crash, plus a performance test on adversarial input.

## 0.1.0

First release.

- 18 rules: logical CSS (`css/*`), utility classes for Tailwind, UnoCSS and Bootstrap (`class/*`),
  React and React Native inline styles (`jsx/*`), document and input direction (`html/*`),
  Persian typography (`fa/*`) and Trojan Source bidi controls (`security/*`).
- Safe `--fix` that re-lints between passes. It never fixes centering pairs, safe-area insets or
  bidi characters.
- Formatters: stylish, compact, json, GitHub annotations, SARIF 2.1.0.
- Composite GitHub Action, browser playground, zero dependencies, Node.js 20+.
