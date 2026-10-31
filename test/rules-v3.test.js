// Tests for the rules added in 0.3: each one is checked for what it reports,
// what it fixes, and what it must leave alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixText, lintText } from '../src/core.js';

const on = (...rules) => ({ rules: Object.fromEntries(rules.map((r) => [r, 'warn'])) });
const ids = (text, filePath, config) => lintText(text, { filePath, config }).messages.map((m) => m.ruleId);
const fix = (text, filePath, config) => fixText(text, { filePath, config }).output;
const only = (rule) => ({ rules: { '*': 'off', [rule]: 'warn' } });
const ch = (...codes) => String.fromCharCode(...codes);

test('css/physical-transition', () => {
  assert.equal(
    fix('.a { transition: margin-left 0.2s, opacity 1s; will-change: left; }', 'a.css', only('css/physical-transition')),
    '.a { transition: margin-inline-start 0.2s, opacity 1s; will-change: inset-inline-start; }',
  );
  assert.deepEqual(ids('.a { transition: transform 1s ease-in-out; }', 'a.css'), []);
  assert.deepEqual(ids('[dir="rtl"] .a { transition: left 1s; }', 'a.css'), []);
});

test('css/arabic-letter-spacing', () => {
  assert.deepEqual(ids(':lang(fa) h1 { letter-spacing: 0.1em; }', 'a.css'), ['css/arabic-letter-spacing']);
  assert.deepEqual(ids('[dir="rtl"] { .title { letter-spacing: 2px; } }', 'a.scss'), ['css/arabic-letter-spacing']);
  assert.deepEqual(ids('h1 { letter-spacing: 0.1em; } :lang(fa) h1 { letter-spacing: normal; }', 'a.css'), []);
  assert.deepEqual(ids('<h1 class="tracking-wide rtl:tracking-wider"></h1>', 'a.html'), ['css/arabic-letter-spacing']);
  assert.deepEqual(ids('<h1 class="tracking-wide rtl:tracking-normal"></h1>', 'a.html'), []);
});

test('css/direction-property is opt-in and skips form fields', () => {
  const css = '.box { direction: rtl; } input[type="tel"] { direction: ltr; }';
  assert.deepEqual(ids(css, 'a.css'), []);
  assert.deepEqual(ids(css, 'a.css', on('css/direction-property')), ['css/direction-property']);
});

test('class/space-reverse is opt-in and adds the rtl variant', () => {
  const html = '<div class="flex space-x-4"></div><div class="space-x-2 rtl:space-x-reverse"></div>';
  assert.deepEqual(ids(html, 'a.html'), []);
  assert.equal(
    fix(html, 'a.html', only('class/space-reverse')),
    '<div class="flex space-x-4 rtl:space-x-reverse"></div><div class="space-x-2 rtl:space-x-reverse"></div>',
  );
  assert.deepEqual(ids('<div class="space-x-0 divide-x"></div>', 'a.html', on('class/space-reverse')), ['class/space-reverse']);
});

test('html/missing-lang', () => {
  assert.deepEqual(ids('<html><body></body></html>', 'a.html'), ['html/missing-lang']);
  assert.deepEqual(ids('<html lang="fa" dir="rtl">', 'a.html'), []);
  assert.deepEqual(ids('<html lang={locale} dir={dir}>', 'layout.tsx'), []);
  assert.deepEqual(ids('const s = "<html>";', 'a.js'), []);
});

test('html/user-content-dir is opt-in', () => {
  const html = '<input name="q"><input type="search"><textarea></textarea><div contenteditable="true"></div><input type="email"><input dir="auto">';
  assert.deepEqual(ids(html, 'a.html'), ['html/ltr-input']);
  assert.equal(
    fix(html, 'a.html', only('html/user-content-dir')),
    '<input dir="auto" name="q"><input dir="auto" type="search"><textarea dir="auto"></textarea><div dir="auto" contenteditable="true"></div><input type="email"><input dir="auto">',
  );
});

