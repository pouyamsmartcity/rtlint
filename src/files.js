import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { extOf, SUPPORTED_EXTENSIONS } from './file.js';
import { globToRegExp, matchAny } from './glob.js';

export const DEFAULT_IGNORE = [
  '**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/out/**', '**/coverage/**',
  '**/.next/**', '**/.nuxt/**', '**/.svelte-kit/**', '**/.output/**', '**/.vercel/**',
  '**/.turbo/**', '**/.cache/**', '**/vendor/**', '**/*.min.js', '**/*.min.css', '**/*.map',
  '**/package-lock.json', '**/pnpm-lock.yaml', '**/yarn.lock', '**/npm-shrinkwrap.json',
];

const MAX_BYTES = 2 * 1024 * 1024;
const SUPPORTED = new Set(SUPPORTED_EXTENSIONS);

const toPosix = (p) => p.split('\\').join('/');
const isGlob = (p) => /[*?{[]/.test(p);

/**
 * Parses one .gitignore into rules evaluated with git's semantics: patterns
 * are relative to the file's directory, a slash anywhere but the end anchors
 * them, a trailing slash matches directories only, "!" re-includes, and the
 * last matching line wins.
 */
export function parseGitignore(source) {
  const rules = [];
  for (let line of source.split(/\r?\n/)) {
    line = line.replace(/(?<!\\)\s+$/, '');
    if (!line || line.startsWith('#')) continue;
    let negate = false;
    if (line.startsWith('!')) {
      negate = true;
      line = line.slice(1);
    }
    line = line.replace(/^\\([#!])/, '$1');
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    if (!line) continue;
    const anchored = line.includes('/');
    const glob = anchored ? '/' + line.replace(/^\//, '') : line;
    rules.push({ negate, dirOnly, re: globToRegExp(glob) });
  }
  return rules;
}

/** true = ignored, false = re-included, undefined = no rule matched. */
function decide(rules, rel, isDir) {
  for (let i = rules.length - 1; i >= 0; i--) {
    const r = rules[i];
    if (r.dirOnly && !isDir) continue;
    if (r.re.test(rel)) return !r.negate;
  }
  return undefined;
}

function loadGitignore(dir) {
  const path = join(dir, '.gitignore');
  if (!existsSync(path)) return null;
  try {
    return { dir, rules: parseGitignore(readFileSync(path, 'utf8')) };
  } catch {
    return null;
  }
}

/** True when an ignore stack (deepest .gitignore wins) ignores `abs`. */
function gitIgnored(stack, abs, isDir) {
  for (let i = stack.length - 1; i >= 0; i--) {
    const { dir, rules } = stack[i];
    const verdict = decide(rules, toPosix(relative(dir, abs)), isDir);
    if (verdict !== undefined) return verdict;
  }
  return false;
}

/** The repository root holding `dir` (nearest ancestor with .git), or null. */
function repoRoot(dir) {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, '.git'))) return d;
    if (dirname(d) === d) return null;
  }
}

/** .gitignore files from the repository root down to `dir`, shallowest first. */
function stackFor(dir) {
  const root = repoRoot(dir);
  if (!root) return [loadGitignore(dir)].filter(Boolean);
  const chain = [];
  for (let d = dir; ; d = dirname(d)) {
    chain.unshift(d);
    if (d === root) break;
  }
  return chain.map(loadGitignore).filter(Boolean);
}

/**
 * Expands paths, directories and globs into a sorted list of files to lint.
 *
 * Directories are walked with the default ignores, `ignore` globs and every
 * .gitignore on the way (nested repositories start fresh). Files named
 * explicitly are always linted unless a default or `ignore` glob excludes
 * them, so `rtlint some/ignored/file.css` still works.
 */
export function collectFiles(inputs, { cwd = process.cwd(), ignore = [], gitignore = true } = {}) {
  const patterns = [...DEFAULT_IGNORE, ...ignore];
  const excluded = (abs, dir = false) => {
    const rel = toPosix(relative(cwd, abs));
    return matchAny(dir ? rel + '/' : rel, patterns);
  };
  const found = new Set();
  const globs = inputs.filter(isGlob);

  const walk = (abs, stack, filter) => {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const child = join(abs, e.name);
      if (e.isDirectory()) {
        if (excluded(child, true) || (gitignore && gitIgnored(stack, child, true))) continue;
        let next = stack;
        if (gitignore) {
          const own = loadGitignore(child);
          next = existsSync(join(child, '.git')) ? [own].filter(Boolean) : own ? [...stack, own] : stack;
        }
        walk(child, next, filter);
      } else if (e.isFile()) {
        if (excluded(child) || (gitignore && gitIgnored(stack, child, false))) continue;
        if (filter(toPosix(relative(cwd, child)))) found.add(resolve(child));
      }
    }
  };

  for (const input of inputs.filter((p) => !isGlob(p))) {
    const abs = resolve(cwd, input);
    if (!existsSync(abs)) throw new Error(`No such file or directory: ${input}`);
    if (statSync(abs).isDirectory()) {
      walk(abs, gitignore ? stackFor(abs) : [], (r) => SUPPORTED.has(extOf(r)));
    } else if (!excluded(abs)) {
      found.add(abs);
    }
  }
  if (globs.length) {
    const root = resolve(cwd);
    walk(root, gitignore ? stackFor(root) : [], (r) => matchAny(r, globs));
  }

  return [...found].filter((f) => statSync(f).size <= MAX_BYTES).sort();
}

/** Reads a file as UTF-8 text, or returns null for binary content. */
export function readText(path) {
  const buf = readFileSync(path);
  if (buf.subarray(0, 8000).includes(0)) return null;
  return buf.toString('utf8');
}
