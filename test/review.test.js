// Regression tests for the findings of the pre-release adversarial review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { fixText, lintText } from '../src/core.js';
import { run } from '../src/cli.js';

const ids = (text, filePath, config) => lintText(text, { filePath, config }).messages.map((m) => m.ruleId);
const fix = (text, filePath, config) => fixText(text, { filePath, config }).output;
const ch = (...codes) => String.fromCharCode(...codes);
const same = (text, filePath) => assert.equal(fix(text, filePath), text, `${filePath} must stay unchanged`);

test('A1: code that already handles RTL is left alone', () => {
  same('.x { margin-left: 8px; }\n[dir="rtl"] .x { margin-left: 0; margin-right: 8px; }'.split('\n')[1], 'a.css');
  same('.x:dir(rtl) { left: auto; right: 0 }', 'a.css');
  same('.x { .rtl & { margin-left: 2px } @include rtl { padding-right: 1px } }', 'a.scss');
  same('html[dir=rtl] .x { text-align: right; float: left; }', 'a.css');
  same('.x { /* rtl:ignore */ margin-left: 4px; }', 'a.css');
  same('/*rtl:begin:ignore*/ .a { margin-left: 1px } /*rtl:end:ignore*/', 'a.css');
  same("const a = <div className={isRtl ? 'mr-2' : 'ml-2'} />;", 'a.jsx');
  same("const b = <i className={cn('p-1', dir === 'rtl' ? 'left-0' : 'right-0')} />;", 'a.jsx');
  same("const c = <b className={clsx({ 'ml-2': !isRtl })} />;", 'a.jsx');
  same('const s = <div style={{ marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }} />;', 'a.jsx');
  same("import { I18nManager } from 'react-native';\nconst s = I18nManager.isRTL ? { marginRight: 8 } : { marginLeft: 8 };", 'a.js');
  // The base rule outside the [dir] block is still converted.
  assert.equal(fix('.x { margin-left: 8px; }', 'a.css'), '.x { margin-inline-start: 8px; }');
});

test('A2: Sass/Less interpolation is never rewritten', () => {
  same('.a { margin: 0 4px 0 #{$gap}; border-radius: 4px #{$r}; }', 'a.scss');
  same('.a { margin: 0 4px 0 @{gap}; }', 'a.less');
  assert.equal(fix('.a { margin: 0 $b 0 $a; }', 'a.scss'), '.a { margin-block: 0; margin-inline: $a $b; }');
});

test('A3: Sass maps and nested properties are left alone', () => {
  same('$offsets: (\n  left: 10px,\n  right: 20px\n);', 'a.scss');
  same('.b { margin: {\n left: 4px; }\n}', 'a.scss');
});

test('A4: <style lang="sass"> blocks are reported without a fix', () => {
  const vue = '<style lang="sass">\n.a\n  margin: 0 10px 0 5px\n</style>';
  same(vue, 'a.vue');
  assert.deepEqual(ids(vue, 'a.vue'), ['css/asymmetric-shorthand']);
});

test('A5: @page and @supports not fallbacks are left alone', () => {
  same('@page { margin: 1cm 2cm 1cm 3cm; } @page :left { margin-left: 3cm }', 'print.css');
  same('@supports not (inset-inline-start: 0) { .a { left: 0 } }', 'a.css');
});

test('A6: TypeScript types and destructuring keep their keys', () => {
  same('interface BoxProps { marginLeft: number; paddingRight?: string }', 'a.tsx');
  same('type T = { marginRight: React.CSSProperties["marginRight"] };', 'a.tsx');
  same('const f = (p: { marginLeft: number }) => p;', 'a.tsx');
  same('const { marginLeft: ml } = props;', 'a.tsx');
  same('const g = ({ marginLeft: ml }) => ml;', 'a.tsx');
  assert.equal(fix('const s = <div style={{ marginLeft: ml }} />;', 'a.tsx'), 'const s = <div style={{ marginInlineStart: ml }} />;');
});

