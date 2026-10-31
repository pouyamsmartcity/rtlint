# CSS logical properties cheat sheet (for RTL and LTR)

Logical properties describe **start** and **end** of the reading direction instead of left and right.
In English, start is left. In Persian, Arabic and Hebrew it is right. With logical properties one
stylesheet works for both, and you never write a `[dir="rtl"]` override again.

[rtlint](https://github.com/pouyamsmartcity/rtlint) (by Pouyam) converts physical CSS to logical CSS
automatically and safely: `npx github:pouyamsmartcity/rtlint --fix`.

## Spacing and borders

| Physical | Logical |
| --- | --- |
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end` |
| `border-left` / `border-right` | `border-inline-start` / `border-inline-end` |
| `border-left-width` / `-color` / `-style` | `border-inline-start-width` / `-color` / `-style` |
| `scroll-margin-left` / `scroll-padding-right` | `scroll-margin-inline-start` / `scroll-padding-inline-end` |

## Position

| Physical | Logical |
| --- | --- |
| `left: 0` | `inset-inline-start: 0` |
| `right: 0` | `inset-inline-end: 0` |
| `top: 0; bottom: 0` | `inset-block: 0` |

## Corners

| Physical | Logical |
| --- | --- |
| `border-top-left-radius` | `border-start-start-radius` |
| `border-top-right-radius` | `border-start-end-radius` |
| `border-bottom-left-radius` | `border-end-start-radius` |
| `border-bottom-right-radius` | `border-end-end-radius` |

## Values

| Physical | Logical |
| --- | --- |
| `text-align: left` | `text-align: start` |
| `float: right` | `float: inline-end` |
| `clear: left` | `clear: inline-start` |

## Four-value shorthands

A shorthand with different left and right values cannot mirror. Split it; the LTR result stays the same:

```css
/* before */
padding: 0 24px 0 8px;
border-radius: 8px 0 0 8px;

/* after */
padding-block: 0;
padding-inline: 8px 24px;          /* start end */
border-start-start-radius: 8px;
border-start-end-radius: 0;
border-end-end-radius: 0;
border-end-start-radius: 8px;
```

## Transitions

If you animate `margin-left` and then switch it to `margin-inline-start`, the transition stops,
because the transitioned property name no longer matches. Rename it too:

```css
transition: margin-inline-start 0.2s;
```

## What stays physical

- `env(safe-area-inset-left)` follows the phone's notch, not the reading direction.
- `@page { margin-left }` for printing.
- `left: 50%; transform: translateX(-50%)` centering. Prefer `inset-inline: 0; margin-inline: auto`.
- Charts, video controls and code that always run left to right.

## Browser support

Every logical property above works in all current browsers (Chrome/Edge 89+, Firefox 66+, Safari 15+).
`float: inline-start` needs Chrome 118+.

---

See every rule rtlint applies in [docs/rules.md](../rules.md), or try it in the [playground](https://pouyamsmartcity.github.io/rtlint/playground/).
