<!-- rtlint-disable-file fa/* text/* -->
# Rules

Every rule can be set to `"off"`, `"warn"` or `"error"`, alone or as `["warn", { …options }]`.
Wildcards work: `"fa/*": "off"`. ✎ means `rtlint --fix` can repair it. [راهنمای فارسی قانون‌ها](rules.fa.md)

| Rule | Default | Fix |
| --- | --- | --- |
| [`css/physical-property`](#cssphysical-property) | warn | ✎ |
| [`css/physical-value`](#cssphysical-value) | warn | ✎ |
| [`css/asymmetric-shorthand`](#cssasymmetric-shorthand) | warn | ✎ |
| [`css/directional-value`](#cssdirectional-value) | off (opt-in) | |
| [`class/physical-utility`](#classphysical-utility) | warn | ✎ |
| [`class/directional-utility`](#classdirectional-utility) | warn | |
| [`jsx/physical-style`](#jsxphysical-style) | warn | ✎ |
| [`html/dir-attribute`](#htmldir-attribute) | error | ✎ |
| [`html/ltr-input`](#htmlltr-input) | warn | ✎ |
| [`icon/directional`](#icondirectional) | warn | |
| [`fa/arabic-letters`](#faarabic-letters) | error | ✎ |
| [`fa/arabic-digits`](#faarabic-digits) | warn | ✎ |
| [`fa/mixed-digits`](#famixed-digits) | warn | ✎ |
| [`fa/zwnj-prefix`](#fazwnj-prefix) | warn | ✎ |
| [`fa/zwnj-joined`](#fazwnj-joined) | warn | ✎ |
| [`fa/zwnj-suffix`](#fazwnj-suffix) | warn | ✎ |
| [`fa/zwnj-invalid`](#fazwnj-invalid) | warn | ✎ |
| [`fa/punctuation`](#fapunctuation) | warn | ✎ |
| [`fa/punctuation-spacing`](#fapunctuation-spacing) | warn | ✎ |
| [`fa/kashida`](#fakashida) | warn | ✎ |
| [`text/presentation-forms`](#textpresentation-forms) | error | ✎ |
| [`security/bidi-control`](#securitybidi-control) | error | |
| [`css/physical-transition`](#cssphysical-transition) | warn | ✎ |
| [`css/arabic-letter-spacing`](#cssarabic-letter-spacing) | error |  |
| [`css/direction-property`](#cssdirection-property) | off (opt-in) |  |
| [`class/space-reverse`](#classspace-reverse) | off (opt-in) | ✎ |
| [`html/missing-lang`](#htmlmissing-lang) | warn |  |
| [`html/user-content-dir`](#htmluser-content-dir) | off (opt-in) | ✎ |
| [`fa/space-after-punctuation`](#faspace-after-punctuation) | warn | ✎ |
| [`fa/double-space`](#fadouble-space) | warn | ✎ |
| [`fa/arrow-direction`](#faarrow-direction) | warn | ✎ |
| [`fa/ellipsis`](#faellipsis) | off (opt-in) | ✎ |
| [`fa/percent-sign`](#fapercent-sign) | off (opt-in) | ✎ |
| [`fa/decimal-separator`](#fadecimal-separator) | off (opt-in) | ✎ |
| [`fa/thousands-separator`](#fathousands-separator) | off (opt-in) | ✎ |
| [`fa/latin-digits`](#falatin-digits) | off (opt-in) | ✎ |
| [`fa/guillemets`](#faguillemets) | off (opt-in) | ✎ |
| [`text/invisible-characters`](#textinvisible-characters) | warn | ✎ |

---

## css/physical-property

`margin-left`, `padding-right`, `border-left`, `border-top-left-radius`, `left`, `right`,
`scroll-margin-left` … are tied to the screen, not to the reading direction, so an RTL page
keeps its spacing on the wrong side. Logical properties flip automatically.

```css
.card { margin-left: 8px; border-top-right-radius: 4px; }          /* before */
.card { margin-inline-start: 8px; border-start-end-radius: 4px; }  /* after  */
```

Found in stylesheets (`.css .scss .sass .less .styl`), `<style>` blocks, `style=""` attributes
and styled-components / emotion templates.

Not reported, because converting them would be wrong:

- **Code that already targets a direction.** Declarations inside `[dir="rtl"] …`, `:dir(rtl)`, `.rtl &`,
  `@include rtl`, `:lang(…)` or after an RTLCSS `/* rtl:ignore */` (or between `rtl:begin:ignore` and
  `rtl:end:ignore`) keep their physical sides. They already are the RTL version.
- **`@page` margins** (they have no logical form) and **`@supports not (…)` fallbacks**.
- **Sass maps and nested properties**: `(left: 10px)` and `margin: { left: 4px }`.
- **Safe-area insets.** `padding-left: env(safe-area-inset-left)` follows the physical notch and must stay physical.
- **The centering trick.** `left: 50%` with `transform: translate(-50%)` is reported *without a fix*:
  turning only `left` into `inset-inline-start` would push the element off-center in RTL.

## css/physical-value

`text-align: left|right` → `start|end`, `float` and `clear: left|right` → `inline-start|inline-end`.
`float: inline-start` needs Chrome 118+, Safari 15+, Firefox 55+.

## css/asymmetric-shorthand

A four-value shorthand whose left and right differ cannot mirror. rtlint rewrites it into
block/inline pairs that keep the LTR result identical:

```css
padding: 0 26px 0 20px;              /* before */
padding-block: 0; padding-inline: 20px 26px;   /* after */

