import { parseDirectives, ruleMatches } from './directives.js';
import { createFile, position } from './file.js';
import { matchAny } from './glob.js';
import { DESCRIPTIONS_FA, LANGS } from './i18n.js';
import { ruleMap, rules } from './rules/index.js';

export class ConfigError extends Error {}

const LEVELS = { off: 0, warn: 1, error: 2, 0: 0, 1: 1, 2: 2 };
const LEVEL_NAMES = ['off', 'warn', 'error'];

function normalizeEntry(value, where) {
  const [level, options] = Array.isArray(value) ? value : [value];
  if (!(level in LEVELS)) {
    throw new ConfigError(`${where}: invalid level ${JSON.stringify(level)} (use "off", "warn" or "error")`);
  }
  return { level: LEVEL_NAMES[LEVELS[level]], options };
}

function applyRules(target, entries, where) {
  for (const [pattern, value] of Object.entries(entries ?? {})) {
    const entry = normalizeEntry(value, `${where} "${pattern}"`);
    const ids = rules.map((r) => r.id).filter((id) => ruleMatches(pattern, id));
    if (!ids.length) throw new ConfigError(`${where}: unknown rule "${pattern}" (see rtlint --list-rules)`);
    for (const id of ids) target[id] = { level: entry.level, options: entry.options ?? target[id].options };
  }
}

const PERSIAN_MODES = { auto: 'auto', true: true, on: true, false: false, off: false };

function applyScalars(settings, from, where) {
  if ('persian' in from) {
    const mode = PERSIAN_MODES[String(from.persian)];
    if (mode === undefined) throw new ConfigError(`${where}persian must be "auto", true or false, got ${JSON.stringify(from.persian)}`);
    settings.persian = mode;
  }
  if ('lang' in from) {
    if (!LANGS.includes(from.lang)) throw new ConfigError(`${where}lang must be one of ${LANGS.join(', ')}`);
    settings.lang = from.lang;
  }
  if ('classes' in from) {
    if (typeof from.classes !== 'boolean') throw new ConfigError(`${where}classes must be true or false`);
    settings.classes = from.classes;
  }
  if ('classPrefix' in from) {
    if (typeof from.classPrefix !== 'string') throw new ConfigError(`${where}classPrefix must be a string`);
    settings.classPrefix = from.classPrefix;
  }
}

/** Resolves rule levels and options for one file from a config object. */
export function resolveSettings(config = {}, relPath = '') {
  const settings = { persian: 'auto', classes: true, classPrefix: '', lang: 'en', rules: {} };
  for (const r of rules) settings.rules[r.id] = { level: r.meta.level, options: {} };
  applyScalars(settings, config, '');
  applyRules(settings.rules, config.rules, 'rules');
  for (const [i, o] of (config.overrides ?? []).entries()) {
    if (!o.files) throw new ConfigError(`overrides[${i}] needs a "files" glob`);
    if (!matchAny(relPath, o.files) || matchAny(relPath, o.excludedFiles ?? [])) continue;
    applyScalars(settings, o, `overrides[${i}].`);
    applyRules(settings.rules, o.rules, `overrides[${i}].rules`);
  }
  return settings;
}

/** Applies rule levels on top of resolved settings (used for CLI flags, which win over the config). */
export function applyRuleOverrides(settings, entries) {
  applyRules(settings.rules, entries, '--rule');
  return settings;
}

/**
 * Lints a string. `filePath` decides the file kind (by extension) and is
 * matched against config overrides.
 */
