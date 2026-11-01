// eslint.config.js
import rtlint from '@pouyam/rtlint/eslint';

export default [
  rtlint.configs.recommended,
  {
    // Persian messages in the editor; the rest comes from rtlint.config.json-style settings.
    settings: { rtlint: { lang: 'fa' } },
    rules: {
      'rtlint/fa-arabic-letters': 'error',
      'rtlint/icon-directional': 'error',
    },
  },
];