border-radius: 8px 0 0 8px;          /* before */
border-start-start-radius: 8px; border-start-end-radius: 0;
border-end-end-radius: 0; border-end-start-radius: 8px;   /* after */
```

Covers `margin`, `padding`, `inset`, `scroll-margin`, `scroll-padding`, `border-width`,
`border-style`, `border-color` and `border-radius` (not the `/` elliptical form). It reports without
fixing in `.sass`/`.styl` files and `<style lang="sass">` blocks (the fix needs semicolons) and when a
comment sits inside the value. Values with Sass/Less interpolation (`#{$x}`, `@{x}`) are skipped.

## css/directional-value

Opt-in (`"css/directional-value": "warn"`). Reports `transform: translateX(20px)`, `translate: 1rem`,
`background-position: left …` and `transform-origin: right` outside a `[dir]` selector: slide-ins and
anchors that point one way on screen. Report-only, because the right counterpart depends on intent.
`translate(-50%)` is skipped (it belongs to the centering trick).

## class/physical-utility

Utility classes in `class`, `className`, `:class`, `class:list`, `[ngClass]`, in `clsx()` / `cn()` /
`cva()` / `twMerge()` / `tv()` calls, in `` tw`…` `` and in `@apply`.

| Physical | Logical |
| --- | --- |
| `ml-4` `mr-4` `pl-4` `pr-4` | `ms-4` `me-4` `ps-4` `pe-4` |
| `left-0` `right-0` | `start-0` `end-0` |
| `text-left` `text-right` | `text-start` `text-end` |
| `float-left` `clear-right` | `float-start` `clear-end` |
| `border-l-2` `border-r` | `border-s-2` `border-e` |
| `rounded-l-lg` `rounded-tr` | `rounded-s-lg` `rounded-se` |
| `scroll-ml-2` | `scroll-ms-2` |
| Bootstrap 4: `ml-md-3` `border-left` `rounded-right` `dropdown-menu-right` `dropleft` | Bootstrap 5: `ms-md-3` `border-start` `rounded-end` `dropdown-menu-end` `dropstart` |

Variants (including arbitrary ones such as `[&>svg]:`), `!important`, negative values, arbitrary
values, Tailwind v4 `ml-(--gap)` and fractions are kept: `md:hover:!-ml-[3px]` → `md:hover:!-ms-[3px]`.
Svelte `class:ml-2={x}` and expressions inside attributes (`class="a {x ? "pl-2" : ""}"`) are covered.
Classes with an `rtl:` or `ltr:` variant are intentional and left alone, and so are classes chosen
by a direction check (`isRtl ? 'mr-2' : 'ml-2'`, `{ 'ml-2': !isRtl }`). CSS Modules lookups
(`styles["text-left"]`) are not class lists. Names that only look like utilities (`left-panel`) are ignored.
`left-1/2` next to a `translate-x` is a centering pair and is reported without a fix.

