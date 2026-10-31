import { getAttr } from './util.js';

const RTL_LANGUAGES = new Set([
  'ar', 'arc', 'azb', 'bal', 'bqi', 'ckb', 'dv', 'fa', 'glk', 'he', 'iw', 'khw', 'ks', 'lrc',
  'mzn', 'nqo', 'pnb', 'prs', 'ps', 'sd', 'sdh', 'syr', 'ug', 'ur', 'yi', 'ji',
]);
const RTL_SCRIPTS = new Set(['arab', 'hebr', 'thaa', 'syrc', 'nkoo', 'adlm', 'rohg', 'mand', 'samr']);
const LTR_SCRIPTS = new Set(['latn', 'cyrl', 'grek', 'deva', 'hans', 'hant', 'jpan', 'kore']);

/** true/false for a BCP 47 tag, honouring script subtags such as ku-Arab or az-Latn. */
export function isRtlLanguage(tag) {
  const parts = tag.trim().toLowerCase().split(/[-_]/);
  const script = parts.slice(1).find((p) => p.length === 4);
  if (script && RTL_SCRIPTS.has(script)) return true;
  if (script && LTR_SCRIPTS.has(script)) return false;
  return RTL_LANGUAGES.has(parts[0]);
}

function markupSource(file) {
  if (file.kind === 'markup') return file.markupView;
  if (file.kind === 'script') return file.jsxView;
  return null;
}

export const dirAttribute = {
  id: 'html/dir-attribute',
  meta: {
    description: '<html> with an RTL lang needs dir="rtl"; a dynamic lang needs a dynamic dir.',
    fixable: true,
    level: 'error',
  },
  check(file, report) {
    const src = markupSource(file);
    if (!src) return;
    for (const m of src.matchAll(/<html\b([^>]*)>/gi)) {
      const attrsStart = m.index + 5;
      const attrs = m[1];
      const lang = getAttr(attrs, 'lang');
      const dir = getAttr(attrs, 'dir');
      if (!lang || !lang.value) continue;
      if (lang.dynamic) {
        if (!dir) {
          report({
            index: m.index,
            length: 5,
            message: '<html> sets lang dynamically but has no dir; RTL locales will render left-to-right. Derive dir from the locale.',
            fa: '<html> زبان را پویا می\u200Cگیرد ولی dir ندارد؛ زبان\u200Cهای راست\u200Cبه\u200Cچپ، چپ\u200Cبه\u200Cراست نمایش داده می\u200Cشوند. dir را هم از روی زبان تعیین کنید.',
          });
        }
        continue;
      }
      const rtl = isRtlLanguage(lang.value);
      if (rtl && !dir) {
        report({
          index: m.index,
          length: 5,
          message: `<html lang="${lang.value}"> is a right-to-left language but has no dir="rtl".`,
          fa: `<html lang="${lang.value}"> زبانی راست\u200Cبه\u200Cچپ است ولی dir="rtl" ندارد.`,
          fix: { range: [attrsStart, attrsStart], text: ' dir="rtl"' },
        });
      } else if (rtl && dir && !dir.dynamic && dir.value.toLowerCase() === 'ltr') {
        const start = attrsStart + dir.valueStart;
        report({
          index: start,
          length: 3,
          message: `<html lang="${lang.value}"> is a right-to-left language but dir="ltr".`,
          fa: `<html lang="${lang.value}"> زبانی راست\u200Cبه\u200Cچپ است ولی dir="ltr" دارد.`,
          fix: { range: [start, start + 3], text: 'rtl' },
        });
      } else if (!rtl && dir && !dir.dynamic && dir.value.toLowerCase() === 'rtl') {
        report({
          index: attrsStart + dir.valueStart,
          length: 3,
          message: `<html lang="${lang.value}"> is a left-to-right language but dir="rtl"; is lang wrong?`,
          fa: `<html lang="${lang.value}"> زبانی چپ\u200Cبه\u200Cراست است ولی dir="rtl" دارد؛ lang درست است؟`,
        });
      }
    }
  },
};

const LTR_TYPES = new Set(['email', 'url', 'tel']);

export const ltrInput = {
  id: 'html/ltr-input',
  meta: {
    description:
      'Email, URL and phone inputs inherit dir="rtl" and scramble their punctuation; give them dir="ltr".',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    const src = markupSource(file);
    if (!src) return;
    for (const m of src.matchAll(/<input\b((?:[^>"'{]|"[^"]*"|'[^']*'|\{[^}]*\})*)>/gi)) {
      const type = getAttr(m[1], 'type');
      if (!type || type.dynamic || !LTR_TYPES.has(type.value.toLowerCase())) continue;
      if (getAttr(m[1], 'dir')) continue;
      const at = m.index + 6;
      report({
        index: m.index,
        length: 6,
        message: `<input type="${type.value}"> inherits the page direction; in RTL "user@example.com" and "+98 912…" render scrambled. Add dir="ltr" (or dir="auto").`,
        fa: `<input type="${type.value}"> جهت صفحه را می\u200Cگیرد و در صفحه\u200Cی فارسی «user@example.com» و «+98 912…» به\u200Cهم\u200Cریخته نمایش داده می\u200Cشوند. dir="ltr" (یا dir="auto") اضافه کنید.`,
        fix: { range: [at, at], text: ' dir="ltr"' },
      });
    }
  },
};
