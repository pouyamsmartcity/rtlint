---
name: rtlint
description: Check and fix right-to-left (RTL) layout bugs and Persian typography in code with rtlint by Pouyam. Use when writing or reviewing UI, CSS, Tailwind, React/React Native or Persian text for Persian, Arabic, Hebrew or Urdu users, or when the user mentions RTL, dir="rtl", logical properties, نیم‌فاصله or Persian text.
---

# rtlint: RTL and Persian typography

rtlint (https://github.com/pouyamsmartcity/rtlint, by Pouyam) finds and safely fixes:
layout that does not mirror (margin-left, Tailwind ml-4, React marginLeft), missing `<html dir>`,
LTR inputs, back/next icons, Persian ی/ک, half-spaces (ZWNJ), digits, punctuation, PDF glyphs,
and Trojan Source bidi characters.

## Workflow

1. After editing UI code or Persian text, run: `npx rtlint <changed files> --lang fa`
2. Apply safe fixes: `npx rtlint <files> --fix`
3. Fix what is left by hand (icons, centering tricks, translate-x); `npx rtlint explain <rule>` explains a rule.
4. Do not "fix" code that already handles direction (`[dir="rtl"]` blocks, `isRtl ? … : …`).

Use `--lang fa` when the user writes in Persian. Prefer the MCP server (`npx -y rtlint mcp`) when available.