Requires Tailwind CSS 3.3+ (`float-start` / `clear-start`: 3.4+) or Bootstrap 5.
Config: `"classes": false` turns class checks off; `"classPrefix": "tw-"` for a Tailwind prefix.

## class/directional-utility

`translate-x-*` and `origin-left` move things one way on screen. Unless the same class list
already has an `rtl:` variant of it, rtlint suggests the mirrored class:
`group-hover:translate-x-1` → add `rtl:group-hover:-translate-x-1`.

Option: `{ "gradients": true }` also checks `bg-gradient-to-r` / `bg-linear-to-l`.
Off by default, because most gradients are decorative.

## jsx/physical-style

Inline style objects in `.jsx` / `.tsx` and in `.js` / `.ts` files that use React, `style={{…}}`,
`StyleSheet.create` or styled:

```jsx
<div style={{ marginLeft: 8, textAlign: 'left' }} />              // before
<div style={{ marginInlineStart: 8, textAlign: 'start' }} />       // after
```

In files that import `react-native` it uses React Native's own vocabulary
(`marginStart`, `paddingEnd`, `borderTopStartRadius` …). Vue `:style="{ … }"` bindings are checked too.

Left alone: TypeScript interface/type members (`marginLeft: number`), destructuring
(`const { marginLeft: ml } = props`), and values that already depend on direction
(`marginLeft: isRTL ? 0 : 8`, `I18nManager.isRTL ? {…} : {…}`).

## html/dir-attribute

`<html lang="fa">` without `dir="rtl"` renders left-to-right. Also flags `dir="ltr"` on an RTL
language, `dir="rtl"` on an LTR one, and a dynamic `lang={locale}` with no `dir` at all (common in
Next.js and SvelteKit layouts). Knows RTL languages and script subtags (`ku-Arab`, `az-Latn`).

## html/ltr-input

`<input type="email|url|tel">` inherits `dir="rtl"`: `user@example.com` and `+98 912 …` render
with their punctuation moved to the wrong end. Adds `dir="ltr"` (or keep your own `dir="auto"`).

## icon/directional

Back/next icons point one way on screen; in RTL "next" must point left. Reports:

- components such as `<ChevronRight>`, `<ArrowLeftIcon>`, `<FiChevronRight>`, `<MdArrowForward>`, `<IoChevronBack>`,
- classes such as `fa-chevron-right`, `bi-arrow-left`, `i-lucide-chevron-right`,
- `icon="lucide:arrow-right"` / `name="chevron-left"` attributes (Iconify, Ionicons…),
- Material ligatures such as `arrow_forward` and `chevron_right`.

Up/down and diagonal arrows (the external-link ↗) are not reported, and neither is an icon whose tag
already mentions `rtl`, `flip`, `mirror`, `scale-x`, `rotate-180` or `dir`, or that is chosen by a
direction ternary (`isRtl ? <ChevronLeft/> : <ChevronRight/>`). Mirror with `class="rtl:-scale-x-100"`
or `[dir="rtl"] .icon { transform: scaleX(-1) }`.

## fa/arabic-letters

Persian typed on an Arabic keyboard layout uses `ي` (U+064A), `ك` (U+0643) and `ى` (U+0649)
instead of `ی` (U+06CC) and `ک` (U+06A9). They look almost the same, but search, sorting,
deduplication and some fonts treat them as different letters.

**Only Persian is touched.** A line counts as Persian when it has a Persian-only letter
(`پ چ ژ گ ی ک`, Persian digits) and none of the letters that identify Arabic (`ة`), Urdu, Kurdish,
Pashto or Uyghur. Lines without a decisive letter follow the file: a path like `locales/fa.json`
or `fa-IR/` is Persian, `ar.json` or `/ur/` is not, otherwise the file's own letters decide.
Force it with `"persian": true | false` globally or in an override.

**What counts as text.** In JS/TS and other code, the Persian rules read comments, JSX text and
string literals that contain a space; single-token strings such as `'ي'` or `'٠١٢٣٤٥٦٧٨٩'` (character
tables in normalisers, keys) and regex literals are skipped. URLs and Markdown code spans/fences are
never touched. Quoted Arabic inside a Persian line (`«إن الله على كل شيء قدير»`, `﴿…﴾` Quran spans) and
Arabic-looking lines in a Persian file (`بسم الله الرحمن الرحيم`) keep their spelling. Pashto text with
none of its distinctive letters cannot be told apart from Persian; mark such files with an override.

