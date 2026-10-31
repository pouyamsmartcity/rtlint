// Renders docs/demo.svg from a real run on examples/demo: node scripts/render-demo.js
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { collectFiles } from '../src/files.js';
import { lintText } from '../src/core.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const demo = join(root, 'examples', 'demo');
const files = collectFiles(['src'], { cwd: demo });
// `node scripts/render-demo.js fa` renders docs/demo.fa.svg with Persian messages.
const fa = process.argv[2] === 'fa';
const config = { lang: fa ? 'fa' : 'en' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// Each row is a list of cells placed at fixed x positions, so proportional
// Persian glyphs cannot push the rule column out of line.
const rows = [{ y: 0, cells: [[0, '$ ', 'dim'], [16, fa ? 'npx rtlint src --lang fa' : 'npx rtlint src', 'fg']] }, null];
let errors = 0;
let warnings = 0;
let fixable = 0;
for (const abs of files) {
  const rel = relative(demo, abs).split(sep).join('/');
  const r = lintText(readFileSync(abs, 'utf8'), { filePath: rel, config });
  if (!r.messages.length) continue;
  rows.push({ cells: [[0, rel, 'path']] });
  for (const m of r.messages) {
    const err = m.severity === 2;
    err ? errors++ : warnings++;
    if (m.fix) fixable++;
    rows.push({
      cells: [
        [16, `${m.line}:${m.column}`, 'dim'],
        [72, fa ? (err ? 'خطا' : 'هشدار') : err ? 'error' : 'warning', err ? 'red' : 'yellow'],
        // Persian messages read right to left, anchored at the right edge of their column.
        fa
          ? [940, clip(m.message.replace(/ \(یا dir="auto"\)/, ''), 104), 'fg', 'rtl']
          : [140, clip(m.message.replace(/ \(or dir="auto"\)\./, '.'), 98), 'fg'],
        [960, m.ruleId + (m.fix ? ' ✎' : ''), 'dim'],
      ],
    });
  }
  rows.push(null);
}
const total = fa
  ? `✖ ${errors + warnings} مشکل (${errors} خطا، ${warnings} هشدار)`
  : `✖ ${errors + warnings} problems (${errors} errors, ${warnings} warnings)`;
rows.push({ cells: [[0, total, 'redb', fa ? 'rtl' : 'ltr']] });
rows.push({ cells: [[16, fa ? `${fixable} مورد با --fix خودکار درست می‌شود ✎` : `${fixable} fixable with --fix ✎`, 'dim', fa ? 'rtl' : 'ltr']] });

const W = 1240;
const LH = 22;
const TOP = 58;
const H = TOP + (rows.length - 1) * LH + 26;
const COLORS = { fg: '#e6e4f2', dim: '#8f8aa8', red: '#ff6b93', redb: '#ff6b93', yellow: '#f2c14b', path: '#c7b8ff' };
const ARABIC = /[\u0600-\u06FF]/;

/** Arabic-script runs become isolated RTL spans so they read correctly inside English text. */
const RUN = /([\u0600-\u06FF](?:[\u0600-\u06FF\u200C ]*[\u0600-\u06FF])?)/;
function rich(text) {
  return text
    .split(RUN)
    .map((part) => (ARABIC.test(part) ? `<tspan direction="rtl" unicode-bidi="isolate">${esc(part)}</tspan>` : esc(part)))
    .join('');
}

let body = '';
rows.forEach((row, i) => {
  if (!row) return;
  const y = TOP + i * LH;
  for (const [x, text, c, dir = 'ltr'] of row.cells) {
    // A right-to-left summary line starts at the right edge of the terminal.
    const left = dir === 'rtl' && x < 100 ? W - 48 - x : x;
    const attrs = [
      `x="${24 + left}"`,
      `direction="${dir}"`,
      dir === 'rtl' ? 'unicode-bidi="embed"' : '',
      `y="${y}"`,
      `fill="${COLORS[c]}"`,
      c === 'redb' ? 'font-weight="700"' : '',
      c === 'path' ? 'text-decoration="underline"' : '',
    ].filter(Boolean).join(' ');
    // An isolated RTL tspan is anchored at its right edge in SVG, so a cell that is a
    // single Persian word (the severity) is written as plain text instead.
    const plain = dir === 'rtl' || c === 'red' || c === 'yellow';
    body += `    <text ${attrs}>${plain ? esc(text) : rich(text)}</text>\n`;
  }
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="rtlint output on a demo Svelte project">
  <rect width="${W}" height="${H}" rx="12" fill="#14111f"/>
  <circle cx="24" cy="20" r="6" fill="#ff5f57"/><circle cx="44" cy="20" r="6" fill="#febc2e"/><circle cx="64" cy="20" r="6" fill="#28c840"/>
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, Vazirmatn, Tahoma, monospace" font-size="13.5">
${body}  </g>
</svg>
`;
const out = fa ? 'demo.fa.svg' : 'demo.svg';
writeFileSync(join(root, 'docs', out), svg);
console.log(`docs/${out}: ${rows.length} rows`);
