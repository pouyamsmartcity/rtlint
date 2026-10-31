import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { callTool, handle, TOOLS } from '../src/mcp.js';
import { lintFiles } from '../src/index.js';
import rtlintVite from '../src/vite.js';

test('MCP: initialize, tools/list and every tool', () => {
  const init = handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.serverInfo.name, 'rtlint');
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.deepEqual(init.result.capabilities, { tools: {} });
  assert.equal(handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const list = handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), TOOLS.map((t) => t.name));
  for (const t of TOOLS) assert.equal(t.inputSchema.type, 'object');

  const lint = callTool('rtlint_lint_code', { code: '.a{margin-left:1px}', filename: 'a.css', lang: 'fa' });
  assert.equal(lint.problems[0].rule, 'css/physical-property');
  assert.match(lint.problems[0].message, /فیزیکی/);
  assert.equal(callTool('rtlint_fix_code', { code: 'پژوهش يك', filename: 'a.md' }).code, 'پژوهش یک');
  assert.ok(callTool('rtlint_list_rules', {}).length >= 38);
  assert.match(callTool('rtlint_explain_rule', { rule: 'fa/zwnj-suffix' }).text, /comparatives/);

  const bad = handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'nope', arguments: {} } });
  assert.equal(bad.result.isError, true);
  assert.equal(handle({ jsonrpc: '2.0', id: 4, method: 'resources/list' }).error.code, -32601);
});

test('MCP: rtlint_lint_files stays inside the project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rtlint-mcp-'));
  writeFileSync(join(dir, 'a.css'), '.a { margin-left: 1px; }\n');
  const r = callTool('rtlint_lint_files', { paths: ['.'] }, dir);
  assert.equal(r.problems, 1);
  assert.equal(r.results[0].file, 'a.css');
  assert.throws(() => callTool('rtlint_lint_files', { paths: ['../'] }, dir), /outside the project/);
});

test('MCP: the binary speaks JSON-RPC over stdio', async () => {
  const child = spawn(process.execPath, [new URL('../bin/rtlint.js', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), 'mcp'], { stdio: ['pipe', 'pipe', 'inherit'] });
  let out = '';
  child.stdout.on('data', (c) => (out += c));
  child.stdin.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n');
  child.stdin.write('not json\n');
  child.stdin.write('{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"rtlint_fix_code","arguments":{"code":"<div class=\\"ml-2\\"></div>","filename":"a.html"}}}\n');
  child.stdin.end();
  await new Promise((r) => child.on('close', r));
  const lines = out.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines[0].result.serverInfo.title, 'rtlint by Pouyam');
  assert.equal(lines[1].error.code, -32700);
  assert.match(lines[2].result.content[0].text, /ms-2/);
});

test('Vite plugin warns per module and can fail the build', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rtlint-vite-'));
  const plugin = rtlintVite({ lang: 'fa', failOnError: true });
  const warnings = [];
  const errors = [];
  const ctx = { warn: (m) => warnings.push(m), error: (m) => errors.push(m) };
  plugin.configResolved({ root: dir, command: 'serve' });
  plugin.transform.call(ctx, '.a { margin-left: 1px; }', join(dir, 'a.css'));
  plugin.transform.call(ctx, '.a { margin-left: 1px; }', join(dir, 'a.css'));
  plugin.transform.call(ctx, 'x', join(dir, 'node_modules', 'x', 'a.css'));
  plugin.transform.call(ctx, 'x', '\0virtual:module');
  assert.equal(warnings.length, 1, 'same content is reported once; node_modules and virtual modules are skipped');
  assert.match(warnings[0], /a\.css:1:6 .*فیزیکی/);
  plugin.configResolved({ root: dir, command: 'build' });
  plugin.transform.call(ctx, '<html lang="fa"></html>', join(dir, 'index.html'));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /html\/dir-attribute/);
});

test('lintFiles API', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rtlint-api-'));
  writeFileSync(join(dir, 'a.css'), '.a { margin-left: 1px; }\n');
  const results = await lintFiles(['.'], { cwd: dir, lang: 'fa' });
  assert.equal(results.length, 1);
  assert.match(results[0].messages[0].message, /فیزیکی/);
  await lintFiles(['.'], { cwd: dir, fix: true });
  assert.equal(readFileSync(join(dir, 'a.css'), 'utf8'), '.a { margin-inline-start: 1px; }\n');
});

test('pre-commit hooks and the GitHub Action declare their inputs', () => {
  const hooks = readFileSync(new URL('../.pre-commit-hooks.yaml', import.meta.url), 'utf8');
  assert.match(hooks, /- id: rtlint\n/);
  assert.match(hooks, /- id: rtlint-fix\n/);
  const action = readFileSync(new URL('../action.yml', import.meta.url), 'utf8');
  for (const input of ['paths', 'args', 'lang', 'changed-only', 'summary', 'sarif']) assert.match(action, new RegExp(`\n  ${input}:\n`));
});
