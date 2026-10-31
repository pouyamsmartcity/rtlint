import { existsSync, readFileSync, statSync, watch as watchFs, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { applyBaseline, createBaseline, readBaseline, writeBaseline } from './baseline.js';
import { LintCache } from './cache.js';
import { explain, init } from './commands.js';
import { findConfig, loadConfig } from './config.js';
import { ruleMatches } from './directives.js';
import { applyRuleOverrides, ConfigError, fixText, lintText, listRules, resolveSettings } from './engine.js';
import { extOf, SUPPORTED_EXTENSIONS } from './file.js';
import { collectFiles, readSource, writeSource } from './files.js';
import { formatters } from './formatters/index.js';
import { changedFiles, stagedFiles } from './git.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const VERSION = pkg.version;

const HELP = `rtlint ${VERSION} — find and fix right-to-left (RTL) and Persian typography bugs
by Pouyam · https://github.com/pouyamsmartcity/rtlint

Usage:
  rtlint [paths/globs...] [options]      lint (default path: .)
  rtlint init [--lang fa] [--force]      create rtlint.config.json for this project
  rtlint explain <rule> [--lang fa]      explain a rule with examples
  rtlint mcp                             run as an MCP server for AI assistants

Fixing:
  --fix                   Apply safe automatic fixes to files
  --fix-dry-run           Compute fixes but do not write them (see -f json)
  --fix-only <rules>      Only apply fixes from these rules, e.g. fa/*,css/physical-property

Choosing files:
  --changed [ref]         Only files changed since a git ref (default HEAD) and untracked files
  --staged                Only files staged for commit (for pre-commit hooks)
  --ignore-pattern <g>    Extra glob to ignore (repeatable)
  --no-error-on-unmatched-pattern  Exit 0 when nothing matches
  --stdin                 Lint text from stdin (with --fix: print fixed text)
  --stdin-filename <p>    File name for --stdin (decides the file type)

Output:
  -f, --format <name>     stylish | compact | json | github | sarif | html | markdown | junit | checkstyle | gitlab | summary
  -o, --output-file <p>   Write the report to a file
  --stats                 Add a per-rule summary after the report
  --quiet                 Report errors only
  --max-warnings <n>      Exit with 1 when there are more than n warnings
  --lang <en|fa>          Language of messages (fa = Persian / فارسی)
  --no-color              Disable colours

Rules and config:
  --rule <id=level>       Set a rule level, e.g. --rule fa/*=off (repeatable)
  -c, --config <path>     Use this config file
  --no-config             Ignore config files
  --persian <auto|on|off> Persian text detection
  --report-unused-disable-directives  Report rtlint-disable comments that suppress nothing
  --print-config <file>   Print the settings that apply to a file
  --list-rules            Show every rule

Large codebases:
  --cache                 Skip files unchanged since the last run (.rtlintcache)
  --cache-location <p>    Where to keep the cache
  --baseline <file>       Hide problems recorded in a baseline file
  --update-baseline       Record all current problems in the baseline file and exit
  --watch                 Re-lint files as they change

  -v, --version / -h, --help

Exit codes: 0 clean, 1 problems found, 2 usage or config error.`;

const TAKES = new Set([
  '-f', '--format', '-o', '--output-file', '--max-warnings', '--rule', '-c', '--config', '--ignore-pattern',
  '--stdin-filename', '--persian', '--lang', '--fix-only', '--cache-location', '--baseline', '--print-config',
]);

function parseArgs(argv) {
  const opts = { paths: [], rules: {}, ignore: [], format: 'stylish', color: undefined };
  if (['init', 'explain', 'mcp'].includes(argv[0])) {
    opts.command = argv[0];
    argv = argv.slice(1);
  }
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    let value;
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    if (eq > 0) {
      value = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    if (TAKES.has(arg) && value === undefined) {
      value = argv[++i];
      if (value === undefined) throw new ConfigError(`${arg} needs a value`);
    }
    switch (arg) {
      case '--fix': opts.fix = true; break;
      case '--fix-dry-run': opts.fix = true; opts.dryRun = true; break;
      case '--fix-only':
        opts.fix = true;
        opts.fixOnly = value.split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case '-f': case '--format': opts.format = value; break;
      case '-o': case '--output-file': opts.output = value; break;
      case '--max-warnings':
        if (!/^\d+$/.test(value)) throw new ConfigError(`--max-warnings expects a whole number, got "${value}"`);
        opts.maxWarnings = Number(value);
        break;
      case '--quiet': opts.quiet = true; break;
      case '--stats': opts.stats = true; break;
      case '--rule': {
        const at = value.lastIndexOf('=');
        if (at < 1) throw new ConfigError(`--rule expects id=level, got "${value}"`);
        opts.rules[value.slice(0, at)] = value.slice(at + 1);
        break;
      }
      case '-c': case '--config': opts.config = value; break;
      case '--no-config': opts.noConfig = true; break;
      case '--ignore-pattern': opts.ignore.push(value); break;
      case '--lang':
        if (!['en', 'fa'].includes(value)) throw new ConfigError('--lang must be en or fa');
        opts.lang = value;
        break;
      case '--persian':
        opts.persian = { on: true, true: true, off: false, false: false, auto: 'auto' }[value];
        if (opts.persian === undefined) throw new ConfigError('--persian must be auto, on or off');
        break;
      case '--changed': {
        // Optional value: --changed main, --changed=main or just --changed.
        const next = argv[i + 1];
        opts.changed = value ?? (next && !next.startsWith('-') && !existsSync(next) ? argv[++i] : 'HEAD');
        break;
      }
      case '--staged': opts.staged = true; break;
      case '--cache': opts.cache = true; break;
      case '--cache-location': opts.cache = true; opts.cacheLocation = value; break;
      case '--baseline': opts.baseline = value; break;
      case '--update-baseline': opts.updateBaseline = true; break;
      case '--watch': opts.watch = true; break;
      case '--report-unused-disable-directives': opts.reportUnused = true; break;
      case '--print-config': opts.printConfig = value; break;
      case '--no-error-on-unmatched-pattern': opts.noErrorOnUnmatched = true; break;
      case '--force': opts.force = true; break;
      case '--stdin': opts.stdin = true; break;
      case '--stdin-filename': opts.stdinFilename = value; break;
      case '--list-rules': opts.listRules = true; break;
      case '--color': opts.color = true; break;
      case '--no-color': opts.color = false; break;
      case '-v': case '--version': opts.version = true; break;
      case '-h': case '--help': opts.help = true; break;
      default:
        if (arg.startsWith('-') && arg !== '-') throw new ConfigError(`Unknown option ${arg} (see rtlint --help)`);
        opts.paths.push(arg);
    }
  }
  if (!formatters[opts.format]) {
    throw new ConfigError(`Unknown format "${opts.format}" (use ${Object.keys(formatters).join(', ')})`);
  }
  if (opts.updateBaseline && !opts.baseline) opts.baseline = 'rtlint-baseline.json';
  return opts;
}

function readStdin(stdin) {
  return new Promise((resolve, reject) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (c) => (data += c));
    stdin.on('end', () => resolve(data));
    stdin.on('error', reject);
  });
}

