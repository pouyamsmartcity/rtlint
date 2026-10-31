import { position } from './file.js';

const DIRECTIVE = /rtlint-(disable-next-line|disable-line|disable-file|disable|enable)(?![\w-])([^\n]*)/g;
const RULE_TOKEN = /^(?:\*|[a-z]+\/(?:\*|[a-z0-9-]+))$/;

/** Rule ids listed after a directive, up to a comment end or a "--" description. */
function ruleList(rest) {
  const cut = rest.split(/\*\/|-->|--|\}|#}|%}/)[0];
  const ids = cut.split(/[\s,]+/).filter((t) => RULE_TOKEN.test(t));
  return ids.length ? ids : ['*'];
}

export function ruleMatches(pattern, id) {
  if (pattern === '*' || pattern === id) return true;
  return pattern.endsWith('/*') && id.startsWith(pattern.slice(0, -1));
}

/**
 * Parses inline directives:
 *   rtlint-disable-file [rules]
 *   rtlint-disable [rules] … rtlint-enable [rules]
 *   rtlint-disable-line [rules]
 *   rtlint-disable-next-line [rules]
 * They work in any comment syntax (// /* <!-- {/* # {# …).
 */
export function parseDirectives(text, starts) {
  const file = [];
  const lines = new Map();
  const blocks = [];
  const open = [];
  if (!text.includes('rtlint-')) return { suppressed: () => false };
  for (const m of text.matchAll(DIRECTIVE)) {
    const kind = m[1];
    const rules = ruleList(m[2]);
    const { line } = position(starts, m.index);
    if (kind === 'disable-file') file.push(...rules);
    else if (kind === 'disable-line' || kind === 'disable-next-line') {
      const target = kind === 'disable-line' ? line : line + 1;
      lines.set(target, [...(lines.get(target) ?? []), ...rules]);
    } else if (kind === 'disable') {
      for (const r of rules) open.push({ rule: r, from: line });
    } else {
      for (let i = open.length - 1; i >= 0; i--) {
        if (rules.includes('*') || rules.includes(open[i].rule)) {
          blocks.push({ ...open[i], to: line });
          open.splice(i, 1);
        }
      }
    }
  }
  for (const o of open) blocks.push({ ...o, to: Infinity });
  return {
    suppressed(id, line) {
      if (file.some((p) => ruleMatches(p, id))) return true;
      if ((lines.get(line) ?? []).some((p) => ruleMatches(p, id))) return true;
      return blocks.some((b) => line >= b.from && line <= b.to && ruleMatches(b.rule, id));
    },
  };
}