## fa/arabic-digits

Arabic-Indic digits `٠١٢٣٤٥٦٧٨٩` in Persian text → Persian digits `۰۱۲۳۴۵۶۷۸۹` (4, 5 and 6 have different shapes).

## fa/mixed-digits

A single number written with two digit systems, e.g. `۱۲3`. Converted to Persian digits.

## fa/zwnj-prefix

The prefixes `می` / `نمی` attach to the verb with a zero-width non-joiner (نیم‌فاصله, U+200C):
`می روم` → `می‌روم`. Skipped before function words (`و`, `که`, `را`, `از` …).

## fa/zwnj-joined

The same prefix written glued to the verb: `میخواهم` → `می‌خواهم`, `نمیتوانم` → `نمی‌توانم`, `میرفت` → `می‌رفت`.
Only reported when the rest of the word is a known verb stem plus a personal ending, so nouns that
start with می (میز، میدان، میوه، میلیون، میهمانی) are never touched. `میدانی` is skipped because it is also
the adjective "field" (راهنمای میدانی).

## fa/zwnj-suffix

`کتاب ها` → `کتاب‌ها`, `بزرگ تر` → `بزرگ‌تر`, and after a final ه: `خانه ای` → `خانه‌ای`,
`رفته اند` → `رفته‌اند`, and the ezafe `خانه ی من` → `خانه‌ی من`. Two-letter words (`که`, `چه`, `نه`, `به`) are never joined.
`ترین` is always joined. `تر` also means "wet" (میوه تر، لباس تر), so by default it is only joined after
common adjectives (`بزرگ تر`, `کم تر`, `سریع تر` …). Option `{ "comparatives": "all" }` joins it after any
word; `false` skips both.

## fa/zwnj-invalid

Doubled ZWNJ, a ZWNJ next to a space or outside a word (it does nothing there), and a ZWJ
(U+200D) or zero-width space (U+200B) used where a ZWNJ was meant.

## fa/punctuation

Latin `,` `;` `?` between Persian words → `،` `؛` `؟` (a stray space before them is removed too). Only
when Persian is on both sides, so `words like سلام, which` and code such as `t('سلام', …)` are left
alone. Commas are never touched in CSV/TSV files or in YAML/TOML flow lists (`tags: [کتاب, رمان]`,
also in Markdown front matter).

## fa/punctuation-spacing

No space before `، ؛ ؟ ! .` and none just inside `« »`.

## fa/kashida

Tatweel (ـ, U+0640) stretches words on screen but breaks search and copy-paste.
Use `text-align: justify` for justification.

## text/presentation-forms

Text copied from PDFs and old software often arrives as Arabic *presentation forms*: pre-shaped
glyph codes (U+FB50–U+FDFF, U+FE70–U+FEFC) such as `ﻣﻘﺪﻭﻧﯿﻪ`. It looks right, but search, sorting,
spell-checkers and screen readers see different characters. Fixed with Unicode NFKC normalisation
(`ﻣﻘﺪﻭﻧﯿﻪ` → `مقدونیه`, `ﻻ` → `لا`). Applies to Persian, Arabic, Urdu and every other Arabic-script text.

The word ligatures U+FDF2–U+FDFF (ﷲ, the rial sign ﷼, salawat), the ornate Quran brackets ﴾﴿ and the
honorifics U+FD40–U+FD4F are left alone. Isolated harakat forms become the bare mark (no stray
space or tatweel). Code files are skipped
by default, because canvas and game code sometimes pre-shapes text on purpose; enable with
`["error", { "code": true }]`.

## security/bidi-control

