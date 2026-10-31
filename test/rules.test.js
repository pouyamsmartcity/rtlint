import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixText, lintText, logicalClass } from '../src/core.js';

const ids = (text, filePath, config) => lintText(text, { filePath, config }).messages.map((m) => m.ruleId);
const fix = (text, filePath, config) => fixText(text, { filePath, config }).output;
const ZWNJ = '\u200C';

test('css/physical-property: logical replacements', () => {
  assert.equal(
    fix('.a { margin-left: 4px; padding-right: 2px; border-top-left-radius: 3px; left: 0 }', 'a.css'),
    '.a { margin-inline-start: 4px; padding-inline-end: 2px; border-start-start-radius: 3px; inset-inline-start: 0 }',
  );
});

test('css/physical-property: ignores comments, selectors and values', () => {
  const css = '/* margin-left: 1px */ .margin-left:hover { transition: left 1s; } @page :left { margin: 0 }';
  assert.deepEqual(ids(css, 'a.css'), []);
});

test('css/physical-property: centering trick is reported but not fixed', () => {
  const css = '.c { position: absolute; left: 50%; transform: translateX(-50%); }';
  const r = lintText(css, { filePath: 'a.css' });
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].fix, undefined);
  assert.match(r.messages[0].message, /centering/);
});

test('css/physical-property: safe-area insets stay physical', () => {
  assert.deepEqual(ids('.a { padding-left: env(safe-area-inset-left); }', 'a.css'), []);
  assert.deepEqual(ids('.a { padding: 0 env(safe-area-inset-right) 0 env(safe-area-inset-left); }', 'a.css'), []);
});

test('css/physical-value: text-align, float, clear', () => {
  assert.equal(
    fix('a{text-align:left;float:right;clear: left !important}', 'a.scss'),
    'a{text-align:start;float:inline-end;clear: inline-start !important}',
  );
  assert.deepEqual(ids('a{text-align:center}', 'a.css'), []);
});

test('css/asymmetric-shorthand: margin, inset, border-width', () => {
  assert.equal(
    fix('a{margin:0 10px 0 5px}', 'a.css'),
    'a{margin-block:0; margin-inline: 5px 10px}'.replace('margin-block:0', 'margin-block: 0'),
  );
  assert.equal(fix('a{inset: 1px 2px 3px 4px !important;}', 'a.css'), 'a{inset-block: 1px 3px !important; inset-inline: 4px 2px !important;}');
  assert.deepEqual(ids('a{margin:0 10px 0 10px; padding: 1px 2px 3px}', 'a.css'), []);
});

test('css/asymmetric-shorthand: border-radius corners', () => {
  assert.equal(
    fix('a{border-radius:4px 0 0 4px}', 'a.css'),
    'a{border-start-start-radius: 4px; border-start-end-radius: 0; border-end-end-radius: 0; border-end-start-radius: 4px}',
  );
  assert.deepEqual(ids('a{border-radius: 4px 4px 0 0}', 'a.css'), []);
  assert.deepEqual(ids('a{border-radius: 50% / 10%}', 'a.css'), []);
});

test('css in markup: <style> blocks and style attributes', () => {
  const html = '<style>.a{margin-left:1px}</style><p style="padding-right: 2px">x</p><p style="margin: 0 1px 0 2px"><b style="color:red">';
  assert.equal(
    fix(html, 'a.svelte'),
    '<style>.a{margin-inline-start:1px}</style><p style="padding-inline-end: 2px">x</p><p style="margin-block: 0; margin-inline: 2px 1px"><b style="color:red">',
  );
});

test('css in JS: styled-components and emotion', () => {
  const js = 'const A = styled.div`\n  margin-left: ${(p) => p.x}px;\n  float: left;\n`;\nconst b = css`padding-right: 1px;`;';
  assert.deepEqual(ids(js, 'a.ts'), ['css/physical-property', 'css/physical-value', 'css/physical-property']);
});

