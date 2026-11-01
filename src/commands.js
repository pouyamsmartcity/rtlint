import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigError, getRule, listRules } from './engine.js';
import { DESCRIPTIONS_FA } from './i18n.js';

const SCHEMA = 'https://raw.githubusercontent.com/pouyamsmartcity/rtlint/main/schema/config.json';

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Looks a few levels deep for Persian locale files such as fa.json or locales/fa/. */
function hasPersianLocale(dir, depth = 0) {
  if (depth > 3) return false;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    if (/^(?:fa|fa[-_]IR)(?:\.[a-z]+)?$/i.test(e.name) || /(?:^|[._-])fa(?:[-_]IR)?\.(?:json|ya?ml|po|arb|ts|js)$/i.test(e.name)) return true;
    if (e.isDirectory() && hasPersianLocale(join(dir, e.name), depth + 1)) return true;
  }
  return false;
}

/**
 * Detects the project and writes rtlint.config.json (plus a "lint:rtl"
 * script in package.json). Returns lines to print.
 */
export function init(cwd, { force = false, lang } = {}) {
  const configPath = join(cwd, 'rtlint.config.json');
  if (existsSync(configPath) && !force) {
    throw new ConfigError('rtlint.config.json already exists (use --force to overwrite it)');
  }
  const pkgPath = join(cwd, 'package.json');
  const pkg = readJson(pkgPath);
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const has = (name) => Object.keys(deps).some((d) => d === name || d.startsWith(name + '/'));
  const twVersion = String(deps.tailwindcss ?? '').replace(/^[^\d]*/, '');
  const persian = hasPersianLocale(cwd);
  const detected = [];
  const rules = {};
  const config = { $schema: SCHEMA };

  config.lang = lang ?? (persian ? 'fa' : 'en');
  if (persian) detected.push('Persian translations');
  if (has('tailwindcss') || has('@tailwindcss')) {
    detected.push(`Tailwind CSS${twVersion ? ' ' + twVersion : ''}`);
    // Tailwind 3 space-x/divide-x are physical; v4 made them logical.
    if (/^[0-3]\./.test(twVersion)) rules['class/space-reverse'] = 'warn';
  }
  if (has('bootstrap')) detected.push('Bootstrap');
  if (has('react-native')) detected.push('React Native');
  if (has('react') || has('next')) detected.push('React');
  if (has('vue') || has('nuxt')) detected.push('Vue');
  if (has('svelte') || has('@sveltejs')) detected.push('Svelte');
  if (persian) {
    rules['html/user-content-dir'] = 'warn';
  }
  if (Object.keys(rules).length) config.rules = rules;
  config.ignore = [];

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  const out = [];
  const fa = config.lang === 'fa';
  out.push(fa ? '✓ فایل rtlint.config.json ساخته شد.' : '✓ Created rtlint.config.json');
  if (detected.length) out.push((fa ? '  شناسایی شد: ' : '  Detected: ') + detected.join(', '));

  if (pkg) {
    pkg.scripts ??= {};
    if (!pkg.scripts['lint:rtl']) {
      pkg.scripts['lint:rtl'] = 'npx @pouyam/rtlint';
      const indent = readFileSync(pkgPath, 'utf8').match(/^[ \t]+/m)?.[0] ?? '  ';
      writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + '\n');
      out.push(fa ? '✓ اسکریپت "lint:rtl" به package.json اضافه شد.' : '✓ Added a "lint:rtl" script to package.json');
    }
  }
  out.push('');
  out.push(fa ? 'قدم بعدی:' : 'Next:');
  out.push(fa ? '  npx @pouyam/rtlint            گزارش مشکل\u200Cها' : '  npx @pouyam/rtlint            report problems');
  out.push(fa ? '  npx @pouyam/rtlint --fix      اصلاح خودکار' : '  npx @pouyam/rtlint --fix      apply safe fixes');
  out.push(fa ? '  npx @pouyam/rtlint explain <قانون>   توضیح یک قانون' : '  npx @pouyam/rtlint explain <rule>   explain a rule');
  return out;
}

/** The section of docs/rules(.fa).md for one rule, or the rule's description. */
export function explain(id, lang = 'en') {
  const rule = getRule(id);
  if (!rule) {
    const close = listRules().map((r) => r.id).filter((r) => r.split('/')[1]?.includes(id.split('/').pop() ?? id));
    throw new ConfigError(`Unknown rule "${id}"${close.length ? ` (did you mean ${close.join(', ')}?)` : ''}`);
  }
  const file = new URL(`../docs/${lang === 'fa' ? 'rules.fa.md' : 'rules.md'}`, import.meta.url);
  let section = '';
  try {
    const md = readFileSync(file, 'utf8');
    const start = md.indexOf(`\n## ${id}\n`);
    if (start >= 0) {
      const next = md.indexOf('\n## ', start + 4);
      section = md.slice(start + 1, next < 0 ? md.length : next).trim();
    }
  } catch {
    // Docs are optional; fall back to the description.
  }
  const { meta } = rule;
  const head = [
    id,
    `${lang === 'fa' ? 'سطح پیش\u200Cفرض' : 'Default'}: ${meta.level}${meta.fixable ? (lang === 'fa' ? ' · اصلاح خودکار' : ' · fixable') : ''}`,
    '',
  ];
  const body = section
    ? section.replace(/^## .*\n+/, '').replace(/<\/?div[^>]*>\n?/g, '')
    : lang === 'fa' ? DESCRIPTIONS_FA[id] : meta.description;
  const docs = `https://github.com/pouyamsmartcity/rtlint/blob/main/docs/${lang === 'fa' ? 'rules.fa.md' : 'rules.md'}#${id.replace('/', '')}`;
  return [...head, body.trim(), '', docs].join('\n');
}