test('A7: Persian rules leave data, code tables, regexes, URLs and code spans alone', () => {
  same('نام,شهر,کشور\nعلی,تهران,ایران', 'data.csv');
  same('tags: [کتاب, رمان]', 'post.yml');
  same('ببین https://x.ir/search?q=کتاب,رمان و `يك` را\n```\nكتاب ها\n```', 'a.md');
  same("const FIX = { 'يك': 'یک', 'كه': 'که' }; // اصلاح", 'fix.js');
  same("const AR = '٠١٢٣٤٥٦٧٨٩'; // ارقام", 'digits.js');
  same("t = str.maketrans('يك', 'یک')  # پاکسازی", 'n.py');
  same('const re = /کتاب?ها/;', 'a.js');
  // Real prose in code is still checked.
  assert.equal(fix("const msg = 'این يك متن است';", 'a.js'), "const msg = 'این یک متن است';");
  assert.equal(fix('msg = """این يك متن است"""', 'a.py'), 'msg = """این یک متن است"""');
  assert.equal(fix('const p = <p>این يك متن است</p>;', 'a.jsx'), 'const p = <p>این یک متن است</p>;');
});

test('A8: Arabic, Quranic, Sindhi and Urdu text is not "fixed"', () => {
  same('پیامبر فرمود: «إن الله على كل شيء قدير»', 'post.md');
  same('خداوند می‌فرماید: ﴿إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ﴾ آیه ﴿١﴾', 'post.md');
  same('پژوهش گفتگو چراغ\nبسم الله الرحمن الرحيم', 'fa.md');
  same('مان پاڻي پيئان ٿو', 's.md');
  // A Persian quote typed on an Arabic keyboard is still Persian.
  assert.equal(fix('گفت «كتاب را بده»', 'a.md'), 'گفت «کتاب را بده»');
});

test('A9: «تر» meaning "wet" is not joined', () => {
  const Z = ch(0x200c);
  same('میوه تر و تازه و لباس تر', 'a.md');
  assert.equal(fix('خانه بزرگ تر و بهترین ها', 'a.md'), `خانه بزرگ${Z}تر و بهترین${Z}ها`);
  assert.equal(
    fix('پیراهن تر', 'a.md', { rules: { 'fa/zwnj-suffix': ['warn', { comparatives: 'all' }] } }),
    `پیراهن${Z}تر`,
  );
});

test('A10: presentation forms that NFKC cannot change are not reported', () => {
  same('آیه ﴿١﴾ و ﷼ و ﷺ', 'a.md');
  assert.equal(fix('ﻣ' + ch(0xfe79) + 'ﺤﻤﺪ', 'a.md'), 'م' + ch(0x064f) + 'حمد');
  assert.equal(fix(ch(0xfe76), 'a.md'), ch(0x064e));
});

test('B1/B2: directives only work inside comments, and parse precisely', () => {
  assert.deepEqual(ids('Use `rtlint-disable-file` to skip a file. این يك متن است', 'a.md'), ['fa/arabic-letters']);
  assert.deepEqual(ids('const help = "see rtlint-disable";\nconst x = <div className="ml-2" />;', 'a.jsx'), ['class/physical-utility']);
  assert.deepEqual(ids('/* rtlint-disable-next-line CSS/physical-property */\na{margin-left:0}', 'a.css'), []);
  assert.deepEqual(ids('/*rtlint-disable-next-line css/*/\nb{margin-left:0}', 'a.css'), []);
  assert.deepEqual(ids('/*\n * rtlint-disable-next-line\n */\na{margin-left:0}', 'a.css'), []);
  assert.deepEqual(ids('// rtlint-disable-next-line\na{margin-left:0} /* x */\nb{margin-left:0}', 'a.scss'), ['css/physical-property']);
});

