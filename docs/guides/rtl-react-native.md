# RTL in React Native: marginStart, I18nManager and icons

React Native flips layouts for right-to-left languages when `I18nManager.isRTL` is true, but only
for styles that use its **start/end** vocabulary. `marginLeft` stays on the left.

[rtlint](https://github.com/pouyamsmartcity/rtlint) (by Pouyam) finds and converts these styles:
`npx github:pouyamsmartcity/rtlint src --fix`.

## Use start/end style keys

| Physical | React Native logical |
| --- | --- |
| `marginLeft` / `marginRight` | `marginStart` / `marginEnd` |
| `paddingLeft` / `paddingRight` | `paddingStart` / `paddingEnd` |
| `borderLeftWidth` / `borderRightColor` | `borderStartWidth` / `borderEndColor` |
| `borderTopLeftRadius` | `borderTopStartRadius` |
| `borderBottomRightRadius` | `borderBottomEndRadius` |

```js
const styles = StyleSheet.create({
  avatar: { marginEnd: 12, borderTopStartRadius: 20 },  // flips in RTL
});
```

## Turn RTL on

```js
import { I18nManager } from 'react-native';

I18nManager.allowRTL(true);
I18nManager.forceRTL(isPersian); // needs an app reload to take effect
```

## Icons and arrows

Back/next icons do not flip by themselves:

```jsx
<ChevronRight style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }} />
```

## When you already branch on direction

rtlint leaves styles alone when they are already chosen by direction, so it never flips them twice:

```js
const s = I18nManager.isRTL ? { marginRight: 8 } : { marginLeft: 8 }; // left as is
```

## Text

`textAlign: 'left'` in React Native aligns to the physical left. For text that follows the language,
leave `textAlign` unset (it follows the writing direction), or use `writingDirection: 'rtl'` for
Persian blocks.
