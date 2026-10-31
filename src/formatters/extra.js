// Report formats for CI systems, pull requests and people.
import { relative } from 'node:path';
import { listRules } from '../engine.js';

const REPO = 'https://github.com/pouyamsmartcity/rtlint';
const docs = (id, lang) => `${REPO}/blob/main/docs/${lang === 'fa' ? 'rules.fa.md' : 'rules.md'}#${id.replace('/', '')}`;
const posix = (p) => p.split('\\').join('/');
const rel = (file, cwd) => posix(relative(cwd, file) || file);
const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const html = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const all = (results) => results.flatMap((r) => r.messages.map((m) => ({ ...m, filePath: r.filePath })));
const toFa = (n) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

function tally(results) {
  const byRule = new Map();
  for (const m of all(results)) {
    const row = byRule.get(m.ruleId) ?? { ruleId: m.ruleId, errors: 0, warnings: 0, fixable: 0, files: new Set() };
    m.severity === 2 ? row.errors++ : row.warnings++;
    if (m.fix) row.fixable++;
    row.files.add(m.filePath);
    byRule.set(m.ruleId, row);
  }
  return [...byRule.values()].sort((a, b) => b.errors + b.warnings - (a.errors + a.warnings));
}

/** A per-rule table: which rules fire most, and how much --fix can do. */
export function summary(results, { lang = 'en' } = {}) {
  const rows = tally(results);
  if (!rows.length) return '';
  const fa = lang === 'fa';
  const head = fa ? ['قانون', 'تعداد', 'فایل', 'قابل اصلاح'] : ['Rule', 'Count', 'Files', 'Fixable'];
  const body = rows.map((r) => [r.ruleId, r.errors + r.warnings, r.files.size, r.fixable].map(String));
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const line = (cells) => '  ' + cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('   ');
  return ['', line(head), '  ' + widths.map((w) => '─'.repeat(w)).join('   '), ...body.map(line), ''].join('\n') + '\n';
}

/** Markdown for pull request comments and GitHub job summaries. */
export function markdown(results, { cwd = process.cwd(), lang = 'en' } = {}) {
  const fa = lang === 'fa';
  const messages = all(results);
  const errors = messages.filter((m) => m.severity === 2).length;
  const warnings = messages.length - errors;
  const fixable = messages.filter((m) => m.fix).length;
  if (!messages.length) return fa ? '### ✅ rtlint: مشکلی پیدا نشد\n' : '### ✅ rtlint: no RTL problems found\n';
  let out = fa
    ? `### rtlint: ${messages.length} مشکل (${errors} خطا، ${warnings} هشدار)، ${fixable} مورد خودکار درست می‌شود\n\n`
    : `### rtlint: ${messages.length} problem${messages.length === 1 ? '' : 's'} (${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}), ${fixable} fixable\n\n`;
  out += fa ? '| قانون | تعداد | قابل اصلاح |\n| --- | ---: | ---: |\n' : '| Rule | Count | Fixable |\n| --- | ---: | ---: |\n';
  for (const r of tally(results)) out += `| [\`${r.ruleId}\`](${docs(r.ruleId, lang)}) | ${r.errors + r.warnings} | ${r.fixable} |\n`;
  out += `\n<details><summary>${fa ? 'جزئیات' : 'Details'}</summary>\n\n`;
  for (const r of results) {
    if (!r.messages.length) continue;
    out += `**\`${rel(r.filePath, cwd)}\`**\n\n`;
    for (const m of r.messages) {
      const icon = m.severity === 2 ? '🔴' : '🟡';
      out += `- ${icon} \`${m.line}:${m.column}\` ${m.message.replace(/\|/g, '\\|')} — \`${m.ruleId}\`${m.fix ? ' ✎' : ''}\n`;
    }
    out += '\n';
  }
  out += '</details>\n\n';
  out += fa ? `با \`npx rtlint --fix\` موارد ✎ خودکار درست می‌شوند. [rtlint ساخته‌ی پویام](${REPO})\n` : `Run \`npx rtlint --fix\` to apply the ✎ fixes. [rtlint by Pouyam](${REPO})\n`;
  return out;
}

