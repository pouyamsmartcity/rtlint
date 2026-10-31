import { parseDirectives, ruleMatches } from './directives.js';
import { createFile, position } from './file.js';
import { matchAny } from './glob.js';
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

const SCALARS = ['persian', 'classes', 'classPrefix'];

/** Resolves rule levels and options for one file from a config object. */
export function resolveSettings(config = {}, relPath = '') {
  const settings = { persian: 'auto', classes: true, classPrefix: '', rules: {} };
  for (const r of rules) settings.rules[r.id] = { level: r.meta.level, options: {} };
  for (const key of SCALARS) if (key in config) settings[key] = config[key];
  applyRules(settings.rules, config.rules, 'rules');
  for (const [i, o] of (config.overrides ?? []).entries()) {
    if (!o.files) throw new ConfigError(`overrides[${i}] needs a "files" glob`);
    if (!matchAny(relPath, o.files) || matchAny(relPath, o.excludedFiles ?? [])) continue;
    for (const key of SCALARS) if (key in o) settings[key] = o[key];
    applyRules(settings.rules, o.rules, `overrides[${i}].rules`);
  }
  return settings;
}

/**
 * Lints a string. `filePath` decides the file kind (by extension) and is
 * matched against config overrides.
 */
export function lintText(text, { filePath = 'input.txt', config = {}, settings } = {}) {
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
          message: p.message,
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
  return rules.map((r) => ({ id: r.id, ...r.meta }));
}

export function getRule(id) {
  return ruleMap.get(id);
}