export function lintText(text, { filePath = 'input.txt', config = {}, settings, reportUnusedDirectives = false } = {}) {
  const resolved = settings ?? resolveSettings(config, filePath);
  const file = createFile(text, filePath, resolved);
  const directives = parseDirectives(text, file.lineStarts);
  const messages = [];
  const seen = new Set();
  for (const rule of rules) {
    const rs = resolved.rules[rule.id];
    if (!rs || rs.level === 'off') continue;
    const severity = rs.level === 'error' ? 2 : 1;
    const found = [];
    try {
      rule.check(file, (p) => found.push(p), rs.options ?? {});
    } catch (err) {
      // One broken rule must not hide every other rule's results.
      messages.push({
        ruleId: rule.id,
        severity: 2,
        fatal: true,
        message: `rtlint internal error in ${rule.id}: ${err?.message ?? err}. Please report it at https://github.com/pouyamsmartcity/rtlint/issues`,
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
      });
      continue;
    }
    found.forEach(
      (p) => {
        const start = position(file.lineStarts, p.index);
        if (directives.suppressed(rule.id, start.line)) return;
        const key = `${rule.id}:${p.index}:${p.length}`;
        if (seen.has(key)) return;
        seen.add(key);
        const end = position(file.lineStarts, p.index + Math.max(p.length, 0));
        const message = {
          ruleId: rule.id,
          severity,
          message: resolved.lang === 'fa' && p.fa ? p.fa : p.message,
          line: start.line,
          column: start.column,
          endLine: end.line,
          endColumn: end.column,
        };
        if (p.fix && rule.meta.fixable) {
          message.fix = { range: p.fix.range ?? [p.index, p.index + p.length], text: p.fix.text };
        }
        messages.push(message);
      },
    );
  }
  if (reportUnusedDirectives) {
    for (const d of directives.unused()) {
      const start = position(file.lineStarts, d.index);
      const end = position(file.lineStarts, d.index + d.length);
      const target = d.rule === '*' ? '' : ` for ${d.rule}`;
      messages.push({
        ruleId: 'unused-disable-directive',
        severity: 1,
        message: `Unused rtlint-${d.kind}${target}: nothing was reported here. Remove it.`,
        line: start.line,
        column: start.column,
        endLine: end.line,
        endColumn: end.column,
      });
      if (resolved.lang === 'fa') {
        messages[messages.length - 1].message = `دستور rtlint-${d.kind}${d.rule === '*' ? '' : ` برای ${d.rule}`} بی\u200Cاستفاده است: این\u200Cجا مشکلی گزارش نشده؛ حذفش کنید.`;
      }
    }
  }
  messages.sort((a, b) => a.line - b.line || a.column - b.column || a.ruleId.localeCompare(b.ruleId));
  return summarize(filePath, messages);
}

export function summarize(filePath, messages) {
  const count = (sev, fixable) =>
    messages.filter((m) => m.severity === sev && (!fixable || m.fix)).length;
  return {
    filePath,
    messages,
    errorCount: count(2),
    warningCount: count(1),
    fixableErrorCount: count(2, true),
    fixableWarningCount: count(1, true),
  };
}

/** Applies non-overlapping fixes in one pass. */
export function applyFixes(text, messages) {
  const fixes = messages
    .filter((m) => m.fix)
    .map((m) => m.fix)
    .sort((a, b) => a.range[0] - b.range[0] || a.range[1] - b.range[1]);
  let out = '';
  let pos = 0;
  for (const { range, text: replacement } of fixes) {
    if (range[0] < pos) continue;
    out += text.slice(pos, range[0]) + replacement;
    pos = range[1];
  }
  return out + text.slice(pos);
}

/**
 * Lints and fixes a string, re-linting after each pass (up to 10) because one
 * fix can expose another. Returns the lint result for the fixed output.
 */
export function fixText(text, options = {}) {
  const { filter } = options;
  const settings = options.settings ?? resolveSettings(options.config, options.filePath);
  let output = text;
  for (let pass = 0; pass < 10; pass++) {
    const result = lintText(output, { ...options, settings });
    const fixable = result.messages.filter((m) => m.fix && (!filter || filter(m)));
    if (!fixable.length) break;
    const next = applyFixes(output, fixable);
    if (next === output) break;
    output = next;
  }
  const result = lintText(output, { ...options, settings });
  return { ...result, output, fixed: output !== text };
}

export function listRules() {
  return rules.map((r) => ({ id: r.id, ...r.meta, descriptionFa: DESCRIPTIONS_FA[r.id] }));
}

export function getRule(id) {
  return ruleMap.get(id);
}