test('class/physical-utility: Tailwind mapping with variants and modifiers', () => {
  assert.equal(logicalClass('ml-4'), 'ms-4');
  assert.equal(logicalClass('md:hover:pr-2.5'), 'md:hover:pe-2.5');
  assert.equal(logicalClass('-ml-px'), '-ms-px');
  assert.equal(logicalClass('!left-[3px]'), '!start-[3px]');
  assert.equal(logicalClass('pl-4!'), 'ps-4!');
  assert.equal(logicalClass('border-l'), 'border-s');
  assert.equal(logicalClass('border-r-red-500/50'), 'border-e-red-500/50');
  assert.equal(logicalClass('rounded-tl-lg'), 'rounded-ss-lg');
  assert.equal(logicalClass('rounded-r'), 'rounded-e');
  assert.equal(logicalClass('text-right'), 'text-end');
  assert.equal(logicalClass('float-left'), 'float-start');
  assert.equal(logicalClass('tw-ml-2', 'tw-'), 'tw-ms-2');
  assert.equal(logicalClass('rtl:ml-2'), null);
  assert.equal(logicalClass('left-panel'), null);
  assert.equal(logicalClass('mlx-2'), null);
  assert.equal(logicalClass('ml-[env(safe-area-inset-left)]'), null);
});

test('class/physical-utility: Bootstrap 4 to 5', () => {
  assert.equal(logicalClass('ml-md-3'), 'ms-md-3');
  assert.equal(logicalClass('mr-auto'), 'me-auto');
  assert.equal(logicalClass('text-md-left'), 'text-md-start');
  assert.equal(logicalClass('float-lg-right'), 'float-lg-end');
  assert.equal(logicalClass('border-left-0'), 'border-start-0');
  assert.equal(logicalClass('rounded-right'), 'rounded-end');
  assert.equal(logicalClass('dropdown-menu-right'), 'dropdown-menu-end');
  assert.equal(logicalClass('dropleft'), 'dropstart');
});

test('class/physical-utility: where classes are found', () => {
  const jsx = `<div className="ml-2" />;
<a className={cn('pr-3', active && "text-left", { 'pl-1': x })} />;
const s = clsx(\`mr-2 \${y ? 'left-0' : ''}\`);
const t = tw\`ml-1\`;`;
  assert.equal(
    fix(jsx, 'a.jsx'),
    `<div className="ms-2" />;
<a className={cn('pe-3', active && "text-start", { 'ps-1': x })} />;
const s = clsx(\`me-2 \${y ? 'start-0' : ''}\`);
const t = tw\`ms-1\`;`,
  );
  assert.equal(fix('<div :class="{ \'ml-2\': on }" class="pr-1"></div>', 'a.vue'), '<div :class="{ \'ms-2\': on }" class="pe-1"></div>');
  assert.equal(fix('.a { @apply ml-2 text-left; }', 'a.css'), '.a { @apply ms-2 text-start; }');
  assert.deepEqual(ids('const label = "ml-2 left";', 'a.ts'), []);
});

test('class/physical-utility: centering pair is reported without a fix', () => {
  const r = lintText('<div class="absolute left-1/2 -translate-x-1/2"></div>', { filePath: 'a.html' });
  assert.deepEqual(r.messages.map((m) => m.ruleId), ['class/physical-utility']);
  assert.equal(r.messages[0].fix, undefined);
});

test('class/directional-utility', () => {
  assert.deepEqual(ids('<i class="group-hover:translate-x-1"></i>', 'a.html'), ['class/directional-utility']);
  assert.deepEqual(ids('<i class="translate-x-1 rtl:-translate-x-1"></i>', 'a.html'), []);
  assert.deepEqual(ids('<i class="bg-gradient-to-r"></i>', 'a.html'), []);
  assert.deepEqual(
    ids('<i class="bg-gradient-to-r"></i>', 'a.html', { rules: { 'class/directional-utility': ['warn', { gradients: true }] } }),
    ['class/directional-utility'],
  );
  const msg = lintText('<i class="md:translate-x-2"></i>', { filePath: 'a.html' }).messages[0].message;
  assert.match(msg, /rtl:md:-translate-x-2/);
});

test('jsx/physical-style: web and React Native', () => {
  assert.equal(
    fix('const s = <div style={{ marginLeft: 4, "paddingRight": 2, textAlign: "left" }} />;', 'a.jsx'),
    'const s = <div style={{ marginInlineStart: 4, "paddingInlineEnd": 2, textAlign: "start" }} />;',
  );
  assert.equal(
    fix("import { StyleSheet } from 'react-native';\nStyleSheet.create({ a: { marginLeft: 4, borderTopRightRadius: 2, textAlign: 'left' } });", 'a.js'),
    "import { StyleSheet } from 'react-native';\nStyleSheet.create({ a: { marginStart: 4, borderTopEndRadius: 2, textAlign: 'left' } });",
  );
  assert.deepEqual(ids('// marginLeft: 3\nconst cfg = { marginLeft: 1 };', 'a.js'), []);
});

