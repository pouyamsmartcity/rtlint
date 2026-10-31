// CLI features added in 0.3: init, explain, --changed/--staged, --cache,
// baselines, --fix-only, unused directives, --stats, --print-config, --watch
// and the new report formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { run } from '../src/cli.js';

function sink() {
  let data = '';
  const stream = new Writable({ write(chunk, _enc, cb) { data += chunk; cb(); } });
  stream.text = () => data;
  return stream;
}

async function cli(args, cwd, extra = {}) {
  const stdout = sink();
  const stderr = sink();
  const code = await run(args, { cwd, stdout, stderr, ...extra });
  return { code, out: stdout.text(), err: stderr.text() };
}

function project(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rtlint-v3-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

const git = (dir, ...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });

test('init detects the project and writes a config and an npm script', async () => {
  const dir = project({
    'package.json': JSON.stringify({ name: 'x', devDependencies: { tailwindcss: '^3.4.1', react: '18' } }, null, 2),
    'messages/fa.json': '{"hi": "سلام"}',
  });
  const r = await cli(['init'], dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /rtlint\.config\.json/);
  const config = JSON.parse(readFileSync(join(dir, 'rtlint.config.json'), 'utf8'));
  assert.equal(config.lang, 'fa');
  assert.equal(config.rules['class/space-reverse'], 'warn');
  assert.match(config.$schema, /schema\/config\.json$/);
  assert.equal(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts['lint:rtl'], 'rtlint');
  assert.equal((await cli(['init'], dir)).code, 2, 'does not overwrite without --force');
  assert.equal((await cli(['init', '--force', '--lang', 'en'], dir)).code, 0);
});

test('explain prints a rule with its documentation, in English or Persian', async () => {
  const en = await cli(['explain', 'fa/zwnj-suffix'], '.');
  assert.equal(en.code, 0);
  assert.match(en.out, /fa\/zwnj-suffix/);
  assert.match(en.out, /comparatives/);
  const fa = await cli(['explain', 'css/physical-property', '--lang', 'fa'], '.');
  assert.match(fa.out, /منطقی/);
  const bad = await cli(['explain', 'zwnj'], '.');
  assert.equal(bad.code, 2);
  assert.match(bad.err, /did you mean/);
});

