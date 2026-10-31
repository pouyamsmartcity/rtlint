import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { fixText, lintText, resolveSettings } from '../src/core.js';
import { collectFiles } from '../src/files.js';
import { globToRegExp } from '../src/glob.js';
import { run } from '../src/cli.js';

const ids = (text, filePath, config) => lintText(text, { filePath, config }).messages.map((m) => m.ruleId);

test('directives: next-line, line, block and file', () => {
  const css = [
    '/* rtlint-disable-next-line css/physical-property */',
    'a { margin-left: 1px; }',
    'b { margin-left: 1px; } /* rtlint-disable-line */',
    '/* rtlint-disable css/* */',
    'c { margin-left: 1px; }',
    '/* rtlint-enable */',
    'd { margin-left: 1px; }',
  ].join('\n');
  const r = lintText(css, { filePath: 'a.css' });
  assert.deepEqual(r.messages.map((m) => m.line), [7]);
  assert.deepEqual(ids('<!-- rtlint-disable-file -->\n<html lang="fa">', 'a.html'), []);
  assert.deepEqual(ids('{/* rtlint-disable-next-line class/physical-utility -- legacy */}\n<div className="ml-2" />', 'a.jsx'), []);
});

test('config: levels, wildcards, overrides, validation', () => {
  const config = {
    rules: { 'fa/*': 'off', 'css/physical-property': 'error' },
    overrides: [{ files: ['legacy/**'], rules: { 'css/*': 'off' } }],
  };
  const s = resolveSettings(config, 'src/a.css');
  assert.equal(s.rules['fa/kashida'].level, 'off');
  assert.equal(s.rules['css/physical-property'].level, 'error');
  assert.equal(resolveSettings(config, 'legacy/x/a.css').rules['css/physical-property'].level, 'off');
  assert.throws(() => resolveSettings({ rules: { 'css/nope': 'warn' } }), /unknown rule/);
  assert.throws(() => resolveSettings({ rules: { 'fa/kashida': 'loud' } }), /invalid level/);
  const r = lintText('a{margin-left:0}', { filePath: 'a.css', config });
  assert.equal(r.errorCount, 1);
});

test('fixText converges across passes and reports what is left', () => {
  const r = fixText('<html lang="fa"><p style="margin: 0 1px 0 2px; left: 50%; transform: translate(-50%)">', { filePath: 'a.html' });
  assert.equal(r.fixed, true);
  assert.match(r.output, /dir="rtl"/);
  assert.match(r.output, /margin-inline: 2px 1px/);
  assert.equal(r.messages.length, 1);
  assert.match(r.messages[0].message, /centering/);
});

test('positions are 1-based and cover the problem', () => {
  const [m] = lintText('a {\n  margin-left: 0;\n}', { filePath: 'a.css' }).messages;
  assert.deepEqual([m.line, m.column, m.endLine, m.endColumn], [2, 3, 2, 14]);
});

test('glob matching', () => {
  assert.ok(globToRegExp('**/node_modules/**').test('a/node_modules/b.js'));
  assert.ok(globToRegExp('**/node_modules/**').test('node_modules/'));
  assert.ok(globToRegExp('dist/').test('pkg/dist/x.js'));
  assert.ok(globToRegExp('/dist').test('dist'));
  assert.ok(!globToRegExp('/dist').test('a/dist'));
  assert.ok(globToRegExp('src/**/*.{css,scss}').test('src/a/b.scss'));
  assert.ok(globToRegExp('*.min.js').test('a/b/c.min.js'));
});

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'rtlint-'));
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'node_modules', 'x'), { recursive: true });
  mkdirSync(join(dir, 'generated'));
  writeFileSync(join(dir, 'src', 'a.css'), '.a { margin-left: 4px; }\n');
  writeFileSync(join(dir, 'src', 'b.md'), 'این يك متن است\n');
  writeFileSync(join(dir, 'src', 'logo.png'), Buffer.from([0x89, 0x50, 0, 0]));
  writeFileSync(join(dir, 'node_modules', 'x', 'c.css'), '.c { margin-left: 4px; }\n');
  writeFileSync(join(dir, 'generated', 'd.css'), '.d { margin-left: 4px; }\n');
  writeFileSync(join(dir, '.gitignore'), 'generated/\n');
  return dir;
}

function sink() {
  let data = '';
  const stream = new Writable({ write(chunk, _enc, cb) { data += chunk; cb(); } });
  stream.text = () => data;
  return stream;
}

test('collectFiles honours default ignores and .gitignore', () => {
  const dir = project();
  const files = collectFiles(['.'], { cwd: dir }).map((f) => f.slice(dir.length + 1).replace(/\\/g, '/'));
  assert.deepEqual(files, ['src/a.css', 'src/b.md']);
});

test('cli: report, exit codes, --fix, formats', async () => {
  const dir = project();
  let out = sink();
  assert.equal(await run(['src', '-f', 'compact'], { cwd: dir, stdout: out, stderr: sink() }), 1);
  assert.match(out.text(), /src\/a\.css:1:6: warning .*css\/physical-property/);
  assert.match(out.text(), /src\/b\.md:1:5: error .*fa\/arabic-letters/);

  out = sink();
  assert.equal(await run(['src', '--rule', 'fa/*=off', '-f', 'json'], { cwd: dir, stdout: out, stderr: sink() }), 0);
  assert.equal(JSON.parse(out.text()).length, 2);

  out = sink();
  await run(['src', '-f', 'sarif'], { cwd: dir, stdout: out, stderr: sink() });
  const sarif = JSON.parse(out.text());
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].results.length, 2);

  out = sink();
  await run(['src', '-f', 'github'], { cwd: dir, stdout: out, stderr: sink() });
  assert.match(out.text(), /^::warning file=src\/a\.css,line=1,col=6,/m);

  assert.equal(await run(['src', '--fix'], { cwd: dir, stdout: sink(), stderr: sink() }), 0);
  assert.equal(readFileSync(join(dir, 'src', 'a.css'), 'utf8'), '.a { margin-inline-start: 4px; }\n');
  assert.equal(readFileSync(join(dir, 'src', 'b.md'), 'utf8'), 'این یک متن است\n');
});

test('cli: config file and usage errors', async () => {
  const dir = project();
  writeFileSync(join(dir, 'rtlint.config.json'), JSON.stringify({ rules: { 'css/*': 'off', 'fa/*': 'off' } }));
  assert.equal(await run(['src'], { cwd: dir, stdout: sink(), stderr: sink() }), 0);
  const err = sink();
  assert.equal(await run(['--bogus'], { cwd: dir, stdout: sink(), stderr: err }), 2);
  assert.match(err.text(), /Unknown option/);
  writeFileSync(join(dir, 'rtlint.config.json'), JSON.stringify({ rules: { 'nope/x': 'off' } }));
  assert.equal(await run(['src'], { cwd: dir, stdout: sink(), stderr: sink() }), 2);
});

test('cli: --max-warnings and --quiet', async () => {
  const dir = project();
  assert.equal(await run(['src/a.css', '--max-warnings', '0'], { cwd: dir, stdout: sink(), stderr: sink() }), 1);
  assert.equal(await run(['src/a.css', '--max-warnings', '5'], { cwd: dir, stdout: sink(), stderr: sink() }), 0);
  const out = sink();
  await run(['src/a.css', '--quiet'], { cwd: dir, stdout: out, stderr: sink() });
  assert.equal(out.text(), '');
});
