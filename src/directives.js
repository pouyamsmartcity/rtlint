import { position } from './file.js';

const DIRECTIVE = /rtlint-(disable-next-line|disable-line|disable-file|disable|enable)(?![\w-])([^\n]*)/g;
const RULE_TOKEN = /^(?:\*|[\w-]+\/[\w*-]+)$/;
// What may come right before a directive: a comment opener, optionally the
// "*" of a block-comment continuation line, then whitespace.
const OPENER = /(?:\/\/+|\/\*+!?|<!--|\{\/\*+|\{#|\{%-?|#+|--|^\s*\*+)\s*$/;

/** Rule ids listed after a directive, up to a comment end or a "--" description. */
function ruleList(rest) {
  // "/* rtlint-disable fa/*/" ends the comment right after the wildcard.
  const cut = rest.replace(/\/\*\//g, '/* */').split(/\*\/|-->|--|\}|#}|%}/)[0];
  const ids = cut
    .split(/[\s,]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => RULE_TOKEN.test(t));
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
 * They must start a comment in any syntax (// /* <!-- {/* # {# {% --), so a
 * mention in prose or in a string does nothing.
 */
export function parseDirectives(text, starts) {
  // Every rule pattern of every directive is one entry, so unused ones can be reported.
  const entries = [];
  const open = [];
  if (!text.includes('rtlint-')) return { suppressed: () => false, unused: () => [] };
  for (const m of text.matchAll(DIRECTIVE)) {
    const { line } = position(starts, m.index);
    const prefix = text.slice(starts[line - 1], m.index);
    if (!OPENER.test(prefix)) continue;
    const blockComment = /\/\*|<!--|^\s*\*/.test(prefix);
    const kind = m[1];
    const rules = ruleList(m[2]);
    const add = (from, to) => {
      for (const rule of rules) entries.push({ rule, from, to, index: m.index, length: m[0].trimEnd().length, kind, used: false });
    };
    if (kind === 'disable-file') add(1, Infinity);
    else if (kind === 'disable-line') add(line, line);
    else if (kind === 'disable-next-line') {
      // In a block comment that spans lines, "next line" is the one after it ends.
      let target = line + 1;
      const end = blockComment ? text.slice(m.index).search(/\*\/|-->/) : -1;
      if (end >= 0) target = position(starts, m.index + end).line + 1;
      add(target, target);
    } else if (kind === 'disable') {
      for (const rule of rules) {
        const entry = { rule, from: line, to: Infinity, index: m.index, length: m[0].trimEnd().length, kind, used: false };
        entries.push(entry);
        open.push(entry);
      }
    } else {
      for (let i = open.length - 1; i >= 0; i--) {
        if (rules.includes('*') || rules.includes(open[i].rule)) {
          open[i].to = line;
          open.splice(i, 1);
        }
      }
    }
  }
  return {
    suppressed(id, line) {
      let hit = false;
      for (const e of entries) {
        if (line >= e.from && line <= e.to && ruleMatches(e.rule, id)) {
          e.used = true;
          hit = true;
        }
      }
      return hit;
    },
    /** Directives that suppressed nothing, as { index, length, rule, kind }. */
    unused() {
      return entries.filter((e) => !e.used);
    },
  };
}
