# Contributing to rtlint

Thanks for helping RTL users get better software.

## The most useful reports

1. **False positives.** Something was reported, or worse fixed, that was correct. Include the
   snippet, the file name (the extension decides how rtlint reads it) and what you expected.
2. **Missed bugs.** A real RTL or Persian-typography bug that rtlint did not catch.
3. **Wrong fixes.** `--fix` must never change how a page looks in LTR or corrupt text. Any such
   case is treated as a release blocker.

You can reproduce a report in the [playground](https://pouyamsmartcity.github.io/rtlint/playground/)
and paste the snippet into the issue.

## Development

```bash
git clone https://github.com/pouyamsmartcity/rtlint && cd rtlint
npm install          # dev tools only: ESLint, Stylelint and TypeScript for plugin/type tests
npm test             # node:test, including a 1,500-case fuzz test
npm run typecheck
npm run lint:self    # rtlint must pass on its own docs and source
```

The runtime has no dependencies and `src/core.js` must stay browser-safe (no `node:` imports).

## Adding or changing a rule

- Put it in `src/rules/`, register it in `src/rules/index.js`, then run `npm run schema`.
- Precision beats recall. A rule that cries wolf gets disabled, and then it protects nobody.
  If a pattern can be legitimate, report it without a fix, or skip it.
- Fixes must be idempotent, and LTR output must stay identical. The fuzz test checks the first.
- Add tests to `test/rules.test.js` for what is reported, what is fixed and, just as important,
  what is left alone.
- Document it in `docs/rules.md` with an example and its limits.
- Write any non-ASCII control characters as `\uXXXX` escapes; rtlint's own
  `security/bidi-control` rule enforces this.

## Persian, Arabic, Urdu and Hebrew typography

Native speakers who want rule packs for their language are very welcome. Open an issue first
with the mistakes you see most often in real text.