test('html/dir-attribute', () => {
  assert.equal(fix('<html lang="fa">', 'a.html'), '<html dir="rtl" lang="fa">');
  assert.equal(fix('<html lang="ar-EG" dir="ltr">', 'a.html'), '<html lang="ar-EG" dir="rtl">');
  assert.deepEqual(ids('<html lang="en">', 'a.html'), []);
  assert.deepEqual(ids('<html lang="ku-Latn">', 'a.html'), []);
  assert.deepEqual(ids('<html lang="ku-Arab" dir="rtl">', 'a.html'), []);
  assert.deepEqual(ids('<html lang={locale}>', 'layout.tsx'), ['html/dir-attribute']);
  assert.deepEqual(ids('<html lang={locale} dir={dir(locale)}>', 'layout.tsx'), []);
  assert.deepEqual(ids('<html lang="%sveltekit.lang%">', 'app.html'), ['html/dir-attribute']);
});

test('html/ltr-input', () => {
  assert.equal(fix('<input type="email" name="e">', 'a.html'), '<input dir="ltr" type="email" name="e">');
  assert.equal(fix('<input type="tel" onChange={(e) => set(e.target.value)} />', 'a.tsx'), '<input dir="ltr" type="tel" onChange={(e) => set(e.target.value)} />');
  assert.deepEqual(ids('<input type="email" dir="auto"><input type="text">', 'a.html'), []);
});

test('fa/arabic-letters: fixes Persian, leaves Arabic alone', () => {
  assert.equal(fix('این يك كتاب است', 'a.md'), 'این یک کتاب است');
  assert.deepEqual(ids('هذه مكتبة كبيرة', 'a.md'), []);
  assert.deepEqual(ids('{"title": "پیام جديد"}', 'locales/ar.json'), []);
  assert.deepEqual(ids('{"title": "كتاب"}', 'locales/fa.json'), ['fa/arabic-letters']);
});

test('fa/arabic-letters: file-level detection for lines without Persian-only letters', () => {
  const text = 'گفتگو پژوهش چراغ\nكتاب';
  assert.equal(fix(text, 'a.txt'), 'گفتگو پژوهش چراغ\nکتاب');
  assert.equal(fix('كتاب', 'a.txt'), 'كتاب');
  assert.equal(fix('كتاب', 'a.txt', { persian: true }), 'کتاب');
  assert.equal(fix('این يك', 'a.txt', { persian: false }), 'این يك');
});

test('fa/arabic-digits and fa/mixed-digits', () => {
  assert.equal(fix('سال ١٤٠٣ و ۱۲3 نفر', 'a.md'), 'سال ۱۴۰۳ و ۱۲۳ نفر');
  assert.deepEqual(ids('سال 1403 و ۱۴۰۳', 'a.md'), []);
});

test('fa/zwnj-prefix', () => {
  assert.equal(fix('من می روم و نمی خواهم', 'a.md'), `من می${ZWNJ}روم و نمی${ZWNJ}خواهم`);
  assert.deepEqual(ids('جام می و', 'a.md'), []);
  assert.deepEqual(ids('همی گفت', 'a.md'), []);
});

test('fa/zwnj-suffix', () => {
  assert.equal(fix('کتاب ها و بزرگ تر و بهترین ها', 'a.md'), `کتاب${ZWNJ}ها و بزرگ${ZWNJ}تر و بهترین${ZWNJ}ها`);
  assert.equal(fix('خانه ای که رفته اند', 'a.md'), `خانه${ZWNJ}ای که رفته${ZWNJ}اند`);
  assert.deepEqual(ids('که ای دل', 'a.md'), []);
  assert.deepEqual(
    ids('چشم تر', 'a.md', { rules: { 'fa/zwnj-suffix': ['warn', { comparatives: false }] } }),
    [],
  );
});

test('fa/zwnj-invalid', () => {
  assert.equal(fix(`نمی${ZWNJ}${ZWNJ}دانم`, 'a.md'), `نمی${ZWNJ}دانم`);
  assert.equal(fix(`سلام${ZWNJ} دنیا`, 'a.md'), 'سلام دنیا');
  assert.equal(fix('می\u200Dروم', 'a.md'), `می${ZWNJ}روم`);
  assert.deepEqual(ids(`می${ZWNJ}روم`, 'a.md'), []);
});

