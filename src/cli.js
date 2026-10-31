import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { findConfig, loadConfig } from './config.js';
import { applyRuleOverrides, ConfigError, fixText, lintText, listRules, resolveSettings } from './engine.js';
import { collectFiles, readSource, writeSource } from './files.js';
import { formatters } from './formatters/index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const VERSION = pkg.version;

const HELP = `rtlint ${VERSION} — find and fix right-to-left (RTL) and Persian typography bugs

Usage: rtlint [paths/globs...] [options]      (default path: .)

Options:
  --fix                   Apply safe automatic fixes to files
  --fix-dry-run           Compute fixes but do not write them
  -f, --format <name>     stylish (default) | compact | json | github | sarif
  -o, --output-file <p>   Write the report to a file
  --max-warnings <n>      Exit with 1 when there are more than n warnings
  --quiet                 Report errors only
  --rule <id=level>       Set a rule level, e.g. --rule fa/*=off (repeatable)
  -c, --config <path>     Use this config file
  --no-config             Ignore config files
  --ignore-pattern <g>    Extra glob to ignore (repeatable)
  --persian <auto|on|off> Persian text detection
  --lang <en|fa>          Language of messages (fa = Persian / فارسی)
  --stdin                 Lint text from stdin (with --fix: print fixed text)
  --stdin-filename <p>    File name for --stdin (decides the file type)
  --list-rules            Show every rule
  --no-color              Disable colours
  -v, --version           Print the version
  -h, --help              Show this help

Exit codes: 0 clean, 1 problems found, 2 usage or config error.
Docs: https://github.com/pouyamsmartcity/rtlint`;

function parseArgs(argv) {
  const opts = { paths: [], rules: {}, ignore: [], format: 'stylish', color: undefined };
  const takes = new Set(['-f', '--format', '-o', '--output-file', '--max-warnings', '--rule', '-c', '--config', '--ignore-pattern', '--stdin-filename', '--persian', '--lang']);
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    let value;
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    if (eq > 0) {
      value = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    if (takes.has(arg) && value === undefined) {
      value = argv[++i];
      if (value === undefined) throw new ConfigError(`${arg} needs a value`);
    }
    switch (arg) {
      case '--fix': opts.fix = true; break;
      case '--fix-dry-run': opts.fix = true; opts.dryRun = true; break;
      case '-f': case '--format': opts.format = value; break;
      case '-o': case '--output-file': opts.output = value; break;
      case '--max-warnings':
        if (!/^\d+$/.test(value)) throw new ConfigError(`--max-warnings expects a whole number, got "${value}"`);
        opts.maxWarnings = Number(value);
        break;
      case '--quiet': opts.quiet = true; break;
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

    const results = [];
    if (opts.stdin) {
      const input = await readStdin(io.stdin ?? process.stdin);
      const bom = input.charCodeAt(0) === 0xfeff ? input[0] : '';
      const text = bom ? input.slice(1) : input;
      const filePath = opts.stdinFilename ?? 'stdin.txt';
      const options = { filePath, settings: settingsFor(filePath) };
      if (opts.fix) {
        const r = fixText(text, options);
        stdout.write(bom + r.output);
        return r.errorCount ? 1 : 0;
      }
      results.push(lintText(text, options));
    } else {
      const files = collectFiles(opts.paths.length ? opts.paths : ['.'], {
        cwd,
        ignore: [...opts.ignore, ...(config.ignore ? [{ patterns: config.ignore, base: found.dir }] : [])],
      });
      if (!files.length) {
        stderr.write(`rtlint: no files to lint${opts.paths.length ? ` matched ${opts.paths.join(' ')}` : ''}.\n`);
        // A glob or file that matched nothing is a mistake; an empty folder is not.
        const onlyFolders = opts.paths.every((p) => existsSync(resolve(cwd, p)) && statSync(resolve(cwd, p)).isDirectory());
        return onlyFolders ? 0 : 2;
      }
      for (const abs of files) {
        const source = readSource(abs);
        if (source === null) continue;
        const rel = relToConfig(abs);
        const options = { filePath: rel, settings: settingsFor(rel) };
        if (opts.fix) {
          const r = fixText(source.text, options);
          if (r.fixed && !opts.dryRun) writeSource(abs, r.output, source);
          // --fix-dry-run shows what would change, like ESLint does in its json format.
          results.push({ ...r, filePath: abs, output: opts.dryRun && r.fixed ? r.output : undefined });
        } else {
          results.push({ ...lintText(source.text, options), filePath: abs });
        }
      }
    }

    let shown = results;
    if (opts.quiet) {
      shown = results.map((r) => ({
        ...r,
        messages: r.messages.filter((m) => m.severity === 2),
        warningCount: 0,
        fixableWarningCount: 0,
      }));
    }
    const color = opts.color ?? (!opts.output && stdout.isTTY && !process.env.NO_COLOR);
    const lang = opts.lang ?? config.lang ?? 'en';
    const report = formatters[opts.format](shown, { cwd, color, version: VERSION, lang });
    if (opts.output) writeFileSync(opts.output, report);
    else if (report) stdout.write(report);

    const errors = results.reduce((n, r) => n + r.errorCount, 0);
    const warnings = results.reduce((n, r) => n + r.warningCount, 0);
    if (errors) return 1;
    if (opts.maxWarnings !== undefined && warnings > opts.maxWarnings) {
      stderr.write(`rtlint found too many warnings (maximum: ${opts.maxWarnings}).\n`);
      return 1;
    }
    return 0;
  } catch (err) {
    stderr.write(`rtlint: ${err instanceof ConfigError ? err.message : err.stack ?? err}\n`);
    return 2;
  }
}
