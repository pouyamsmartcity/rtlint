// Arabic presentation forms (U+FB50-U+FDFF, U+FE70-U+FEFC) are pre-shaped
// glyph codes. Text copied out of PDFs and old software is full of them; it
// looks right but search, sorting, spell-checking and screen readers see
// different characters. The word ligatures U+FDF2-U+FDFD (Allah, the rial
// sign ﷼, honorifics) are used on purpose and are left alone.
const FORMS = new RegExp(
  '[\\uFB50-\\uFDF1\\uFDFE-\\uFDFF\\uFE70-\\uFEFC]+',
  'g',
);

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
      const fixed = m[0].normalize('NFKC');
      report({
        index: m.index,
        length: m[0].length,
        message: `"${m[0]}" is written with presentation-form glyphs; use the normal letters "${fixed}".`,
        fix: { text: fixed },
      });
    }
  },
};