function listRulesText(lang) {
  const rules = listRules();
  const w = Math.max(...rules.map((r) => r.id.length));
  return rules
    .map((r) => `${r.id.padEnd(w)}  ${r.level.padEnd(5)}  ${r.fixable ? 'fix' : '   '}  ${lang === 'fa' ? r.descriptionFa : r.description}`)
    .join('\n');
}

const SUPPORTED = new Set(SUPPORTED_EXTENSIONS);

/** Runs the CLI. Returns the exit code instead of exiting, so it is testable. */
export async function run(argv, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const cwd = io.cwd ?? process.cwd();
  try {
    const opts = parseArgs(argv);
    if (opts.help) { stdout.write(HELP + '\n'); return 0; }
    if (opts.version) { stdout.write(VERSION + '\n'); return 0; }
    if (opts.listRules) { stdout.write(listRulesText(opts.lang) + '\n'); return 0; }
    if (opts.command === 'init') {
      stdout.write(init(cwd, { force: opts.force, lang: opts.lang }).join('\n') + '\n');
      return 0;
    }
    if (opts.command === 'explain') {
      if (!opts.paths[0]) throw new ConfigError('Usage: rtlint explain <rule> (see rtlint --list-rules)');
      stdout.write(explain(opts.paths[0], opts.lang ?? 'en') + '\n');
      return 0;
    }
    if (opts.command === 'mcp') {
      const { serve } = await import('./mcp.js');
      await serve({ stdin: io.stdin ?? process.stdin, stdout, cwd });
      return 0;
    }

    const found = opts.noConfig ? { config: {}, dir: cwd } : opts.config ? loadConfig(opts.config) : findConfig(cwd);
    const config = found.config;
    // CLI flags are applied after the config and its overrides, so they always win.
    const settingsFor = (filePath) => {
      const settings = applyRuleOverrides(resolveSettings(config, filePath), opts.rules);
      if (opts.persian !== undefined) settings.persian = opts.persian;
      if (opts.lang) settings.lang = opts.lang;
      return settings;
    };
    settingsFor(''); // validate early so a typo fails before any file is touched
    const relToConfig = (abs) => relative(found.dir, abs).split(sep).join('/');
    const lang = opts.lang ?? config.lang ?? 'en';

    if (opts.printConfig) {
      const rel = relToConfig(resolve(cwd, opts.printConfig));
      stdout.write(JSON.stringify(settingsFor(rel), null, 2) + '\n');
      return 0;
    }

    const lintOptions = (filePath) => ({
      filePath,
      settings: settingsFor(filePath),
      reportUnusedDirectives: opts.reportUnused,
      filter: opts.fixOnly ? (m) => opts.fixOnly.some((p) => ruleMatches(p, m.ruleId)) : undefined,
    });

    if (opts.stdin) {
      const input = await readStdin(io.stdin ?? process.stdin);
      const bom = input.charCodeAt(0) === 0xfeff ? input[0] : '';
      const text = bom ? input.slice(1) : input;
      const filePath = opts.stdinFilename ?? 'stdin.txt';
      if (opts.fix) {
        const r = fixText(text, lintOptions(filePath));
        stdout.write(bom + r.output);
        return r.errorCount ? 1 : 0;
      }
      return report([lintText(text, lintOptions(filePath))]);
    }

    const ignore = [...opts.ignore, ...(config.ignore ? [{ patterns: config.ignore, base: found.dir }] : [])];
    const baseline = opts.baseline && !opts.updateBaseline ? readBaseline(resolve(cwd, opts.baseline)) : null;
    const cache = opts.cache && !opts.fix
      ? new LintCache(resolve(cwd, opts.cacheLocation ?? '.rtlintcache'), VERSION)
      : null;

    /** Lints (or fixes) one file; returns a result, or null for a binary file. */
    const processFile = (abs) => {
      const source = readSource(abs);
      if (source === null) return null;
      const rel = relToConfig(abs);
      const options = lintOptions(rel);
      let result;
      if (opts.fix) {
        const r = fixText(source.text, options);
        if (r.fixed && !opts.dryRun) writeSource(abs, r.output, source);
        // --fix-dry-run shows what would change, like ESLint does in its json format.
        result = { ...r, output: opts.dryRun && r.fixed ? r.output : undefined };
      } else {
        const key = cache && LintCache.key(source.text, { s: options.settings, u: !!opts.reportUnused });
        result = (cache && cache.get(rel, key)) ?? lintText(source.text, options);
        if (cache) cache.set(rel, key, result);
      }
      if (baseline) result = applyBaseline(result, baseline, rel, opts.fix && !opts.dryRun ? readSource(abs).text : source.text);
      return { ...result, filePath: abs, source: source.text };
    };

    const pickFiles = () => {
      let files;
      if (opts.changed || opts.staged) {
        const fromGit = opts.staged ? stagedFiles(cwd) : changedFiles(cwd, opts.changed);
        // Keep only lintable, non-ignored files (and those inside the given paths).
        const allowed = new Set(collectFiles(opts.paths.length ? opts.paths : ['.'], { cwd, ignore }));
        files = fromGit.filter((f) => allowed.has(f) && SUPPORTED.has(extOf(f)));
      } else {
        files = collectFiles(opts.paths.length ? opts.paths : ['.'], { cwd, ignore });
      }
      return files;
    };

    function report(results) {
      if (opts.updateBaseline) {
        const data = createBaseline(results, relToConfig, (f) => results.find((r) => r.filePath === f)?.source ?? '');
        writeBaseline(resolve(cwd, opts.baseline), data);
        const count = results.reduce((n, r) => n + r.messages.length, 0);
        stdout.write(
          lang === 'fa'
            ? `${count} مشکل موجود در ${opts.baseline} ثبت شد؛ از این به بعد فقط مشکل‌های تازه گزارش می‌شوند.\n`
            : `Recorded ${count} existing problem${count === 1 ? '' : 's'} in ${opts.baseline}; from now on only new problems are reported.\n`,
        );
        return 0;
      }
      let shown = results.map(({ source, ...r }) => r);
      if (opts.quiet) {
        shown = shown.map((r) => ({
          ...r,
          messages: r.messages.filter((m) => m.severity === 2),
          warningCount: 0,
          fixableWarningCount: 0,
        }));
      }
      const color = opts.color ?? (!opts.output && stdout.isTTY && !process.env.NO_COLOR);
      const context = { cwd, color, version: VERSION, lang };
      let text = formatters[opts.format](shown, context);
      if (opts.stats && opts.format !== 'summary') text += formatters.summary(shown, context);
      if (opts.output) writeFileSync(opts.output, text);
      else if (text) stdout.write(text);

      const errors = results.reduce((n, r) => n + r.errorCount, 0);
      const warnings = results.reduce((n, r) => n + r.warningCount, 0);
      if (errors) return 1;
      if (opts.maxWarnings !== undefined && warnings > opts.maxWarnings) {
        stderr.write(`rtlint found too many warnings (maximum: ${opts.maxWarnings}).\n`);
        return 1;
      }
      return 0;
    }

    const files = pickFiles();
    if (!files.length && !opts.watch) {
      const nothingChanged = opts.changed || opts.staged;
      if (!nothingChanged) stderr.write(`rtlint: no files to lint${opts.paths.length ? ` matched ${opts.paths.join(' ')}` : ''}.\n`);
      if (nothingChanged || opts.noErrorOnUnmatched) return 0;
      // A glob or file that matched nothing is a mistake; an empty folder is not.
      const onlyFolders = opts.paths.every((p) => existsSync(resolve(cwd, p)) && statSync(resolve(cwd, p)).isDirectory());
      return onlyFolders ? 0 : 2;
    }
    const results = files.map(processFile).filter(Boolean);
    cache?.save();
    const code = report(results);
    if (!opts.watch) return code;
    return watchLoop({ opts, cwd, stdout, io, files: new Set(files), processFile, report, ignore });
  } catch (err) {
    stderr.write(`rtlint: ${err instanceof ConfigError ? err.message : err.stack ?? err}\n`);
    return 2;
  }
}