test('--changed and --staged lint only what git says changed', async () => {
  const dir = project({ 'a.css': '.a { margin-left: 1px; }\n', 'b.css': '.b { margin-left: 1px; }\n' });
  git(dir, 'init', '-q');
  git(dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.');
  git(dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init');
  assert.equal((await cli(['--changed', '-f', 'compact'], dir)).out, '', 'nothing changed yet');
  writeFileSync(join(dir, 'b.css'), '.b { margin-right: 1px; }\n');
  writeFileSync(join(dir, 'c.css'), '.c { padding-left: 1px; }\n');
  const changed = await cli(['--changed', '-f', 'compact'], dir);
  assert.doesNotMatch(changed.out, /a\.css/);
  assert.match(changed.out, /b\.css/);
  assert.match(changed.out, /c\.css/, 'untracked files count as changed');
  git(dir, 'add', 'c.css');
  const staged = await cli(['--staged', '-f', 'compact'], dir);
  assert.match(staged.out, /c\.css/);
  assert.doesNotMatch(staged.out, /b\.css/);
});

test('--cache stores results and reuses them for unchanged files', async () => {
  const dir = project({ 'a.css': '.a { margin-left: 1px; }\n' });
  const first = await cli(['--cache', '-f', 'compact'], dir);
  assert.ok(existsSync(join(dir, '.rtlintcache')));
  const cache = JSON.parse(readFileSync(join(dir, '.rtlintcache'), 'utf8'));
  assert.ok(cache.files['a.css']);
  const second = await cli(['--cache', '-f', 'compact'], dir);
  assert.equal(second.out, first.out);
  writeFileSync(join(dir, 'a.css'), '.a { margin-inline-start: 1px; }\n');
  assert.equal((await cli(['--cache', '-f', 'compact'], dir)).out, '', 'a changed file is linted again');
});

test('baselines hide existing problems and still report new ones', async () => {
  const dir = project({ 'a.css': '.a { margin-left: 1px; }\n.b { padding-right: 2px; }\n' });
  const created = await cli(['--update-baseline'], dir);
  assert.equal(created.code, 0);
  assert.match(created.out, /Recorded 2 existing problems/);
  assert.equal((await cli(['--baseline', 'rtlint-baseline.json'], dir)).code, 0);
  // Moving lines around keeps them baselined; a new problem is reported.
  writeFileSync(join(dir, 'a.css'), '\n\n.b { padding-right: 2px; }\n.a { margin-left: 1px; }\n.c { left: 0; }\n');
  const after = await cli(['--baseline', 'rtlint-baseline.json', '-f', 'compact'], dir);
  assert.equal(after.out.trim().split('\n').length, 1);
  assert.match(after.out, /a\.css:5:/);
});

test('--fix-only applies fixes from the named rules only', async () => {
  const dir = project({ 'a.md': 'پژوهش يك متن و کتاب ها\n', 'b.css': '.a { margin-left: 1px; }\n' });
  await cli(['--fix-only', 'fa/arabic-letters'], dir);
  assert.equal(readFileSync(join(dir, 'a.md'), 'utf8'), 'پژوهش یک متن و کتاب ها\n');
  assert.equal(readFileSync(join(dir, 'b.css'), 'utf8'), '.a { margin-left: 1px; }\n');
  await cli(['--fix-only', 'css/*'], dir);
  assert.equal(readFileSync(join(dir, 'b.css'), 'utf8'), '.a { margin-inline-start: 1px; }\n');
});

test('--report-unused-disable-directives', async () => {
  const dir = project({
    'a.css': '/* rtlint-disable-next-line css/physical-property */\n.a { margin-left: 1px; }\n/* rtlint-disable-next-line css/physical-value */\n.b { color: red; }\n',
  });
  const r = await cli(['--report-unused-disable-directives', '-f', 'compact'], dir);
  assert.equal(r.out.trim().split('\n').length, 1);
  assert.match(r.out, /a\.css:3:4: warning Unused rtlint-disable-next-line for css\/physical-value/);
  const fa = await cli(['--report-unused-disable-directives', '-f', 'compact', '--lang', 'fa'], dir);
  assert.match(fa.out, /بی‌استفاده/);
});

test('--stats, --print-config and --no-error-on-unmatched-pattern', async () => {
  const dir = project({
    'a.css': '.a { margin-left: 1px; padding-left: 2px; }\n',
    'rtlint.config.json': JSON.stringify({ overrides: [{ files: ['legacy/**'], rules: { 'css/*': 'off' } }] }),
  });
  const stats = await cli(['--stats'], dir);
  assert.match(stats.out, /Rule\s+Count\s+Files\s+Fixable/);
  assert.match(stats.out, /css\/physical-property\s+2\s+1\s+2/);
  const printed = JSON.parse((await cli(['--print-config', 'legacy/x.css'], dir)).out);
  assert.equal(printed.rules['css/physical-property'].level, 'off');
  assert.equal((await cli(['nothing-*.scss'], dir)).code, 2);
  assert.equal((await cli(['nothing-*.scss', '--no-error-on-unmatched-pattern'], dir)).code, 0);
});

test('report formats: html, markdown, junit, checkstyle, gitlab, summary', async () => {
  const dir = project({ 'a.css': '.a { margin-left: 1px; }\n', 'b.md': 'پژوهش يك متن\n' });
  const html = (await cli(['-f', 'html', '--lang', 'fa'], dir)).out;
  assert.match(html, /<html lang="fa" dir="rtl">/);
  assert.match(html, /css\/physical-property/);
  const md = (await cli(['-f', 'markdown'], dir)).out;
  assert.match(md, /### rtlint: 2 problems/);
  assert.match(md, /\| \[`css\/physical-property`\]/);
  const junit = (await cli(['-f', 'junit'], dir)).out;
  assert.match(junit, /<testsuites name="rtlint" tests="2" failures="2">/);
  const checkstyle = (await cli(['-f', 'checkstyle'], dir)).out;
  assert.match(checkstyle, /<error line="1" column="6" severity="warning"/);
  const gitlab = JSON.parse((await cli(['-f', 'gitlab'], dir)).out);
  assert.equal(gitlab.length, 2);
  assert.equal(new Set(gitlab.map((i) => i.fingerprint)).size, 2);
  assert.match((await cli(['-f', 'summary'], dir)).out, /fa\/arabic-letters\s+1\s+1\s+1/);
  assert.equal((await cli(['-f', 'markdown'], project({ 'ok.css': '.a{}' }))).out, '### ✅ rtlint: no RTL problems found\n');
});

test('--watch re-lints a file when it changes', async () => {
  const dir = project({ 'a.css': '.a { margin-inline-start: 1px; }\n' });
  const stdout = sink();
  const controller = new AbortController();
  const done = run(['--watch', '-f', 'compact'], { cwd: dir, stdout, stderr: sink(), signal: controller.signal });
  await new Promise((r) => setTimeout(r, 300));
  writeFileSync(join(dir, 'a.css'), '.a { margin-left: 1px; }\n');
  for (let i = 0; i < 50 && !/a\.css:1:6/.test(stdout.text()); i++) await new Promise((r) => setTimeout(r, 100));
  controller.abort();
  assert.equal(await done, 0);
  assert.match(stdout.text(), /Watching for changes/);
  assert.match(stdout.text(), /a\.css:1:6: warning/);
});
