# How to support RTL (right-to-left) in Tailwind CSS

Supporting Persian, Arabic, Hebrew or Urdu in a Tailwind project comes down to three things: set the
page direction, write direction-agnostic classes, and flip the few things that cannot be
direction-agnostic. [rtlint](https://github.com/pouyamsmartcity/rtlint) (by Pouyam) checks and fixes all of it.

## 1. Set `dir` on `<html>`

```html
<html lang="fa" dir="rtl">
```

With a dynamic locale (Next.js, SvelteKit, Nuxt), derive `dir` from it:

```jsx
<html lang={locale} dir={['fa', 'ar', 'he', 'ur'].includes(locale) ? 'rtl' : 'ltr'}>
```

## 2. Use logical utilities instead of left/right

Since Tailwind CSS 3.3, every spacing and position utility has a logical twin. It follows the
reading direction, so one class works in both LTR and RTL:

| Physical (breaks in RTL) | Logical (works in both) |
| --- | --- |
| `ml-4` / `mr-4` | `ms-4` / `me-4` |
| `pl-4` / `pr-4` | `ps-4` / `pe-4` |
| `left-0` / `right-0` | `start-0` / `end-0` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `border-l-2` / `border-r` | `border-s-2` / `border-e` |
| `rounded-l-lg` / `rounded-tr-xl` | `rounded-s-lg` / `rounded-se-xl` |
| `float-left` / `clear-right` (3.4+) | `float-start` / `clear-end` |
| `scroll-ml-2` | `scroll-ms-2` |

Convert a whole codebase in one command (variants, `!important` and negative values are kept):

```bash
npx github:pouyamsmartcity/rtlint src --fix
```

It also covers `clsx()`, `cn()`, `cva()`, `twMerge()`, `@apply`, Vue `:class` and Svelte `class:`.

## 3. Flip what moves or points

Some utilities move things on screen and need an `rtl:` partner:

```html
<!-- An arrow that nudges forward on hover -->
<svg class="group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:-scale-x-100"></svg>
```

- `translate-x-*` → add `rtl:-translate-x-*`
- back/next icons (`ChevronRight`, `ArrowLeft`) → add `rtl:-scale-x-100`
- Tailwind 3 `space-x-*` / `divide-x-*` → add `rtl:space-x-reverse` (Tailwind 4 made them logical)

rtlint's `class/directional-utility`, `icon/directional` and `class/space-reverse` rules point these out.

## 4. Things that should **not** flip

- The centering pair `left-1/2 -translate-x-1/2`: either keep both physical or flip both.
- Classes already chosen by direction: `isRtl ? 'mr-2' : 'ml-2'`.
- Media controls, charts and code blocks that always run left to right. Mark them with
  `// rtlint-disable-next-line class/physical-utility -- the slider always runs LTR`.

## Check it in CI

```yaml
- uses: actions/checkout@v4
- uses: pouyamsmartcity/rtlint@main
  with:
    paths: src
    changed-only: true
```

Problems show up as annotations on the pull request, with a summary table on the run page.

---

Try it without installing anything: [rtlint playground](https://pouyamsmartcity.github.io/rtlint/playground/).
