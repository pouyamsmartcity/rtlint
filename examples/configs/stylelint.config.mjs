// stylelint.config.mjs
export default {
  plugins: ['rtlint/stylelint'],
  rules: {
    'rtlint/css': [true, { lang: 'fa', rules: { 'css/directional-value': 'warn' } }],
  },
};
