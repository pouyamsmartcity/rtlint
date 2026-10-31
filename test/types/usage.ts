import { fixText, lintText, type Config, run } from 'rtlint';
import { lintText as coreLint } from 'rtlint/core';
import plugin from 'rtlint/eslint';
import stylelintPlugin from 'rtlint/stylelint';

const config: Config = { rules: { 'fa/*': 'off', 'class/directional-utility': ['warn', { gradients: true }] } };
const r = lintText('a{margin-left:0}', { filePath: 'a.css', config });
const n: number = r.messages[0].line + r.errorCount;
const out: string = fixText('x', {}).output;
coreLint('x');
const exit: Promise<number> = run(['--version']);
const rules = plugin.configs.recommended.rules;
void [n, out, exit, rules, stylelintPlugin];
