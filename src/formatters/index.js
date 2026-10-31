import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { listRules } from '../engine.js';

const REPO = 'https://github.com/pouyamsmartcity/rtlint';
export const ruleDocs = (id) => `${REPO}/blob/main/docs/rules.md#${id.replace('/', '')}`;

const posix = (p) => p.split('\\').join('/');
const rel = (file, cwd) => posix(relative(cwd, file) || file);

function colors(enabled) {
  const wrap = (open, close) => (s) => (enabled ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));
  return {
    red: wrap(31, 39),
    yellow: wrap(33, 39),
    green: wrap(32, 39),
    dim: wrap(2, 22),
    bold: wrap(1, 22),
    underline: wrap(4, 24),
  };
}

function totals(results) {
  const t = { errors: 0, warnings: 0, fixable: 0 };
  for (const r of results) {
    t.errors += r.errorCount;
    t.warnings += r.warningCount;
    t.fixable += r.fixableErrorCount + r.fixableWarningCount;
  }
  return t;
}

export function stylish(results, { cwd = process.cwd(), color = false } = {}) {
  const c = colors(color);
  let out = '';
  for (const r of results) {
    if (!r.messages.length) continue;
    out += '\n' + c.underline(rel(r.filePath, cwd)) + '\n';
    const w = Math.max(...r.messages.map((m) => `${m.line}:${m.column}`.length));
    for (const m of r.messages) {
      const where = `${m.line}:${m.column}`.padEnd(w);
      const sev = m.severity === 2 ? c.red('error'.padEnd(7)) : c.yellow('warning');
      out += `  ${c.dim(where)}  ${sev}  ${m.message}  ${c.dim(m.ruleId + (m.fix ? ' ✎' : ''))}\n`;
    }
  }
  const t = totals(results);
  const problems = t.errors + t.warnings;
  if (!problems) return '';
  const summary = `✖ ${problems} problem${problems === 1 ? '' : 's'} (${t.errors} error${t.errors === 1 ? '' : 's'}, ${t.warnings} warning${t.warnings === 1 ? '' : 's'})`;
  out += '\n' + c.bold(t.errors ? c.red(summary) : c.yellow(summary)) + '\n';
  if (t.fixable) out += c.dim(`  ${t.fixable} fixable with the --fix option (✎).`) + '\n';
  return out;
}

export function compact(results, { cwd = process.cwd() } = {}) {
  return results
    .flatMap((r) =>
      r.messages.map(
        (m) => `${rel(r.filePath, cwd)}:${m.line}:${m.column}: ${m.severity === 2 ? 'error' : 'warning'} ${m.message} [${m.ruleId}]`,
      ),
    )
    .join('\n')
    .concat(results.some((r) => r.messages.length) ? '\n' : '');
}

export function json(results, { cwd = process.cwd() } = {}) {
  return JSON.stringify(results.map((r) => ({ ...r, filePath: rel(r.filePath, cwd) })), null, 2) + '\n';
}

function escapeData(s) {
  return String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}
function escapeProperty(s) {
  return escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

/** GitHub Actions workflow commands: annotations on the pull request diff. */
export function github(results, { cwd = process.cwd() } = {}) {
  let out = '';
  for (const r of results) {
    for (const m of r.messages) {
      const props = [
        `file=${escapeProperty(rel(r.filePath, cwd))}`,
        `line=${m.line}`,
        `col=${m.column}`,
        `endLine=${m.endLine}`,
        `endColumn=${m.endColumn}`,
        `title=${escapeProperty(`rtlint ${m.ruleId}`)}`,
      ].join(',');
      out += `::${m.severity === 2 ? 'error' : 'warning'} ${props}::${escapeData(m.message)}\n`;
    }
  }
  return out;
}

/**
 * A SARIF artifact URI: relative and percent-encoded per segment inside the
 * working directory (so "#" or "%" in a name stay part of the path), an
 * absolute file:// URL outside it.
 */
function sarifUri(filePath, cwd) {
  const relPath = relative(cwd, filePath);
  if (!relPath || relPath.startsWith('..') || isAbsolute(relPath)) return pathToFileURL(resolve(cwd, filePath)).href;
  return posix(relPath).split('/').map(encodeURIComponent).join('/');
}

/** SARIF 2.1.0 for GitHub code scanning and other security dashboards. */
export function sarif(results, { cwd = process.cwd(), version = '0.0.0' } = {}) {
  const rules = listRules();
  const index = new Map(rules.map((r, i) => [r.id, i]));
  const doc = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'rtlint',
            version,
            informationUri: REPO,
            rules: rules.map((r) => ({
              id: r.id,
              shortDescription: { text: r.description },
              helpUri: ruleDocs(r.id),
              defaultConfiguration: { level: r.level === 'error' ? 'error' : 'warning' },
              properties: { tags: r.id.startsWith('security/') ? ['security'] : ['i18n', 'rtl'] },
            })),
          },
        },
        results: results.flatMap((r) =>
          r.messages.map((m) => ({
            ruleId: m.ruleId,
            ruleIndex: index.get(m.ruleId),
            level: m.severity === 2 ? 'error' : 'warning',
            message: { text: m.message },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: sarifUri(r.filePath, cwd) },
                  region: {
                    startLine: m.line,
                    startColumn: m.column,
                    endLine: m.endLine,
                    endColumn: m.endColumn,
                  },
                },
              },
            ],
          })),
        ),
      },
    ],
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

export const formatters = { stylish, compact, json, github, sarif };