test('C1: regex literals and JSX text do not hide the rest of a file', () => {
  const js = "const t = s.replace(/\\/*$/, '');\nconst x = <div className=\"ml-2\" style={{ marginLeft: 4 }} />;";
  assert.deepEqual(ids(js, 'a.jsx'), ['class/physical-utility', 'jsx/physical-style']);
  assert.deepEqual(ids('const p = <p>Don\'t forget <input type="email" /></p>;', 'a.jsx'), ['html/ltr-input']);
  same('const re = /["]/; // { marginLeft: 4 }', 'a.jsx');
});

test('C2: styled-components with TypeScript generics', () => {
  assert.equal(
    fix('const A = styled.div<{ $active: boolean }>`margin-left: 4px`; const B = css<P>`padding-right: 2px`;', 'a.tsx'),
    'const A = styled.div<{ $active: boolean }>`margin-inline-start: 4px`; const B = css<P>`padding-inline-end: 2px`;',
  );
});

test('C3: arbitrary variants, v4 parentheses, Svelte class: and inline expressions', () => {
  assert.equal(
    fix('<div className="[&>svg]:left-4 [&>svg~*]:pl-7 ml-(--gap)" />', 'a.tsx'),
    '<div className="[&>svg]:start-4 [&>svg~*]:ps-7 ms-(--gap)" />',
  );
  assert.equal(
    fix('<div class="ml-2 {a ? "pl-2" : ""} mr-1" class:ml-3={x}></div>', 'a.svelte'),
    '<div class="ms-2 {a ? "ps-2" : ""} me-1" class:ms-3={x}></div>',
  );
});

test('C4: unquoted attributes, Vue :style and Svelte style: directives', () => {
  assert.equal(fix('<html lang=fa><input type=email name=e>', 'a.html'), '<html dir="rtl" lang=fa><input dir="ltr" type=email name=e>');
  assert.equal(fix('<div :style="{ marginLeft: gap }"></div>', 'a.vue'), '<div :style="{ marginInlineStart: gap }"></div>');
  assert.equal(fix('<div style:margin-left="4px"></div>', 'a.svelte'), '<div style:margin-inline-start="4px"></div>');
});

test('C5: Trojan Source in <script> blocks of markup files', () => {
  const vue = '<template><p>x</p></template><script>\nif (a !== "user' + ch(0x2066) + '// admin' + ch(0x2069) + '") {}\n</script>';
  assert.deepEqual(ids(vue, 'a.vue'), ['security/bidi-control', 'security/bidi-control']);
});

test('C7: spaces before Latin punctuation are fixed too', () => {
  assert.equal(fix('سلام , دنیا ? خوبی', 'a.md'), 'سلام، دنیا؟ خوبی');
});

test('F: CSS strings, comments in values, CSS Modules, compact JS, SCSS // in <style>', () => {
  same('.q::before { content: "a; left: 0"; }', 'a.css');
  const gutter = lintText('.m { margin: 0 1px /* gutter */ 0 2px; }', { filePath: 'a.css' }).messages;
  assert.equal(gutter.length, 1);
  assert.equal(gutter[0].fix, undefined);
  same('const a = <div className={styles["text-left"]} />;', 'a.jsx');
  same('const t=\'<input type="email">\';', 'a.js');
  same('<style lang="scss">\n// old: margin-left: 1px\n</style>', 'a.svelte');
});

test('E: adversarial inputs stay fast and never crash', () => {
  const inputs = [
    ['a.jsx', '<a className={`${'.repeat(5000)],
    ['a.jsx', '<a className={'.repeat(20000)],
    ['a.js', 'cn('.repeat(30000)],
    ['a.html', '<!--'.repeat(50000)],
    ['a.html', '<style>'.repeat(30000)],
    ['a.css', '.a {' + 'left: 50%;'.repeat(20000) + '}'],
    ['a.md', '`'.repeat(50000)],
    ['a.md', 'کتاب '.repeat(20000) + 'يك'.repeat(20000)],
  ];
  for (const [filePath, text] of inputs) {
    const started = performance.now();
    const r = lintText(text, { filePath });
    const ms = performance.now() - started;
    assert.ok(!r.messages.some((m) => m.fatal), `${filePath}: internal error`);
    // Generous bound: catches quadratic blow-ups (37 s before the fix), not machine load.
    assert.ok(ms < 8000, `${filePath} (${text.length} chars) took ${Math.round(ms)} ms`);
  }
});

