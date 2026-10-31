// Regenerates schema/config.json from the rule list: node scripts/build-schema.js
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { listRules } from '../src/core.js';

export function buildSchema() {
  const level = { enum: ['off', 'warn', 'error', 0, 1, 2] };
  const entry = (options) => ({
    oneOf: [level, { type: 'array', prefixItems: [level, options ?? { type: 'object' }], minItems: 1, maxItems: 2 }],
  });
  const OPTIONS = {
    'class/directional-utility': {
      type: 'object',
      properties: { gradients: { type: 'boolean', description: 'Also check bg-gradient-to-l/r.' } },
      additionalProperties: false,
    },
    'fa/zwnj-suffix': {
      type: 'object',
      properties: { comparatives: { enum: [true, false, 'all'], description: 'true (default): ترین always, تر after common adjectives; "all": تر after any word; false: neither.' } },
      additionalProperties: false,
    },
    'text/presentation-forms': {
      type: 'object',
      properties: { code: { type: 'boolean', description: 'Also check JS/TS and other code files.' } },
      additionalProperties: false,
    },
  };
  const rules = {};
  for (const r of listRules()) {
    rules[r.id] = { ...entry(OPTIONS[r.id]), description: `${r.description} Default: ${r.level}.` };
  }
  const categories = [...new Set(listRules().map((r) => r.id.split('/')[0]))];
  for (const c of categories) rules[`${c}/*`] = { ...entry(), description: `Every ${c}/ rule.` };
  rules['*'] = { ...entry(), description: 'Every rule.' };
  const scalars = {
    persian: { enum: ['auto', true, false], description: 'Persian text detection. Default "auto".' },
    classes: { type: 'boolean', description: 'Check utility classes (Tailwind/UnoCSS/Bootstrap). Default true.' },
    classPrefix: { type: 'string', description: 'Tailwind prefix, e.g. "tw-".' },
    lang: { enum: ['en', 'fa'], description: 'Language of messages: en (default) or fa (Persian).' },
  };
  const ruleMap = { type: 'object', properties: rules, additionalProperties: false };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://raw.githubusercontent.com/pouyamsmartcity/rtlint/main/schema/config.json',
    title: 'rtlint configuration',
    type: 'object',
    properties: {
      $schema: { type: 'string' },
      ...scalars,
      rules: ruleMap,
      ignore: { type: 'array', items: { type: 'string' }, description: 'Globs to skip.' },
      overrides: {
        type: 'array',
        items: {
          type: 'object',
          required: ['files'],
          properties: {
            files: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
            excludedFiles: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
            ...scalars,
            rules: ruleMap,
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(new URL('../schema/config.json', import.meta.url), JSON.stringify(buildSchema(), null, 2) + '\n');
  console.log('schema/config.json written');
}