test('fa/space-after-punctuation', () => {
  assert.equal(fix('سلام،دنیا؛خوبی؟بله!پژوهش', 'a.md', only('fa/space-after-punctuation')), 'سلام، دنیا؛ خوبی؟ بله! پژوهش');
  assert.deepEqual(ids('سلام، دنیا؟ ۱۲،۵', 'a.md', only('fa/space-after-punctuation')), []);
});

test('fa/double-space', () => {
  assert.equal(fix('پژوهش    بزرگ و  جدید', 'a.md', only('fa/double-space')), 'پژوهش بزرگ و جدید');
  assert.deepEqual(ids('const  x = "پژوهش";', 'a.js', only('fa/double-space')), []);
});

test('fa/arrow-direction', () => {
  assert.equal(fix('ادامه → پژوهش', 'a.md', only('fa/arrow-direction')), 'ادامه ← پژوهش');
  assert.deepEqual(ids('تبدیل `margin-left` → `ms` و margin-left → margin-inline-start در پژوهش', 'a.md', only('fa/arrow-direction')), []);
  assert.deepEqual(ids('Next → page', 'a.md', only('fa/arrow-direction')), []);
});

test('opt-in Persian number and quote rules', () => {
  const text = 'پژوهش نشان داد ۵۰% افزایش و ۱.۵ برابر و ۱,۲۵۰,۰۰۰ تومان در سال 1403 با "کیفیت بالا"...';
  assert.equal(fix(text, 'a.md'), text, 'all off by default');
  const all = on('fa/percent-sign', 'fa/decimal-separator', 'fa/thousands-separator', 'fa/latin-digits', 'fa/guillemets', 'fa/ellipsis');
  assert.equal(fix(text, 'a.md', all), 'پژوهش نشان داد ۵۰٪ افزایش و ۱٫۵ برابر و ۱٬۲۵۰٬۰۰۰ تومان در سال ۱۴۰۳ با «کیفیت بالا»…');
});

test('fa/decimal-separator leaves dates; fa/latin-digits leaves codes; fa/guillemets only in prose files', () => {
  const all = on('fa/decimal-separator', 'fa/latin-digits', 'fa/guillemets');
  assert.deepEqual(ids('تاریخ پژوهش ۱۴۰۳.۰۵.۱۲ است', 'a.md', all), []);
  assert.deepEqual(ids('بازی 3D و نسخه‌ی v2 و ویدیو 1080p پژوهش', 'a.md', all), []);
  assert.deepEqual(ids('{"title": "پژوهش \\"کیفیت\\" بالا"}', 'fa.json', all), []);
  assert.deepEqual(ids("const t = 'پژوهش \"کیفیت\" بالا';", 'a.js', all), []);
});

test('text/invisible-characters', () => {
  const zwsp = ch(0x200b);
  const bom = ch(0xfeff);
  assert.equal(fix(`const a${zwsp}b = 1;`, 'a.js'), 'const ab = 1;');
  assert.equal(fix(`${bom}ok`, 'a.md'), `${bom}ok`, 'a leading BOM is fine');
  assert.equal(fix(`a${bom}b`, 'a.md'), 'ab');
  assert.equal(fix(`x${ch(0x2060)}y`, 'a.txt'), 'xy');
  // Emoji ZWJ sequences and Persian half-spaces are not touched.
  const family = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
  const halfSpace = `می${ch(0x200c)}روم`;
  assert.equal(fix(`${family} ${halfSpace}`, 'a.md'), `${family} ${halfSpace}`);
});

test('HTML rules skip code inside <script> blocks of markup files', () => {
  const svelte = '<script>\n  // Sync flags -> CSS vars on <html> and <input type="email">\n</script>\n<p>x</p>';
  assert.deepEqual(ids(svelte, 'a.svelte'), []);
});