/** JUnit XML: one test case per file, one failure per problem (Jenkins, GitLab, Azure). */
export function junit(results, { cwd = process.cwd() } = {}) {
  const messages = all(results);
  let out = '<?xml version="1.0" encoding="utf-8"?>\n';
  out += `<testsuites name="rtlint" tests="${results.length}" failures="${messages.length}">\n`;
  out += `  <testsuite name="rtlint" tests="${results.length}" failures="${messages.length}" errors="0">\n`;
  for (const r of results) {
    const name = xml(rel(r.filePath, cwd));
    if (!r.messages.length) {
      out += `    <testcase classname="rtlint" name="${name}"/>\n`;
      continue;
    }
    out += `    <testcase classname="rtlint" name="${name}">\n`;
    for (const m of r.messages) {
      out += `      <failure type="${xml(m.ruleId)}" message="${xml(m.message)}">${xml(`${name}:${m.line}:${m.column} ${m.message} (${m.ruleId})`)}</failure>\n`;
    }
    out += '    </testcase>\n';
  }
  return out + '  </testsuite>\n</testsuites>\n';
}

/** Checkstyle XML (Jenkins Warnings NG, reviewdog, SonarQube imports). */
export function checkstyle(results, { cwd = process.cwd() } = {}) {
  let out = '<?xml version="1.0" encoding="utf-8"?>\n<checkstyle version="4.3">\n';
  for (const r of results) {
    out += `  <file name="${xml(rel(r.filePath, cwd))}">\n`;
    for (const m of r.messages) {
      out += `    <error line="${m.line}" column="${m.column}" severity="${m.severity === 2 ? 'error' : 'warning'}" message="${xml(m.message)}" source="rtlint.${xml(m.ruleId)}"/>\n`;
    }
    out += '  </file>\n';
  }
  return out + '</checkstyle>\n';
}

/** GitLab Code Quality report (merge request widget). */
export function gitlab(results, { cwd = process.cwd() } = {}) {
  const issues = [];
  for (const r of results) {
    for (const m of r.messages) {
      const path = rel(r.filePath, cwd);
      const fingerprint = simpleHash(`${path}:${m.ruleId}:${m.line}:${m.column}:${m.message}`);
      issues.push({
        description: m.message,
        check_name: m.ruleId,
        fingerprint,
        severity: m.severity === 2 ? 'major' : 'minor',
        location: { path, lines: { begin: m.line, end: m.endLine } },
      });
    }
  }
  return JSON.stringify(issues, null, 2) + '\n';
}