function sink() {
  let data = '';
  const stream = new Writable({ write(chunk, _enc, cb) { data += chunk; cb(); } });
  stream.text = () => data;
  return stream;
}

test('D: CLI paths with brackets, ignores, precedence, validation, UTF-16, SARIF, dry-run', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rtlint-review-'));
  mkdirSync(join(dir, 'app', '[id]'), { recursive: true });
  mkdirSync(join(dir, 'legacy'));
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'app', '[id]', 'page.css'), '.a { margin-left: 1px; }\n');
  writeFileSync(join(dir, 'legacy', 'old.css'), '.a { margin-left: 1px; }\n');
  writeFileSync(join(dir, 'sub', 'skip.css'), '.a { margin-left: 1px; }\n');
  writeFileSync(join(dir, 'a#b.css'), '.a { margin-left: 1px; }\n');
  writeFileSync(
    join(dir, 'rtlint.config.json'),
    JSON.stringify({ ignore: ['sub/skip.css'], overrides: [{ files: ['**/*.css'], rules: { 'css/*': 'error' } }] }),
  );
  const io = (out = sink(), err = sink()) => ({ cwd: dir, stdout: out, stderr: err });

  let out = sink();
  assert.equal(await run(['app/[id]/page.css', '-f', 'compact'], io(out)), 1);
  assert.match(out.text(), /page\.css:1:6/);

  out = sink();
  await run(['.', '--ignore-pattern', 'legacy', '-f', 'compact'], io(out));
  assert.doesNotMatch(out.text(), /legacy/);
  assert.doesNotMatch(out.text(), /skip\.css/, 'config ignore is relative to the config file');

  // Run from a subfolder: the config's ignore is still relative to the config file.
  assert.equal(await run(['.'], { cwd: join(dir, 'sub'), stdout: sink(), stderr: sink() }), 0);

  assert.equal(await run(['.', '--rule', 'css/*=off'], io()), 0, 'CLI --rule wins over config overrides');

  const err = sink();
  assert.equal(await run(['.', '--max-warnings', 'abc'], io(sink(), err)), 2);
  assert.match(err.text(), /whole number/);
  assert.equal(await run(['nothing-*.css'], io()), 2);

  out = sink();
  await run(['a#b.css', '-f', 'sarif'], io(out));
  assert.equal(JSON.parse(out.text()).runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, 'a%23b.css');

  out = sink();
  await run(['a#b.css', '--fix-dry-run', '-f', 'json'], io(out));
  assert.equal(JSON.parse(out.text())[0].output, '.a { margin-inline-start: 1px; }\n');
  assert.equal(readFileSync(join(dir, 'a#b.css'), 'utf8'), '.a { margin-left: 1px; }\n');

  // UTF-16 LE with BOM (iOS Localizable.strings) is read and written back as UTF-16.
  const strings = '"title" = "این يك متن است";\n';
  writeFileSync(join(dir, 'Localizable.strings'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(strings, 'utf16le')]));
  await run(['Localizable.strings', '--fix'], io());
  const back = readFileSync(join(dir, 'Localizable.strings'));
  assert.deepEqual([...back.subarray(0, 2)], [0xff, 0xfe]);
  assert.equal(back.subarray(2).toString('utf16le'), '"title" = "این یک متن است";\n');
});

test('Arabic translations inside a Svelte <script> block are not Persian errors', () => {
  const svelte = "<script>\n  const COPY = {\n    ar: {\n      title: 'دليل النقاط',\n      premium: 'بريميوم',\n      standard: 'عادي',\n    },\n    fa: { title: 'راهنمای امتیازها' },\n  };\n</script>\n<p>این يك متن است</p>";
  assert.equal(fix(svelte, 'a.svelte'), svelte.replace('این يك', 'این یک'));
});
