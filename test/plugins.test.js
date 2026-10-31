import { test } from 'node:test';
import assert from 'node:assert/strict';

test('ESLint plugin: reports and fixes through ESLint', async () => {
  const { Linter } = await import('eslint');
  const { default: plugin } = await import('../src/eslint.js');
  const linter = new Linter({ configType: 'flat' });
  const config = [
    {
      files: ['**/*.jsx'],
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      ...plugin.configs.recommended,
    },
  ];
  const code = 'export const A = () => <div className="ml-2 text-left" style={{ marginLeft: 4 }} />;\n';
  const messages = linter.verify(code, config, { filename: 'a.jsx' });
  assert.deepEqual(
    messages.map((m) => m.ruleId).sort(),
    ['rtlint/class-physical-utility', 'rtlint/class-physical-utility', 'rtlint/jsx-physical-style'],
  );
  assert.equal(messages[0].line, 1);
  const fixed = linter.verifyAndFix(code, config, { filename: 'a.jsx' });
  assert.equal(fixed.output, 'export const A = () => <div className="ms-2 text-start" style={{ marginInlineStart: 4 }} />;\n');
  assert.ok(Object.keys(plugin.rules).length >= 20);
});

test('ESLint plugin: rule options are passed through', async () => {
  const { Linter } = await import('eslint');
  const { default: plugin } = await import('../src/eslint.js');
  const linter = new Linter({ configType: 'flat' });
  const config = [
    {
      files: ['**/*.jsx'],
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { rtlint: plugin },
      rules: { 'rtlint/class-directional-utility': ['warn', { gradients: true }] },
    },
  ];
  const messages = linter.verify('const a = <i className="bg-gradient-to-r" />;', config, { filename: 'a.jsx' });
  assert.equal(messages.length, 1);
});

test('Stylelint plugin: reports with correct positions', async () => {
  const { default: stylelint } = await import('stylelint');
  const config = { plugins: [new URL('../src/stylelint.js', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')], rules: { 'rtlint/css': true } };
  const css = 'a {\n  margin-left: 4px;\n  padding: 0 1px 0 2px;\n}\n';
  const { results } = await stylelint.lint({ code: css, codeFilename: 'a.css', config });
  const w = results[0].warnings.map((x) => [x.line, x.column, /css\/(\S+)\)/.exec(x.text)[1]]);
  assert.deepEqual(w, [[2, 3, 'physical-property'], [3, 3, 'asymmetric-shorthand']]);
});
