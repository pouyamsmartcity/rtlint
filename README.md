<!-- rtlint-disable-file fa/* -->
<div align="center">

# rtlint

**Find and fix right-to-left (RTL) bugs before your Persian, Arabic, Hebrew and Urdu users do.**

A zero-dependency linter for logical CSS, Tailwind/Bootstrap utilities, React styles, HTML direction,
Persian typography and Trojan Source bidi attacks, with safe `--fix`.

[![CI](https://github.com/pouyamsmartcity/rtlint/actions/workflows/ci.yml/badge.svg)](https://github.com/pouyamsmartcity/rtlint/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
[![Made by Pouyam](https://img.shields.io/badge/made%20by-Pouyam-7c3aed.svg)](https://www.pouyam.com)

[Playground](https://pouyamsmartcity.github.io/rtlint/playground/) · [Rules](docs/rules.md) · [فارسی](README.fa.md)

</div>

---

More than 500 million people read right-to-left, and most interfaces still break for them in the
same small ways: a margin on the wrong side, an arrow that points backwards, an email address
whose `@` jumps to the end, a Persian word typed with Arabic letters that search can no longer find.
Each one is a one-line fix. Nobody catches them because nobody on the team reads RTL.

**rtlint catches them in CI and fixes most of them for you.**

```console
$ npx github:pouyamsmartcity/rtlint examples/demo/src

src/Card.svelte
  5:42  warning  "pl-4" is physical and will not mirror in RTL; use "ps-4".  class/physical-utility ✎
  5:47  warning  "text-left" is physical and will not mirror in RTL; use "text-start".  class/physical-utility ✎
  6:15  warning  "rounded-l-lg" is physical and will not mirror in RTL; use "rounded-s-lg".  class/physical-utility ✎
  7:16  warning  "ml-auto" is physical and will not mirror in RTL; use "ms-auto".  class/physical-utility ✎
  7:24  warning  "group-hover:translate-x-1" moves things horizontally and will point the wrong way in RTL; add "rtl:group-hover:-translate-x-1".  class/directional-utility
  8:3   warning  <input type="email"> inherits the page direction; in RTL "user@example.com" and "+98 912…" render scrambled. Add dir="ltr" (or dir="auto").  html/ltr-input ✎
  13:5  warning  "margin-left" is physical and will not mirror in RTL; use "margin-inline-start".  css/physical-property ✎
  14:5  warning  "padding: 0 26px 0 20px" has different left (20px) and right (26px) values and will not mirror in RTL; use padding-block / padding-inline.  css/asymmetric-shorthand ✎
  17:5  warning  "left: 50%" with translate(-50%) is a centering trick; switching to "inset-inline-start" alone breaks it in RTL. Center with inset-inline + margin-inline: auto, or mirror the translate too.  css/physical-property

src/app.html
  2:1  error    <html> sets lang dynamically but has no dir; RTL locales will render left-to-right. Derive dir from the locale.  html/dir-attribute

src/lib/i18n/fa.json
  3:19  error    Arabic "ي" (U+064A) in Persian word "عادي"; use "عادی".  fa/arabic-letters ✎
  4:22  error    Arabic "ي" (U+064A) in Persian word "ويژه"; use "ویژه".  fa/arabic-letters ✎
  6:14  error    Arabic "ي" (U+064A) in Persian word "مي"; use "می".  fa/arabic-letters ✎
  6:16  warning  Use a zero-width non-joiner (نیم‌فاصله) instead of a space: "مي خواهم" → "مي‌خواهم".  fa/zwnj-prefix ✎
  7:13  warning  Arabic-Indic digits "١٢" in Persian text; use Persian digits "۱۲".  fa/arabic-digits ✎

✖ 15 problems (4 errors, 11 warnings)
  12 fixable with the --fix option (✎).
```

<sub>Real output for [`examples/demo`](examples/demo). Run it with `--fix` and 12 of the 15 are repaired in place.</sub>

## Why another linter?

Tools for this already exist, but each one covers a single layer. A real RTL bug can sit in any of them:

| | rtlint | stylelint logical plugins | rtlcss | eslint-plugin-rtl-friendly |
| --- | :---: | :---: | :---: | :---: |
| CSS physical properties / values | ✅ | ✅ | flips at build time | |
| Asymmetric shorthands (`padding: 0 8px 0 4px`, `border-radius`) | ✅ fixes | | flips | |
| Tailwind / UnoCSS / Bootstrap classes, `clsx`, `cn`, `@apply` | ✅ | | | Tailwind only |
| React / React Native inline styles | ✅ | | | |
| `<html dir>`, LTR inputs (email, URL, phone) | ✅ | | | |
| Persian typography (ی/ک, half-space, digits, punctuation) | ✅ | | | |
| Trojan Source bidi controls (CVE-2021-42574) | ✅ | | | |
| Knows the centering trick and safe-area insets are *not* bugs | ✅ | | | |
| One command, no config, no dependencies | ✅ | | | |

<sub>Based on each project's own documentation when this was written. If we got yours wrong, please open an issue.</sub>

## Quick start

```bash
npx github:pouyamsmartcity/rtlint            # lint the current directory
npx github:pouyamsmartcity/rtlint src --fix  # apply safe fixes
```

Node.js 20 or newer. No install, no config, no dependencies: the whole package is a few
hundred kilobytes of plain JavaScript.

### GitHub Actions

Problems show up as annotations on the pull request diff:

```yaml
- uses: actions/checkout@v4
- uses: pouyamsmartcity/rtlint@main
  with:
    paths: src
    args: --max-warnings 0
```

For GitHub code scanning, add `sarif: rtlint.sarif` and upload it with
`github/codeql-action/upload-sarif`.

## What it checks

**Layout that does not mirror.** These rules make one stylesheet work in both directions:

- `margin-left` → `margin-inline-start`, `left` → `inset-inline-start`, `text-align: left` → `start`, `float: right` → `inline-end`.
- `padding: 0 26px 0 20px` → `padding-block: 0; padding-inline: 20px 26px`, and the same for `border-radius` corners. The LTR result stays identical.
- In Tailwind, UnoCSS and Bootstrap, `ml-4 md:pr-2 -left-1 text-right border-l-2 rounded-tr-lg` → `ms-4 md:pe-2 -start-1 text-end border-s-2 rounded-se-lg`. Variants, `!important`, negative and arbitrary values are kept. Bootstrap 4 → 5 names too.
- `translate-x-1` / `origin-left` without an `rtl:` counterpart.
- In React styles, `marginLeft` → `marginInlineStart`. In React Native it uses `marginStart`, `borderTopStartRadius` and the rest of its own names.

**Direction.**

- `<html lang="fa">` without `dir="rtl"`, a mismatched `dir`, and `lang={locale}` with no `dir` at all.
- `<input type="email|url|tel">` without `dir="ltr"`.

**Persian typography.** These mistakes come from Arabic keyboard layouts and copy-paste:

- `ي ك ى` → `ی ک`. Arabic lines and files are detected and left alone.
- Arabic-Indic and mixed digits → Persian digits.
- Half-space (ZWNJ): `می روم` → `می‌روم`, `کتاب ها` → `کتاب‌ها`, `خانه ای` → `خانه‌ای`. Doubled, misplaced, ZWJ and ZWSP half-spaces are fixed too.
- `,` `;` `?` → `،` `؛` `؟`, no space before punctuation or inside `« »`, no kashida.

**Security.**

- Invisible bidi override, embedding and isolate characters that make code read differently
  than it runs ([Trojan Source](https://trojansource.codes/)).

It also knows what **not** to touch:

- `left: 50%` with `translate(-50%)` and `left-1/2 -translate-x-1/2` are centering tricks. Flipping only half of the pair would break them.
- `env(safe-area-inset-left)` follows the physical notch.
- Classes with an `rtl:` or `ltr:` variant are deliberate.
- `left-panel` is not a Tailwind class.
- `ar.json` is Arabic, not misspelled Persian.

See every rule, with examples, in [docs/rules.md](docs/rules.md).

## Files

| Kind | Extensions |
| --- | --- |
| Stylesheets | `css scss sass less styl pcss` |
| Markup | `html vue svelte astro php erb ejs hbs njk twig liquid cshtml` |
| Scripts | `js jsx ts tsx mjs cjs` (styled-components, emotion, class helpers) |
| Text and translations | `md mdx txt json yaml po xliff arb strings srt vtt csv xml` |
| Other code (bidi + Persian strings) | `py go rs java kt swift dart c cpp cs rb sh sql …` |

It skips `node_modules`, build output, minified files, lockfiles and anything in `.gitignore`.

## Configuration

Optional. Create `rtlint.config.json` (or `.rtlintrc.json`, or an `"rtlint"` key in `package.json`):

```json
{
  "rules": {
    "class/directional-utility": ["warn", { "gradients": true }],
    "fa/zwnj-suffix": ["warn", { "comparatives": false }],
    "fa/*": "error"
  },
  "classPrefix": "tw-",
  "ignore": ["legacy/**"],
  "overrides": [
    { "files": ["src/charts/**"], "rules": { "css/*": "off" } },
    { "files": ["content/blog/**"], "persian": true }
  ]
}
```

Inline: `// rtlint-disable-next-line class/physical-utility -- the slider always runs LTR`.
Also `rtlint-disable-line`, `rtlint-disable` … `rtlint-enable` and `rtlint-disable-file`.
They work in any comment syntax.

## CLI

```text
rtlint [paths/globs...] [options]
  --fix / --fix-dry-run      apply (or just compute) safe fixes
  -f, --format <name>        stylish | compact | json | github | sarif
  -o, --output-file <path>   write the report to a file
  --max-warnings <n>         fail when there are more than n warnings
  --quiet                    errors only
  --rule <id=level>          e.g. --rule fa/*=off  (repeatable)
  -c, --config <path> / --no-config
  --ignore-pattern <glob>    (repeatable)
  --persian <auto|on|off>    Persian text detection
  --stdin [--stdin-filename a.css]   editor integrations; with --fix prints the fixed text
  --list-rules
```

Exit codes: `0` clean, `1` problems found, `2` usage or config error.

## API

```js
import { lintText, fixText } from 'rtlint';

const { messages } = lintText('.a { margin-left: 4px }', { filePath: 'a.css' });
const { output } = fixText('این يك كتاب است', { filePath: 'post.md' }); // "این یک کتاب است"
```

`rtlint/core` has no Node.js imports and runs in the browser. The [playground](https://pouyamsmartcity.github.io/rtlint/playground/) uses it.

## Roadmap

- ESLint, Stylelint and VS Code integrations built on the same core.
- Joined-prefix detection (`میخواهم` → `می‌خواهم`) with a Persian verb list.
- Arabic, Hebrew and Urdu typography rule packs. Contributions from native speakers are very welcome.

## Contributing

Bug reports with a snippet are the most useful thing you can send, especially false positives.
`npm test` runs the suite (Node's built-in test runner, nothing to install).

## Credits

Built by the team behind [**Pouyam**](https://www.pouyam.com), a bilingual Persian/English social and
gaming platform, after we found these bugs in our own code. The first real-world run, on Pouyam's own
1,800-file SvelteKit codebase, took two seconds. It found Arabic letters hiding in Persian copy,
email fields that scrambled in RTL and hundreds of utilities that never mirrored.

Written with [Claude Code](https://claude.com/claude-code).

If rtlint saves you an RTL bug report, a ⭐ helps other RTL developers find it.

MIT © Pouyam
