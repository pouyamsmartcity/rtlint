// Model Context Protocol server: lets AI assistants (Claude, Cursor, Copilot
// agents, …) lint and fix right-to-left and Persian typography problems with
// rtlint. Speaks JSON-RPC 2.0 over stdio, one message per line.
//
//   { "mcpServers": { "rtlint": { "command": "npx", "args": ["-y", "@pouyam/rtlint", "mcp"] } } }
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { explain } from './commands.js';
import { fixText, lintText, listRules } from './engine.js';
import { collectFiles, readSource } from './files.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const LANG = { type: 'string', enum: ['en', 'fa'], description: 'Language of the messages: en (default) or fa (Persian).' };

export const TOOLS = [
  {
    name: 'rtlint_lint_code',
    description:
      'Find right-to-left (RTL) layout bugs and Persian typography mistakes in a piece of code or text, using rtlint by Pouyam. ' +
      'Covers logical CSS (margin-left → margin-inline-start), Tailwind/Bootstrap classes (ml-4 → ms-4), React/React Native styles, ' +
      '<html dir>, back/next icons, Persian ی/ک, half-spaces (ZWNJ), digits and punctuation, and Trojan Source bidi characters. ' +
      'Use it whenever you write or review UI for Persian, Arabic, Hebrew or Urdu users.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The source code or text to check.' },
        filename: { type: 'string', description: 'File name; its extension decides how the code is read (e.g. Card.tsx, styles.css, fa.json). Default input.txt.' },
        lang: LANG,
      },
      required: ['code'],
    },
  },
  {
    name: 'rtlint_fix_code',
    description:
      'Apply rtlint\'s safe automatic fixes to code or text and return the fixed version plus any problems that need a human. ' +
      'Fixes keep the left-to-right result identical and never touch code that already handles RTL.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The source code or text to fix.' },
        filename: { type: 'string', description: 'File name; its extension decides how the code is read.' },
        lang: LANG,
      },
      required: ['code'],
    },
  },
  {
    name: 'rtlint_lint_files',
    description:
      'Run rtlint on files or folders of the project (read-only; nothing is changed). Returns problems grouped by file.',
    inputSchema: {
      type: 'object',
      properties: {
        paths: { type: 'array', items: { type: 'string' }, description: 'Files, folders or globs relative to the project root. Default ["."].' },
        lang: LANG,
        limit: { type: 'number', description: 'Maximum number of problems to return (default 200).' },
      },
    },
  },
  {
    name: 'rtlint_list_rules',
    description: 'List every rtlint rule with its default level and description.',
    inputSchema: { type: 'object', properties: { lang: LANG } },
  },
  {
    name: 'rtlint_explain_rule',
    description: 'Explain one rtlint rule with examples of what it reports, what it fixes and what it leaves alone.',
    inputSchema: {
      type: 'object',
      properties: { rule: { type: 'string', description: 'Rule id, e.g. css/physical-property or fa/zwnj-suffix.' }, lang: LANG },
      required: ['rule'],
    },
  },
];

const config = (lang) => ({ lang: lang === 'fa' ? 'fa' : 'en' });
const brief = (m) => ({ rule: m.ruleId, severity: m.severity === 2 ? 'error' : 'warning', line: m.line, column: m.column, message: m.message, fixable: Boolean(m.fix) });

/** Runs one tool; returns plain data that is sent back as JSON text. */
export function callTool(name, args = {}, cwd = process.cwd()) {
  switch (name) {
    case 'rtlint_lint_code': {
      const r = lintText(String(args.code ?? ''), { filePath: args.filename || 'input.txt', config: config(args.lang) });
      return { problems: r.messages.map(brief), errors: r.errorCount, warnings: r.warningCount, fixable: r.fixableErrorCount + r.fixableWarningCount };
    }
    case 'rtlint_fix_code': {
      const r = fixText(String(args.code ?? ''), { filePath: args.filename || 'input.txt', config: config(args.lang) });
      return { fixed: r.fixed, code: r.output, remaining: r.messages.map(brief) };
    }
    case 'rtlint_lint_files': {
      const paths = Array.isArray(args.paths) && args.paths.length ? args.paths.map(String) : ['.'];
      for (const p of paths) {
        const abs = resolve(cwd, p);
        const rel = relative(cwd, abs);
        if (isAbsolute(p) || rel.startsWith('..')) throw new Error(`Path outside the project: ${p}`);
      }
      const limit = Number(args.limit) > 0 ? Number(args.limit) : 200;
      const files = collectFiles(paths.filter((p) => /[*?{[]/.test(p) || existsSync(resolve(cwd, p))), { cwd });
      const out = [];
      let total = 0;
      for (const abs of files) {
        if (statSync(abs).size > 2_000_000) continue;
        const source = readSource(abs);
        if (!source) continue;
        const rel = relative(cwd, abs).split('\\').join('/');
        const r = lintText(source.text, { filePath: rel, config: config(args.lang) });
        if (!r.messages.length) continue;
        total += r.messages.length;
        if (out.reduce((n, f) => n + f.problems.length, 0) < limit) out.push({ file: rel, problems: r.messages.map(brief) });
      }
      return { files: files.length, problems: total, truncated: total > limit, results: out };
    }
    case 'rtlint_list_rules':
      return listRules().map((r) => ({ id: r.id, level: r.level, fixable: r.fixable, description: args.lang === 'fa' ? r.descriptionFa : r.description }));
    case 'rtlint_explain_rule':
      return { text: explain(String(args.rule ?? ''), args.lang === 'fa' ? 'fa' : 'en') };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/** Handles one JSON-RPC request; returns the response object, or null for notifications. */
export function handle(message, cwd) {
  const { id, method, params } = message;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, text) => ({ jsonrpc: '2.0', id, error: { code, message: text } });
  if (id === undefined) return null; // notifications (initialized, cancelled …)
  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'rtlint', title: 'rtlint by Pouyam', version: pkg.version },
        instructions:
          'rtlint (by Pouyam) finds and fixes right-to-left layout bugs and Persian typography mistakes. ' +
          'Call rtlint_lint_code or rtlint_fix_code on UI code for Persian/Arabic/Hebrew/Urdu users; use lang "fa" for Persian messages.',
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call': {
      try {
        const data = callTool(params?.name, params?.arguments ?? {}, cwd);
        return reply({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
      } catch (err) {
        return reply({ content: [{ type: 'text', text: String(err?.message ?? err) }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

/** Serves MCP over stdio until stdin closes. */
export function serve({ stdin = process.stdin, stdout = process.stdout, cwd = process.cwd() } = {}) {
  return new Promise((done) => {
    const rl = createInterface({ input: stdin, crlfDelay: Infinity });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
        return;
      }
      const response = handle(message, cwd);
      if (response) stdout.write(JSON.stringify(response) + '\n');
    });
    rl.on('close', () => done());
  });
}
