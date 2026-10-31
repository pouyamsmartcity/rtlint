import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixText, lintText } from '../src/core.js';

// Deterministic PRNG so a failure is reproducible from its seed.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ch = (...codes) => String.fromCharCode(...codes);
const ZWNJ = ch(0x200c);

// Fragments that exercise every scanner and rule, including broken syntax.
const PIECES = [
  'margin-left: 4px;', 'padding: 0 1px 0 2px;', 'border-radius: 4px 0 0 4px;', 'text-align: left;',
  'left: 50%;', 'transform: translateX(-50%);', '{', '}', '/*', '*/', '//', '<!--', '-->', '\n', '\r\n',
  ' ', '  ', '"', "'", '`', '${', '(', ')', '[', ']', ';', ':', ',', '?', '.', '!', '«', '»',
  '<style>', '</style>', '<html lang="fa">', '<input type="email">', 'style="margin-right:1px"',
  'class="ml-2 text-left left-1/2 -translate-x-1/2 rtl:mr-1"', 'className={cn("pl-2", x && `pr-1`)}',
  'style={{ marginLeft: 2, textAlign: "left" }}', 'styled.div`padding-left: 2px;`', '@apply ml-2;',
  'می', 'نمی', 'کتاب', 'ها', 'خانه', 'ای', 'اند', 'تر', 'گفت', 'پژوهش', ch(0x064a), ch(0x0643),
  ch(0x0649), ch(0x0629), ch(0x0660, 0x0661), '۱۲', '3', ZWNJ, ZWNJ + ZWNJ, ch(0x200d), ch(0x0640),
  ch(0x202e), ch(0x2066), ch(0x2069), ch(0x202c), ch(0xfeff), '😀', 'rtlint-disable-next-line',
  'rtlint-disable fa/*', 'rtlint-enable',
  // Shapes from the adversarial review.
  '[dir="rtl"] .x {', ':dir(rtl)', '@page {', '#{$gap}', '@{gap}', '$m: (', 'isRtl ? ', "'ml-2'",
  'interface P {', 'marginLeft: number;', '/re[/]/', '﴿', '﴾', '«', 'https://x.ir/a,b', '`code`',
  'tags: [', 'ال', 'ﻣﻘﺪ', ch(0xfe76), 'class:ml-2', 'style:left',
  // Shapes for the 0.3 rules.
  '→', '۵۰%', '۱.۵', '۱,۰۰۰', '...', '"', '12', 'letter-spacing: 2px;', ':lang(fa) {', 'transition: margin-left 1s;',
  'space-x-2', 'rtl:tracking-wide', '<textarea>', '<html>', 'direction: rtl;', ch(0x200b), ch(0x2060),
];
const FILES = ['a.css', 'a.scss', 'a.html', 'a.vue', 'a.svelte', 'a.jsx', 'a.tsx', 'a.js', 'a.md', 'fa.json', 'a.py', 'a.yml', 'a.csv'];

function sample(rand, length) {
  let s = '';
  for (let i = 0; i < length; i++) s += PIECES[Math.floor(rand() * PIECES.length)];
  return s;
}

test('fuzz: no crash, fixes converge and are idempotent', () => {
  const rand = rng(20261101);
  // Every other case runs with every rule on, opt-in ones included.
  const ALL = { rules: { '*': 'warn' } };
  for (let i = 0; i < 1500; i++) {
    const filePath = FILES[i % FILES.length];
    const config = i % 2 ? ALL : undefined;
    const text = sample(rand, 5 + Math.floor(rand() * 40));
    const where = `seed case ${i} (${filePath}): ${JSON.stringify(text)}`;
    const lint = lintText(text, { filePath, config });
    assert.ok(!lint.messages.some((m) => m.fatal), `internal error for ${where}`);
    for (const m of lint.messages) {
      assert.ok(m.line >= 1 && m.column >= 1, `bad position for ${where}`);
      if (m.fix) assert.ok(m.fix.range[0] <= m.fix.range[1], `inverted fix range for ${where}`);
    }
    const once = fixText(text, { filePath, config });
    const twice = fixText(once.output, { filePath, config });
    assert.equal(twice.output, once.output, `fix is not idempotent for ${where}`);
    assert.ok(!once.messages.some((m) => m.fix), `fixable problems left after --fix for ${where}`);
  }
});

test('fuzz: long and adversarial inputs finish quickly', () => {
  const long = [
    ['a.css', 'a{' + 'margin-left:1px;'.repeat(20000) + '}'],
    ['a.css', 'a{margin:' + ' 1px'.repeat(50000)],
    ['a.css', '/*'.repeat(50000)],
    ['a.js', '`${'.repeat(20000)],
    ['a.js', '"'.repeat(100000)],
    ['a.jsx', '<div className={' + '{'.repeat(50000)],
    ['a.html', '<input ' + 'type="email" '.repeat(20000)],
    ['a.html', '<html ' + 'lang '.repeat(30000)],
    ['a.md', 'کتاب '.repeat(40000) + 'ها'],
    ['a.md', ('می ' + ZWNJ).repeat(30000)],
    ['a.md', ch(0x0640).repeat(100000)],
    ['a.md', ('پ' + ' '.repeat(5000) + '،').repeat(20)],
    ['a.js', ch(0x202e).repeat(50000)],
  ];
  for (const [filePath, text] of long) {
    const started = performance.now();
    fixText(text, { filePath });
    const ms = performance.now() - started;
    assert.ok(ms < 4000, `${filePath} with ${text.length} chars took ${Math.round(ms)} ms`);
  }
});

test('CRLF and BOM keep positions and fixes correct', () => {
  const css = 'a {\r\n  margin-left: 0;\r\n  padding: 0 1px 0 2px;\r\n}\r\n';
  const r = lintText(css, { filePath: 'a.css' });
  assert.deepEqual(r.messages.map((m) => [m.line, m.column]), [[2, 3], [3, 3]]);
  assert.equal(
    fixText(css, { filePath: 'a.css' }).output,
    'a {\r\n  margin-inline-start: 0;\r\n  padding-block: 0; padding-inline: 2px 1px;\r\n}\r\n',
  );
  const md = 'این يك متن است\r\nکتاب ها\r\n';
  assert.equal(fixText(md, { filePath: 'a.md' }).output, 'این یک متن است\r\nکتاب' + ZWNJ + 'ها\r\n');
});

test('a crashing rule is reported, not thrown', async () => {
  const { getRule } = await import('../src/core.js');
  const rule = getRule('fa/kashida');
  const original = rule.check;
  rule.check = () => {
    throw new Error('boom');
  };
  try {
    const r = lintText('a{margin-left:0}', { filePath: 'a.css' });
    assert.ok(r.messages.some((m) => m.fatal && /boom/.test(m.message)));
    assert.ok(r.messages.some((m) => m.ruleId === 'css/physical-property'));
  } finally {
    rule.check = original;
  }
});