/** --watch: re-lints a file whenever it changes, until io.signal aborts (or forever). */
function watchLoop({ opts, cwd, stdout, io, processFile, report, ignore }) {
  const roots = (opts.paths.length ? opts.paths : ['.']).map((p) => resolve(cwd, p));
  const pending = new Set();
  let timer;
  const flush = () => {
    const files = [...pending].filter((f) => existsSync(f));
    pending.clear();
    if (!files.length) return;
    const allowed = new Set(collectFiles(files, { cwd, ignore }));
    const results = files.filter((f) => allowed.has(f)).map(processFile).filter(Boolean);
    if (!results.length) return;
    stdout.write(`\n[${new Date().toLocaleTimeString()}] ${results.map((r) => relative(cwd, r.filePath)).join(', ')}\n`);
    report(results);
  };
  stdout.write(opts.lang === 'fa' ? '\nدر حال تماشای تغییرها… (برای خروج Ctrl+C)\n' : '\nWatching for changes… (Ctrl+C to stop)\n');
  const watchers = roots.map((root) =>
    watchFs(root, { recursive: statSync(root).isDirectory() }, (_event, name) => {
      if (!name) return;
      const abs = statSync(root).isDirectory() ? resolve(root, String(name)) : root;
      if (!SUPPORTED.has(extOf(abs)) || /[\\/](?:node_modules|\.git)[\\/]/.test(abs)) return;
      pending.add(abs);
      clearTimeout(timer);
      timer = setTimeout(flush, 120);
    }),
  );
  return new Promise((done) => {
    const stop = () => {
      clearTimeout(timer);
      for (const w of watchers) w.close();
      done(0);
    };
    io.signal?.addEventListener('abort', stop, { once: true });
    if (!io.signal) process.once('SIGINT', stop);
  });
}