function simpleHash(s) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/** A self-contained HTML report (Persian reports are right-to-left), for sharing or CI artifacts. */
export function htmlReport(results, { cwd = process.cwd(), lang = 'en', version = '' } = {}) {
  const fa = lang === 'fa';
  const n = (x) => (fa ? toFa(x) : String(x));
  const messages = all(results);
  const errors = messages.filter((m) => m.severity === 2).length;
  const fixable = messages.filter((m) => m.fix).length;
  const ruleDescriptions = new Map(listRules().map((r) => [r.id, fa ? r.descriptionFa : r.description]));
  const t = fa
    ? { title: 'گزارش rtlint', problems: 'مشکل', errors: 'خطا', warnings: 'هشدار', fixable: 'قابل اصلاح خودکار', files: 'فایل', clean: 'مشکلی پیدا نشد.', byRule: 'بر اساس قانون', fix: 'برای اصلاح خودکار:' }
    : { title: 'rtlint report', problems: 'problems', errors: 'errors', warnings: 'warnings', fixable: 'fixable', files: 'files', clean: 'No RTL problems found.', byRule: 'By rule', fix: 'To apply the safe fixes:' };
  const cards = [
    [n(messages.length), t.problems],
    [n(errors), t.errors],
    [n(messages.length - errors), t.warnings],
    [n(fixable), t.fixable],
    [n(results.filter((r) => r.messages.length).length), t.files],
  ]
    .map(([v, l]) => `<div class="card"><b>${v}</b><span>${l}</span></div>`)
    .join('');
  const rules = tally(results)
    .map((r) => `<tr><td><a href="${docs(r.ruleId, lang)}"><code>${html(r.ruleId)}</code></a><br><small>${html(ruleDescriptions.get(r.ruleId) ?? '')}</small></td><td>${n(r.errors + r.warnings)}</td><td>${n(r.fixable)}</td></tr>`)
    .join('');
  const files = results
    .filter((r) => r.messages.length)
    .map((r) => {
      const items = r.messages
        .map((m) => `<li><span class="pos">${m.line}:${m.column}</span><span class="sev ${m.severity === 2 ? 'e' : 'w'}">${m.severity === 2 ? t.errors.replace(/s$/, '') : t.warnings.replace(/s$/, '')}</span><span class="msg">${html(m.message)}</span><a class="rule" href="${docs(m.ruleId, lang)}"><code>${html(m.ruleId)}</code></a>${m.fix ? ' <span class="fix">✎</span>' : ''}</li>`)
        .join('');
      return `<details open><summary><code>${html(rel(r.filePath, cwd))}</code> <small>${n(r.messages.length)}</small></summary><ol>${items}</ol></details>`;
    })
    .join('');
  return `<!doctype html>
<html lang="${fa ? 'fa' : 'en'}" dir="${fa ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${t.title}</title>
<style>
:root{--bg:#f6f5fb;--panel:#fff;--ink:#1b1830;--muted:#625e7c;--line:#e4e1f0;--accent:#6d4aff;--e:#c81e4f;--w:#a1620b}
@media (prefers-color-scheme:dark){:root{--bg:#0f0d1a;--panel:#18152a;--ink:#ecebf5;--muted:#a29ec0;--line:#2b2745;--accent:#8b6dff;--e:#ff6b93;--w:#f2b84b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 Vazirmatn,system-ui,"Segoe UI",Tahoma,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px}h1{margin:0 0 4px}a{color:var(--accent)}code{font-family:ui-monospace,Consolas,monospace;direction:ltr;unicode-bidi:isolate}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:18px 0}.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}.card b{display:block;font-size:26px}.card span{color:var(--muted)}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}td,th{padding:8px 12px;border-bottom:1px solid var(--line);text-align:start}small{color:var(--muted)}
details{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin:10px 0;padding:6px 12px}summary{cursor:pointer;font-weight:700}ol{list-style:none;padding:0;margin:6px 0}
li{display:grid;grid-template-columns:auto auto 1fr auto;gap:4px 10px;padding:6px 0;border-top:1px solid var(--line);align-items:start}.pos{font-family:ui-monospace,monospace;color:var(--muted);direction:ltr}
.sev{font-size:12px;font-weight:700;border-radius:99px;padding:0 8px;border:1px solid}.sev.e{color:var(--e)}.sev.w{color:var(--w)}.msg{unicode-bidi:plaintext}.fix{color:var(--accent)}
pre{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px;direction:ltr;text-align:left}
@media(max-width:640px){li{grid-template-columns:auto auto 1fr}.rule{grid-column:3}}
</style></head>
<body><main>
<h1>${t.title}</h1><small>rtlint ${html(version)} · ${new Date().toISOString().slice(0, 10)} · <a href="${REPO}">${fa ? 'ساخته‌ی پویام' : 'by Pouyam'}</a></small>
<div class="cards">${cards}</div>
${messages.length ? `<h2>${t.byRule}</h2><table><tbody>${rules}</tbody></table>${files}<p>${t.fix}</p><pre>npx rtlint --fix${fa ? ' --lang fa' : ''}</pre>` : `<p>✅ ${t.clean}</p>`}
</main></body></html>
`;
}
