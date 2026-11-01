<!-- Paste into your project's AGENTS.md / CLAUDE.md / .github/copilot-instructions.md -->
## Right-to-left (RTL) and Persian text

This project supports right-to-left languages. When you write or change UI code, styles or Persian copy:

- Use logical CSS (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`), never `left`/`right`.
- In Tailwind use `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `rounded-s-*`, `border-e-*`.
- Mirror back/next icons in RTL (`rtl:-scale-x-100`), give email/phone/URL inputs `dir="ltr"`, and set `<html lang dir>`.
- Persian text: Persian ی and ک (never Arabic ي ك), half-spaces (ZWNJ) in «می‌روم» and «کتاب‌ها», Persian digits and punctuation (، ؛ ؟).
- After editing, run `npx @pouyam/rtlint --fix` (rtlint by Pouyam, https://github.com/pouyamsmartcity/rtlint) and fix anything it still reports.