Invisible bidirectional control characters (U+202A–U+202E, U+2066–U+2069) can make code
display differently from how it runs: the
[Trojan Source](https://trojansource.codes/) attack, CVE-2021-42574.

- In code and stylesheets every such character is reported.
- `<script>` and `<style>` blocks of `.vue`, `.svelte` and `.html` files count as code.
- In text, markup and translation files, where RTL text may use them on purpose, only the risky
  ones are: overrides (U+202D, U+202E) and embeddings/isolates left unclosed on their line,
  whose direction leaks into whatever is rendered next.

Not auto-fixed: a human should look at each one.

## css/physical-transition

`transition` and `will-change` name properties. Once `margin-left` becomes `margin-inline-start`,
`transition: margin-left 0.2s` no longer animates anything. This rule renames them too:
`transition: margin-left 0.2s` → `transition: margin-inline-start 0.2s`.

## css/arabic-letter-spacing

`letter-spacing` pulls joined Arabic-script letters apart, so «سلام» turns into separate shapes.
Reported in blocks that target RTL or Persian/Arabic text (`:lang(fa)`, `[lang="ar"]`, `[dir="rtl"]`,
`:dir(rtl)`, `.rtl`, `.fa`, `.persian`) and for Tailwind `rtl:tracking-*`. `letter-spacing: normal` and `0` are fine.

## css/direction-property

Opt-in. `direction: rtl` in CSS sets the visual direction, but the HTML `dir` attribute is what
screen readers, form submission and the bidi algorithm rely on. Phone, email, URL and code fields
(`input[type=tel] { direction: ltr }`) are not reported.

## class/space-reverse

Opt-in, for Tailwind 3 and earlier, where `space-x-*` and `divide-x-*` use physical margins and borders.
Adds `rtl:space-x-reverse` / `rtl:divide-x-reverse`. Tailwind 4 made them logical; leave this off there.
`rtlint init` turns it on when it detects Tailwind 3.

## html/missing-lang

`<html>` without `lang`: browsers pick the wrong fonts and hyphenation, screen readers the wrong
voice, and rtlint cannot check `dir`. Not auto-fixed, because only you know the language.

## html/user-content-dir

Opt-in. Text inputs, search boxes, textareas and `contenteditable` areas where people type in any
language should have `dir="auto"`, so a Persian comment reads right to left and an English one left
to right, whatever the page direction. The fix adds `dir="auto"`.

## fa/space-after-punctuation

«سلام،دنیا» → «سلام، دنیا». One space after ، ؛ ؟ ! when a Persian word follows. Numbers such as ۱۲،۵ are not touched.

## fa/double-space

Two or more spaces between Persian words become one. Code indentation is never touched.

## fa/arrow-direction

Persian reads right to left, so «ادامه →» points backwards and «ادامه ←» points forward. `→` in
Persian text becomes `←`. Arrows between two Latin/code tokens (`margin-left → margin-inline-start`)
are left alone.

## fa/ellipsis

Opt-in. `...` after Persian text → `…`.

## fa/percent-sign

Opt-in. `۵۰%` → `۵۰٪`.

## fa/decimal-separator

Opt-in. `۱.۵` → `۱٫۵`. Dates such as `۱۴۰۳.۰۵.۱۲` are not touched.

## fa/thousands-separator

Opt-in. `۱,۲۵۰,۰۰۰` → `۱٬۲۵۰٬۰۰۰`.

## fa/latin-digits

Opt-in. Latin digits that stand alone in a Persian sentence become Persian digits («سال 1403» → «سال ۱۴۰۳»).
Codes such as `3D`, `v2` and `1080p` are not touched.

## fa/guillemets

Opt-in, and only in prose files (`.md`, `.txt`, `.srt`, `.vtt`): `"کیفیت بالا"` → `«کیفیت بالا»`.
Never in code, JSON or HTML, where the quotes are syntax.

## text/invisible-characters

Zero-width spaces (U+200B), word joiners (U+2060), Mongolian vowel separators (U+180E) and a byte
order mark in the middle of a file. They break search, line wrapping and string comparison, and
are removed. A BOM at the start of a file, emoji ZWJ sequences and Persian half-spaces are left alone.

---

## Disabling rules inline

Works in any comment syntax (`//`, `/* */`, `<!-- -->`, `{/* */}`, `#`):

```js
// rtlint-disable-next-line class/physical-utility -- the slider always runs left to right
<div className="ml-4" />
```

```css
/* rtlint-disable css/* */
.ltr-only-chart { margin-left: 4px; }
/* rtlint-enable */
```

`rtlint-disable-line`, `rtlint-disable-next-line`, `rtlint-disable` … `rtlint-enable`,
`rtlint-disable-file`. Without rule ids they apply to every rule. A directive must start a comment,
so mentioning one in prose or in a string does nothing. Inside a block comment that spans several
lines, `disable-next-line` targets the line after the comment ends.
