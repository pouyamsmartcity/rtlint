<!-- rtlint-disable-file fa/* text/* -- this guide shows the mistakes on purpose -->

# Persian (Farsi) text in code: ی/ک, half-spaces and digits

Persian UI text often looks right but is wrong underneath, and search, sorting, validation and
screen readers notice. These are the usual problems and how
[rtlint](https://github.com/pouyamsmartcity/rtlint) (by Pouyam) fixes them.

## Arabic yeh and kaf (ي ك instead of ی ک)

Persian typed on an Arabic keyboard layout uses Arabic `ي` (U+064A) and `ك` (U+0643). They look
almost the same as Persian `ی` (U+06CC) and `ک` (U+06A9), but they are different characters, so a
search for «کتاب» never finds «كتاب».

rtlint converts them in Persian text only. Arabic files (`ar.json`), Arabic quotations and Quran
verses keep their spelling.

## Half-space (ZWNJ, نیم‌فاصله)

Persian joins some word parts with a zero-width non-joiner (U+200C) instead of a space:

| Wrong | Right |
| --- | --- |
| `می روم`, `میروم` | می‌روم |
| `کتاب ها` | کتاب‌ها |
| `بزرگ تر` | بزرگ‌تر |
| `خانه ای`, `خانه ی من` | خانه‌ای، خانه‌ی من |

With a space, line breaks can split the word, and search sees two words. Glued prefixes («میروم»)
are fixed only for known verbs, so words like «میز» and «میدان» are safe.

## Digits

Arabic-Indic digits (`٤٥٦`) differ from Persian digits (`۴۵۶`) in shape and code point. Mixed
numbers such as `۱۲3` usually come from copy-paste. Optional rules also convert `%` to `٪`, the
decimal point to `٫` and thousands commas to `٬`.

## Punctuation

Persian uses `،` `؛` `؟` and «guillemets». There is no space before punctuation and one space after it.

## Text copied from PDFs

PDFs often store Arabic-script text as *presentation forms*: pre-shaped glyphs such as `ﻣﻘﺪﻭﻧﯿﻪ`.
They render correctly but are invisible to search. rtlint normalizes them (NFKC) and leaves the
rial sign `﷼` and word ligatures alone.

## In code

Inside JavaScript, Python, Dart and other code, rtlint reads only comments, JSX text and string
literals that contain a space. Character tables such as `replaceAll('ي', 'ی')` are left alone.

```bash
npx @pouyam/rtlint messages/fa.json --lang fa --fix
```
