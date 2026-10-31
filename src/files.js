import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
export function collectFiles(inputs, { cwd = process.cwd(), ignore = [], ignoreBase, gitignore = true } = {}) {
  // `ignore` holds strings (relative to cwd) or { patterns, base } groups,
  // e.g. a config file's "ignore", which is relative to the config's folder.
  // Default ignores are relative to the folder being walked, so a project
  // that itself lives under some build/ or vendor/ folder is still linted.
  const groups = [{ patterns: DEFAULT_IGNORE, base: null }];
  const loose = ignore.filter((p) => typeof p === 'string');
  if (loose.length) groups.push({ patterns: loose, base: resolve(ignoreBase ?? cwd) });
  for (const g of ignore) if (typeof g === 'object') groups.push({ patterns: g.patterns, base: resolve(g.base) });

  // A pattern without wildcards ("legacy") excludes that file or folder and everything in it.
  const excluded = (abs, dir, root) =>
    groups.some(({ patterns, base }) => {
      const rel = toPosix(relative(base ?? root, abs));
      if (rel.startsWith('../') || rel === '..' || rel === '') return false;
      const parts = rel.split('/');
      for (let k = 1; k <= parts.length; k++) {
        const prefix = parts.slice(0, k).join('/');
        const isLast = k === parts.length;
        if (matchAny(prefix + (!isLast || dir ? '/' : ''), patterns) || (!isLast && matchAny(prefix, patterns))) return true;
        if (isLast && matchAny(prefix, patterns)) return true;
      }
      return false;
    });
  const found = new Set();
  // A path that exists is a path, even with [brackets] (Next.js and SvelteKit routes).
  const globs = inputs.filter((p) => isGlob(p) && !existsSync(resolve(cwd, p)));

  const walk = (abs, stack, filter, root = abs) => {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const child = join(abs, e.name);
      if (e.isDirectory()) {
        if (excluded(child, true, root) || (gitignore && gitIgnored(stack, child, true))) continue;
        let next = stack;
        if (gitignore) {
          const own = loadGitignore(child);
          next = existsSync(join(child, '.git')) ? [own].filter(Boolean) : own ? [...stack, own] : stack;
        }
        walk(child, next, filter, root);
      } else if (e.isFile()) {
        if (excluded(child, false, root) || (gitignore && gitIgnored(stack, child, false))) continue;
        if (filter(toPosix(relative(cwd, child)))) found.add(resolve(child));
      }
    }
  };

  for (const input of inputs.filter((p) => !globs.includes(p))) {
    const abs = resolve(cwd, input);
    if (!existsSync(abs)) throw new Error(`No such file or directory: ${input}`);
    if (statSync(abs).isDirectory()) {
      walk(abs, gitignore ? stackFor(abs) : [], (r) => SUPPORTED.has(extOf(r)));
    } else if (!excluded(abs, false, resolve(cwd))) {
      found.add(abs);
    }
  }
  if (globs.length) {
    const root = resolve(cwd);
    walk(root, gitignore ? stackFor(root) : [], (r) => matchAny(r, globs));
  }

  return [...found].filter((f) => statSync(f).size <= MAX_BYTES).sort();
}

/**
 * Reads a source file. UTF-8 (with or without a BOM) and BOM-marked UTF-16
 * (the default for iOS .strings and some Windows tools) are supported; other
 * files containing NUL bytes are treated as binary and return null. The BOM
 * is removed from `text` (editors do not count it as a column) and recorded
 * so writeSource can put it back.
 */
export function readSource(path) {
  const buf = readFileSync(path);
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.subarray(2).toString('utf16le'), encoding: 'utf16le', bom: true };
  }
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const body = Buffer.from(buf.subarray(2, 2 + ((buf.length - 2) & ~1)));
    return { text: body.swap16().toString('utf16le'), encoding: 'utf16be', bom: true };
  }
  if (buf.subarray(0, 8000).includes(0)) return null;
  const text = buf.toString('utf8');
  const bom = text.charCodeAt(0) === 0xfeff;
  return { text: bom ? text.slice(1) : text, encoding: 'utf8', bom };
}

/** Writes text back in the encoding (and with the BOM) readSource found. */
export function writeSource(path, text, { encoding = 'utf8', bom = false } = {}) {
  const mark = bom ? String.fromCharCode(0xfeff) : '';
  if (encoding === 'utf8') return writeFileSync(path, mark + text);
  const buf = Buffer.from(mark + text, 'utf16le');
  return writeFileSync(path, encoding === 'utf16be' ? buf.swap16() : buf);
}

/** Reads a file as text (see readSource), or returns null for binary content. */
export function readText(path) {
  return readSource(path)?.text ?? null;
}
