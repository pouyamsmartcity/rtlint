<!-- rtlint-disable-file fa/* -->
# Rules

Every rule can be set to `"off"`, `"warn"` or `"error"`, alone or as `["warn", { …options }]`.
Wildcards work: `"fa/*": "off"`. ✎ means `rtlint --fix` can repair it.

| Rule | Default | Fix |
| --- | --- | --- |
| [`css/physical-property`](#cssphysical-property) | warn | ✎ |
| [`css/physical-value`](#cssphysical-value) | warn | ✎ |
| [`css/asymmetric-shorthand`](#cssasymmetric-shorthand) | warn | ✎ |
| [`class/physical-utility`](#classphysical-utility) | warn | ✎ |
| [`class/directional-utility`](#classdirectional-utility) | warn | |
| [`jsx/physical-style`](#jsxphysical-style) | warn | ✎ |
| [`html/dir-attribute`](#htmldir-attribute) | error | ✎ |
| [`html/ltr-input`](#htmlltr-input) | warn | ✎ |
| [`fa/arabic-letters`](#faarabic-letters) | error | ✎ |
| [`fa/arabic-digits`](#faarabic-digits) | warn | ✎ |
| [`fa/mixed-digits`](#famixed-digits) | warn | ✎ |
| [`fa/zwnj-prefix`](#fazwnj-prefix) | warn | ✎ |
| [`fa/zwnj-suffix`](#fazwnj-suffix) | warn | ✎ |
| [`fa/zwnj-invalid`](#fazwnj-invalid) | warn | ✎ |
| [`fa/punctuation`](#fapunctuation) | warn | ✎ |
| [`fa/punctuation-spacing`](#fapunctuation-spacing) | warn | ✎ |
| [`fa/kashida`](#fakashida) | warn | ✎ |
| [`security/bidi-control`](#securitybidi-control) | error | |

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

Not reported:

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
`border-style`, `border-color` and `border-radius` (not the `/` elliptical form). In `.sass` and
`.styl` it reports without fixing, because the fix needs semicolons.

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

Variants, `!important`, negative values, arbitrary values and fractions are kept:
`md:hover:!-ml-[3px]` → `md:hover:!-ms-[3px]`. Classes with an `rtl:` or `ltr:` variant are
intentional and left alone. Names that only look like utilities (`left-panel`) are ignored.
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
(`marginStart`, `paddingEnd`, `borderTopStartRadius` …).

## html/dir-attribute

`<html lang="fa">` without `dir="rtl"` renders left-to-right. Also flags `dir="ltr"` on an RTL
language, `dir="rtl"` on an LTR one, and a dynamic `lang={locale}` with no `dir` at all (common in
Next.js and SvelteKit layouts). Knows RTL languages and script subtags (`ku-Arab`, `az-Latn`).

## html/ltr-input

`<input type="email|url|tel">` inherits `dir="rtl"`: `user@example.com` and `+98 912 …` render
with their punctuation moved to the wrong end. Adds `dir="ltr"` (or keep your own `dir="auto"`).

## fa/arabic-letters

Persian typed on an Arabic keyboard layout uses `ي` (U+064A), `ك` (U+0643) and `ى` (U+0649)
instead of `ی` (U+06CC) and `ک` (U+06A9). They look almost the same, but search, sorting,
deduplication and some fonts treat them as different letters.

**Only Persian is touched.** A line counts as Persian when it has a Persian-only letter
(`پ چ ژ گ ی ک`, Persian digits) and none of the letters that identify Arabic (`ة`), Urdu, Kurdish,
Pashto or Uyghur. Lines without a decisive letter follow the file: a path like `locales/fa.json`
or `fa-IR/` is Persian, `ar.json` or `/ur/` is not, otherwise the file's own letters decide.
Force it with `"persian": true | false` globally or in an override.

## fa/arabic-digits

Arabic-Indic digits `٠١٢٣٤٥٦٧٨٩` in Persian text → Persian digits `۰۱۲۳۴۵۶۷۸۹` (4, 5 and 6 have different shapes).

## fa/mixed-digits

A single number written with two digit systems, e.g. `۱۲3`. Converted to Persian digits.

## fa/zwnj-prefix

The prefixes `می` / `نمی` attach to the verb with a zero-width non-joiner (نیم‌فاصله, U+200C):
`می روم` → `می‌روم`. Skipped before function words (`و`, `که`, `را`, `از` …).

## fa/zwnj-suffix

`کتاب ها` → `کتاب‌ها`, `بزرگ تر` → `بزرگ‌تر`, and after a final ه: `خانه ای` → `خانه‌ای`,
`رفته اند` → `رفته‌اند`. Two-letter words (`که`, `چه`, `نه`, `به`) are never joined.
Option `{ "comparatives": false }` skips `تر` / `ترین` (for texts where تر means "wet").

## fa/zwnj-invalid

Doubled ZWNJ, a ZWNJ next to a space or outside a word (it does nothing there), and a ZWJ
(U+200D) or zero-width space (U+200B) used where a ZWNJ was meant.

## fa/punctuation

Latin `,` `;` `?` between Persian words → `،` `؛` `؟`. Only when Persian is on both sides, so
`words like سلام, which` and code such as `t('سلام', …)` are left alone.

## fa/punctuation-spacing

No space before `، ؛ ؟ ! .` and none just inside `« »`.

## fa/kashida

Tatweel (ـ, U+0640) stretches words on screen but breaks search and copy-paste.
Use `text-align: justify` for justification.

## security/bidi-control

Invisible bidirectional control characters (U+202A–U+202E, U+2066–U+2069) can make code
display differently from how it runs: the
[Trojan Source](https://trojansource.codes/) attack, CVE-2021-42574.

- In code and stylesheets every such character is reported.
- In text, markup and translation files, where RTL text may use them on purpose, only the risky
  ones are: overrides (U+202D, U+202E) and embeddings/isolates left unclosed on their line,
  whose direction leaks into whatever is rendered next.

Not auto-fixed: a human should look at each one.

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
`rtlint-disable-file`. Without rule ids they apply to every rule.