test('fa/punctuation', () => {
  assert.equal(fix('سلام, دنیا; خوبی?', 'a.md'), 'سلام، دنیا؛ خوبی؟');
  assert.deepEqual(ids('words like سلام, which', 'a.md'), []);
  assert.deepEqual(ids("t('سلام', 'دنیا')", 'a.js'), []);
});

test('fa/punctuation-spacing', () => {
  assert.equal(fix('سلام ، خوبی ؟ « عالی » .', 'a.md'), 'سلام، خوبی؟ «عالی».');
});

test('fa/kashida', () => {
  assert.equal(fix('تـــهران زیبا', 'a.md'), 'تهران زیبا');
});

test('security/bidi-control', () => {
  const trojan = 'if (access !== "user\u202E \u2066// admin\u2069 \u2066") {';
  assert.equal(ids(trojan, 'a.js').filter((id) => id === 'security/bidi-control').length, 4);
  assert.deepEqual(ids('متن \u2067English\u2069 پایان', 'a.md'), []);
  assert.deepEqual(ids('متن \u2067English', 'a.md'), ['security/bidi-control']);
  assert.deepEqual(ids('text \u202E reversed \u202C', 'a.md'), ['security/bidi-control']);
  assert.equal(lintText(trojan, { filePath: 'a.js' }).messages[0].fix, undefined);
});

test('markup rules ignore tags mentioned inside JS strings', () => {
  assert.deepEqual(ids("const msg = '<html lang=\"fa\"> needs dir';\nconst m2 = `<input type=\"email\">`;", 'a.js'), []);
  assert.deepEqual(ids('const t = html`<input type="email">`;', 'a.js'), ['html/ltr-input']);
});

test('fa/arabic-letters: character references in code are not Persian text', () => {
  const dart = "static String norm(String s) => s.replaceAll('ي', 'ی').replaceAll('ك', 'ک');";
  assert.deepEqual(ids(dart, 'a.dart'), []);
  assert.deepEqual(ids("const re = /[يك]/g; // پ", 'a.js'), []);
});

test('fa/zwnj-invalid: ZWNJ between letters of any script is deliberate', () => {
  assert.deepEqual(ids('متن sanitize\u200Cشده پ', 'a.md'), []);
  assert.deepEqual(ids('طلایی\u200Cـ\u200Cمشکی', 'a.md'), []);
});

test('fa/zwnj-joined: known verb forms only', () => {
  const Z = String.fromCharCode(0x200c);
  assert.equal(fix('من میخواهم و نمیتوانم. او میرفت.', 'a.md'), `من می${Z}خواهم و نمی${Z}توانم. او می${Z}رفت.`);
  assert.deepEqual(ids('میدان و میز و میوه و میلیون و میگو و همیشه و میهمانی و راهنمای میدانی', 'a.md'), []);
});

test('fa/zwnj-suffix: ezafe after a final heh', () => {
  const Z = String.fromCharCode(0x200c);
  assert.equal(fix('خانه ی من', 'a.md'), `خانه${Z}ی من`);
  assert.deepEqual(ids('که ی', 'a.md'), []);
});

test('icon/directional', () => {
  assert.deepEqual(ids('<ChevronRight class="size-4" />', 'a.svelte'), ['icon/directional']);
  assert.deepEqual(ids('const x = <ArrowLeftIcon className="h-4" />;', 'a.tsx'), ['icon/directional']);
  assert.deepEqual(ids('<i class="fa fa-chevron-right"></i>', 'a.html'), ['icon/directional']);
  assert.deepEqual(ids('<Icon icon="lucide:arrow-right" />', 'a.vue'), ['icon/directional']);
  assert.deepEqual(ids('<span class="material-icons">arrow_forward</span>', 'a.html'), ['icon/directional']);
  assert.deepEqual(ids('<ChevronRight class="rtl:-scale-x-100" />', 'a.svelte'), []);
  assert.deepEqual(ids('{isRtl ? <ChevronLeft /> : <ChevronRight />}', 'a.jsx'), []);
  assert.deepEqual(ids('<ArrowUpRight /><ChevronDown /><i class="fa fa-arrow-up"></i>', 'a.jsx'), []);
  assert.deepEqual(ids('<i class="fa fa-chevron-right fa-flip-horizontal"></i>', 'a.html'), []);
  assert.deepEqual(ids("const label = '<ChevronRight>';", 'a.js'), []);
});

