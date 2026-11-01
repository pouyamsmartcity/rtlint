// Icons that point left/right mean "back"/"forward"; in RTL they must mirror.
// Up/down and diagonal arrows (external-link ↗) are deliberately left alone.

const COMPONENT = /<([A-Z][\w.]*)\b((?:[^<>"'{]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*)>/g;
const ICON_NAME =
  /(?:Chevrons?|Arrows?|Caret|Angles?|Navigate|KeyboardArrow|ArrowNarrow|ArrowSmall|ArrowLong|Triangle)(?:Left|Right|Back|Forward|Next|Before|Previous)(?:Icon|Outline|Filled|Rounded|Sharp|Ios|IosNew)*$|^(?:[A-Z][a-z]{0,2})?(?:ArrowBack|ArrowForward|NavigateNext|NavigateBefore)\w*$/;
const VERTICAL = /Up|Down|Top|Bottom/;

const ICON_CLASS =
  /(?:^|\s)((?:fa|bi|ti|ri|icon|i-[\w-]+?)-(?:long-)?(?:chevrons?|arrows?|caret|angles?|navigate)-(?:left|right|back|forward|next|previous)(?:-[\w-]+)?)(?=\s|$)/g;
const ICON_ATTR =
  /(?<![\w:.-])(?:icon|name|data-icon|iconName)\s*=\s*(["'])([\w-]*:)?((?:chevrons?|arrows?|caret|angles?|navigate)[-_](?:left|right|back|forward|next|previous)(?:[-_][\w-]+)?)\1/gi;
const MATERIAL =
  /class(?:Name)?\s*=\s*["'][^"']*material-(?:icons|symbols)[^"']*["'][^>]*>\s*(arrow_forward(?:_ios)?|arrow_back(?:_ios(?:_new)?)?|chevron_left|chevron_right|navigate_next|navigate_before|keyboard_arrow_left|keyboard_arrow_right|keyboard_double_arrow_left|keyboard_double_arrow_right|east|west|first_page|last_page|trending_flat)\s*</g;

// Evidence that the author already handles direction.
const MIRRORED = /rtl|flip|mirror|scale-x|scalex\(\s*-1|rotate-180|rotate\(\s*180|\bdir\b|direction|isltr|i18n-icon/i;

const TERNARY =
  /(?:rtl|ltr|dir|direction)[\w.'"\])\s=!]*(?:\?|&&|\|\|)\s*(?:\(?\s*<[^<>]*>\s*\)?\s*:\s*)?\(?\s*$/i;

function source(file) {
  if (file.kind === 'markup') return file.htmlView;
  if (file.kind === 'script') return file.jsxView;
  return null;
}

/** True when the icon is visibly direction-aware or picked by a direction ternary. */
function handled(src, index, attrs) {
  if (MIRRORED.test(attrs)) return true;
  // `isRtl ? <ChevronLeft /> : <ChevronRight />` or `dir === 'rtl' && <ArrowLeft />`.
  return TERNARY.test(src.slice(Math.max(0, index - 160), index));
}

export const directionalIcon = {
  id: 'icon/directional',
  meta: {
    description:
      'Left/right chevrons and arrows (back/next) keep pointing the same way in RTL; mirror them.',
    fixable: false,
    level: 'warn',
  },
  check(file, report) {
    const src = source(file);
    if (!src) return;
    const hint =
      'In RTL it points backwards; mirror it (e.g. class="rtl:-scale-x-100", or [dir="rtl"] .icon { transform: scaleX(-1) }).';
    const hintFa =
      'در صفحه\u200Cی راست\u200Cبه\u200Cچپ جهتش برعکس می\u200Cشود؛ آینه\u200Cاش کنید (مثلاً class="rtl:-scale-x-100" یا [dir="rtl"] .icon { transform: scaleX(-1) }).';
    for (const m of src.matchAll(COMPONENT)) {
      const name = m[1].split('.').pop();
      if (!ICON_NAME.test(name) || VERTICAL.test(name)) continue;
      if (handled(src, m.index, m[2])) continue;
      report({ index: m.index + 1, length: m[1].length, message: `<${m[1]}> is a directional icon. ${hint}`, fa: `<${m[1]}> آیکونی جهت\u200Cدار است. ${hintFa}` });
    }
    for (const [start, end] of file.classRegions) {
      const value = file.text.slice(start, end);
      if (MIRRORED.test(value)) continue;
      for (const m of value.matchAll(ICON_CLASS)) {
        const at = start + m.index + m[0].indexOf(m[1]);
        const tagStart = src.lastIndexOf('<', start);
        const tagEnd = src.indexOf('>', end);
        const tag = src.slice(tagStart, tagEnd < 0 ? end : tagEnd);
        if (handled(src, tagStart, tag)) continue;
        report({ index: at, length: m[1].length, message: `"${m[1]}" is a directional icon. ${hint}`, fa: `«${m[1]}» آیکونی جهت\u200Cدار است. ${hintFa}` });
      }
    }
    for (const m of src.matchAll(ICON_ATTR)) {
      if (/up|down|top|bottom/i.test(m[3])) continue;
      const tagStart = src.lastIndexOf('<', m.index);
      const tagEnd = src.indexOf('>', m.index);
      const tag = src.slice(tagStart, tagEnd < 0 ? src.length : tagEnd);
      if (handled(src, tagStart, tag.replace(m[0], ''))) continue;
      const at = m.index + m[0].indexOf(m[3], m[0].indexOf(m[1]) + 1);
      report({ index: at, length: m[3].length, message: `Icon "${(m[2] ?? '') + m[3]}" is directional. ${hint}`, fa: `آیکون «${(m[2] ?? '') + m[3]}» جهت\u200Cدار است. ${hintFa}` });
    }
    for (const m of src.matchAll(MATERIAL)) {
      const tagStart = src.lastIndexOf('<', m.index);
      if (handled(src, tagStart, m[0])) continue;
      const at = m.index + m[0].lastIndexOf(m[1]);
      report({ index: at, length: m[1].length, message: `Material icon "${m[1]}" is directional. ${hint}`, fa: `آیکون متریال «${m[1]}» جهت\u200Cدار است. ${hintFa}` });
    }
  },
};
