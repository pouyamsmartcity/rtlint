// ESLint plugin (flat config, ESLint 9+). Every rtlint rule becomes an ESLint
// rule named rtlint/<category>-<name>, e.g. rtlint/class-physical-utility.
//
//   import rtlint from 'rtlint/eslint';
//   export default [rtlint.configs.recommended];
//
// Works for any file ESLint parses (JS/TS/JSX, and Vue/Svelte/Astro through
// their parsers) because rtlint reads the raw source text.
import pkg from '../package.json' with { type: 'json' };
import { lintText, listRules, resolveSettings } from './core.js';

const DOCS = 'https://github.com/pouyamsmartcity/rtlint/blob/main/docs/rules.md#';

export const eslintName = (id) => id.replace('/', '-');

function toEslintRule(meta) {
  return {
    meta: {
      type: meta.id.startsWith('security/') ? 'problem' : 'suggestion',
      fixable: meta.fixable ? 'code' : undefined,
      docs: { description: meta.description, url: DOCS + meta.id.replace('/', '') },
      schema: [{ type: 'object', additionalProperties: true }],
    },
    create(context) {
      const sourceCode = context.sourceCode ?? context.getSourceCode();
      const filePath = context.filename ?? context.getFilename();
      const shared = context.settings?.rtlint ?? {};
      return {
        'Program:exit'() {
          const settings = resolveSettings(
            { ...shared, rules: { '*': 'off', [meta.id]: ['warn', context.options[0] ?? {}] } },
            filePath,
          );
          const { messages } = lintText(sourceCode.text, { filePath, settings });
          for (const m of messages) {
            context.report({
              loc: {
                start: { line: m.line, column: m.column - 1 },
                end: { line: m.endLine, column: m.endColumn - 1 },
              },
              message: m.message,
              fix: m.fix ? (fixer) => fixer.replaceTextRange(m.fix.range, m.fix.text) : null,
            });
          }
        },
      };
    },
  };
}

const rules = Object.fromEntries(listRules().map((meta) => [eslintName(meta.id), toEslintRule(meta)]));

const plugin = {
  meta: { name: 'rtlint', version: pkg.version },
  rules,
  configs: {},
};

plugin.configs.recommended = {
  name: 'rtlint/recommended',
  plugins: { rtlint: plugin },
  rules: Object.fromEntries(
    listRules()
      .filter((r) => r.level !== 'off')
      .map((r) => [`rtlint/${eslintName(r.id)}`, r.level]),
  ),
};

plugin.configs.all = {
  name: 'rtlint/all',
  plugins: { rtlint: plugin },
  rules: Object.fromEntries(listRules().map((r) => [`rtlint/${eslintName(r.id)}`, 'warn'])),
};

export default plugin;