test('text/presentation-forms', () => {
  assert.equal(fix('{"name": "ﻣﻘﺪﻭﻧﯿﻪ"}', 'countries.json'), '{"name": "مقدونیه"}');
  assert.equal(fix('ﻻ', 'a.md'), 'لا');
  assert.deepEqual(ids('قیمت ۱۰۰ ﷼', 'a.md'), []);
  assert.deepEqual(ids("ctx.fillText('ﻣﻘﺪﻭﻧﯿﻪ', 0, 0);", 'a.js'), []);
  assert.deepEqual(
    ids("ctx.fillText('ﻣﻘﺪﻭﻧﯿﻪ', 0, 0);", 'a.js', { rules: { 'text/presentation-forms': ['error', { code: true }] } }),
    ['text/presentation-forms'],
  );
});

test('css/directional-value is opt-in', () => {
  const css = '.slide { transform: translateX(20px); background-position: left top; } [dir="rtl"] .slide { transform: translateX(-20px); } .c { transform: translate(-50%, 0); }';
  assert.deepEqual(ids(css, 'a.css'), []);
  const on = { rules: { 'css/directional-value': 'warn' } };
  assert.deepEqual(ids(css, 'a.css', on), ['css/directional-value', 'css/directional-value']);
});

test('icon/directional: an unrelated isRtl nearby does not hide icons', () => {
  const tsx = `export function Pager({ isRtl }) {
  return <nav><button><ChevronLeft className="size-4" /></button><i className="fa fa-arrow-right" /></nav>;
}`;
  assert.deepEqual(ids(tsx, 'a.tsx'), ['icon/directional', 'icon/directional']);
  assert.deepEqual(ids("{dir === 'rtl' && <ArrowLeft />}", 'a.jsx'), []);
  assert.deepEqual(ids('{isRtl ? (<ChevronLeft />) : (<ChevronRight />)}', 'a.jsx'), []);
});

test('every message has a Persian translation (lang: fa)', async () => {
  const { listRules } = await import('../src/core.js');
  const samples = [
    ['a.css', '.a { margin-left: 1px; text-align: left; padding: 0 1px 0 2px; border-radius: 4px 0 0 4px; left: 50%; transform: translateX(-50%); }'],
    ['a.css', '.b { transform: translateX(4px); }'],
    ['a.svelte', '<div style:left="1px" class="ml-2 left-1/2 -translate-x-1/2 translate-x-2"></div><ChevronRight /><i class="fa fa-arrow-left"></i><Icon icon="lucide:arrow-right" /><span class="material-icons">arrow_forward</span>'],
    ['a.jsx', 'const a = <div style={{ marginLeft: 1, textAlign: "left" }} />;'],
    ['a.html', '<html lang="fa"><input type="email">'],
    ['b.html', '<html lang="ar" dir="ltr">'],
    ['c.html', '<html lang="en" dir="rtl">'],
    ['d.tsx', '<html lang={locale}>'],
    ['a.md', 'پژوهش: من مي خواهم كتاب ها را بخوانم, دنیا ١٢ و ۱۲3 میخواهم سلام ، « خوب » تـــهران خانه‌‌ها می‍روم ﻻ'],
    ['a.md', 'متن ‮معکوس ⁧باز ‬'],
    ['a.js', 'const x = "‮";'],
  ];
  const config = { lang: 'fa', rules: { '*': 'warn' } };
  const seen = new Set();
  for (const [filePath, text] of samples) {
    for (const m of lintText(text, { filePath, config }).messages) {
      seen.add(m.ruleId);
      assert.match(m.message, /[؀-ۿ]/, `${m.ruleId} has no Persian message: ${m.message}`);
    }
  }
  const missing = listRules().map((r) => r.id).filter((id) => !seen.has(id));
  assert.deepEqual(missing, [], 'every rule is exercised by this test');
  for (const r of listRules()) assert.match(r.descriptionFa ?? '', /[؀-ۿ]/, `${r.id} needs a Persian description`);
});

test('fa/zwnj-invalid: a half-space next to Markdown emphasis is kept', () => {
  const Z = String.fromCharCode(0x200c);
  assert.deepEqual(ids(`ویژگی‌ها **فیزیکی**${Z}اند و _منطقی_${Z}اند`, 'a.md'), []);
});
