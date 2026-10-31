import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// A baseline records the problems a codebase already has, so a team can turn
// rtlint on today and only be told about new problems. Problems are matched by
// rule and the text of their line, not by line number, so editing other parts
// of a file does not make old problems reappear.

function fingerprint(ruleId, lineText) {
  return createHash('sha1').update(ruleId).update('\0').update(lineText.trim()).digest('hex').slice(0, 16);
}

/** Builds baseline data from lint results; `textOf(filePath)` returns the linted text. */
export function createBaseline(results, relPath, textOf) {
  const files = {};
  for (const r of results) {
    if (!r.messages.length) continue;
    const lines = textOf(r.filePath).split('\n');
    const counts = {};
    for (const m of r.messages) {
      const fp = fingerprint(m.ruleId, lines[m.line - 1] ?? '');
      counts[fp] = (counts[fp] ?? 0) + 1;
    }
    files[relPath(r.filePath)] = counts;
  }
  return { version: 1, files };
}

export function readBaseline(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeBaseline(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

/** Removes problems recorded in the baseline from a result (each recorded problem hides one occurrence). */
export function applyBaseline(result, baseline, rel, text) {
  const known = { ...(baseline?.files?.[rel] ?? {}) };
  if (!Object.keys(known).length) return result;
  const lines = text.split('\n');
  const messages = result.messages.filter((m) => {
    const fp = fingerprint(m.ruleId, lines[m.line - 1] ?? '');
    if (known[fp] > 0) {
      known[fp]--;
      return false;
    }
    return true;
  });
  const count = (sev, fixable) => messages.filter((m) => m.severity === sev && (!fixable || m.fix)).length;
  return {
    ...result,
    messages,
    errorCount: count(2),
    warningCount: count(1),
    fixableErrorCount: count(2, true),
    fixableWarningCount: count(1, true),
  };
}
