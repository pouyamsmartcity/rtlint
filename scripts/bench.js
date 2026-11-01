// Speed check on a generated project: node scripts/bench.js [files=2000]
// Writes a mix of CSS, TSX, Svelte, Markdown and JSON translations (with real
// problems in them) to a temp folder and times lintFiles over all of it.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintFiles } from '../src/index.js';

const count = Number(process.argv[2] ?? 2000);
const dir = mkdtempSync(join(tmpdir(), 'rtlint-bench-'));
const css = Array.from({ length: 60 }, (_, i) => `.c${i} { margin-left: ${i}px; padding: 0 4px 0 2px; color: red; display: flex; }`).join('\n');
const tsx = Array.from({ length: 40 }, (_, i) => `export const C${i} = () => <div className="ml-${i % 8} flex gap-2 text-left" style={{ marginLeft: ${i} }}>متن ${i}</div>;`).join('\n');
const svelte = `<script>\n  let open = false;\n</script>\n${Array.from({ length: 40 }, (_, i) => `<p class="pl-2 text-right">کتاب ها و ${i}</p>`).join('\n')}\n<style>\n${css}\n</style>`;
const md = Array.from({ length: 80 }, (_, i) => `من مي خواهم كتاب ها را بخوانم, ولی ${i} وقت ندارم?`).join('\n');
const json = JSON.stringify(Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, `این يك متن ${i} است`])), null, 2);
const kinds = [['css', css], ['tsx', tsx], ['svelte', svelte], ['md', md], ['json', json]];
let bytes = 0;
for (let i = 0; i < count; i++) {
  const [ext, text] = kinds[i % kinds.length];
  const sub = join(dir, `d${i % 40}`);
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(sub, `f${i}.${ext}`), text);
  bytes += Buffer.byteLength(text);
}
const started = performance.now();
const results = await lintFiles(['.'], { cwd: dir });
const ms = performance.now() - started;
const problems = results.reduce((n, r) => n + r.messages.length, 0);
console.log(`${results.length} files, ${(bytes / 1048576).toFixed(1)} MB, ${problems} problems in ${(ms / 1000).toFixed(2)} s` +
  ` (${Math.round(results.length / (ms / 1000))} files/s) on Node ${process.version}`);
rmSync(dir, { recursive: true, force: true });
