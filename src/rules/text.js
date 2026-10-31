// Arabic presentation forms (U+FB50-U+FDFF, U+FE70-U+FEFC) are pre-shaped
// glyph codes. Text copied out of PDFs and old software is full of them; it
// looks right but search, sorting, spell-checking and screen readers see
// different characters.
//
// Left alone on purpose: the ornate Quran brackets and honorifics
// (U+FD3E-U+FD4F, U+FDCF) and the word ligatures U+FDF2-U+FDFF (Allah, the
// rial sign, salawat), which are used deliberately and have no plain spelling.
const FORMS = new RegExp(
  '[\\uFB50-\\uFD3D\\uFD50-\\uFDCE\\uFDF0-\\uFDF1\\uFE70-\\uFEFC]+',
  'g',
);

// U+FE70-U+FE7F are spacing or tatweel-carrying harakat; NFKC would turn them
// into "space + mark" or "tatweel + mark". They stand for the bare mark.
const HARAKAT_FORMS = new Map(
  [
    [0xfe70, 0x064b], [0xfe71, 0x064b], [0xfe72, 0x064c], [0xfe74, 0x064d],
    [0xfe76, 0x064e], [0xfe77, 0x064e], [0xfe78, 0x064f], [0xfe79, 0x064f],
    [0xfe7a, 0x0650], [0xfe7b, 0x0650], [0xfe7c, 0x0651], [0xfe7d, 0x0651],
    [0xfe7e, 0x0652], [0xfe7f, 0x0652],
  ].map(([from, to]) => [String.fromCharCode(from), String.fromCharCode(to)]),
);

/** The plain-letter spelling of a run of presentation forms. */
export function normalizeForms(run) {
  let out = '';
  for (const ch of run) out += HARAKAT_FORMS.get(ch) ?? ch.normalize('NFKC');
  return out;
}

export const presentationForms = {
  id: 'text/presentation-forms',
  meta: {
    description:
      'Arabic-script presentation forms (pre-shaped glyphs from PDFs and old software) look right but break search and screen readers; use the normal letters.',
    fixable: true,
    level: 'error',
  },
  check(file, report, options) {
    // Canvas/game code sometimes pre-shapes text on purpose, so code is opt-in.
    const code = file.kind === 'script' || file.kind === 'code';
    if (code && options.code !== true) return;
    for (const m of file.text.matchAll(FORMS)) {
      const fixed = normalizeForms(m[0]);
      if (fixed === m[0]) continue;
      report({
        index: m.index,
        length: m[0].length,
        message: `"${m[0]}" is written with presentation-form glyphs; use the normal letters "${fixed}".`,
        fa: `«${m[0]}» با حروف کپی\u200Cشده از PDF (presentation forms) نوشته شده؛ حروف معمولی «${fixed}» را بنویسید.`,
        fix: { text: fixed },
      });
    }
  },
};
