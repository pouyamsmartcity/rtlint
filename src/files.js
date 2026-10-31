import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { extOf, SUPPORTED_EXTENSIONS } from './file.js';
import { matchAny } from './glob.js';

export const DEFAULT_IGNORE = [
  '**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/out/**', '**/coverage/**',
  '**/.next/**', '**/.nuxt/**', '**/.svelte-kit/**', '**/.output/**', '**/.vercel/**',
  '**/.turbo/**', '**/.cache/**', '**/vendor/**', '**/*.min.js', '**/*.min.css', '**/*.map',
  '**/package-lock.json', '**/pnpm-lock.yaml', '**/yarn.lock', '**/npm-shrinkwrap.json',
];

const MAX_BYTES = 2 * 1024 * 1024;
const SUPPORTED = new Set(SUPPORTED_EXTENSIONS);

/** Turns .gitignore lines into globs (negations are not supported and skipped). */
export function gitignoreGlobs(dir) {
  const path = join(dir, '.gitignore');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('!'))
    .flatMap((l) => (l.endsWith('/') || l.includes('*') ? [l] : [l, l + '/']));
}

const toPosix = (p) => p.split('\\').join('/');
const isGlob = (p) => /[*?{[]/.test(p);

/**
 * Expands paths, directories and globs into a sorted list of files to lint.
 * Explicit file arguments are always included unless ignored.
 */
export function collectFiles(inputs, { cwd = process.cwd(), ignore = [] } = {}) {
  const patterns = [...DEFAULT_IGNORE, ...gitignoreGlobs(cwd), ...ignore];
  const ignored = (rel, dir = false) => matchAny(dir ? rel + '/' : rel, patterns);
  const found = new Set();
  const globs = inputs.filter(isGlob);

  const walk = (abs, filter) => {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const child = join(abs, e.name);
      const rel = toPosix(relative(cwd, child));
      if (e.isDirectory()) {
        if (!ignored(rel, true)) walk(child, filter);
      } else if (e.isFile() && !ignored(rel) && filter(rel)) {
        found.add(resolve(child));
      }
    }
  };

  for (const input of inputs.filter((p) => !isGlob(p))) {
    const abs = resolve(cwd, input);
    if (!existsSync(abs)) throw new Error(`No such file or directory: ${input}`);
    const rel = toPosix(relative(cwd, abs)) || '.';
    if (statSync(abs).isDirectory()) {
      walk(abs, (r) => SUPPORTED.has(extOf(r)));
    } else if (!ignored(rel)) {
      found.add(abs);
    }
  }
  if (globs.length) walk(resolve(cwd), (r) => matchAny(r, globs));

  return [...found].filter((f) => statSync(f).size <= MAX_BYTES).sort();
}

/** Reads a file as UTF-8 text, or returns null for binary content. */
export function readText(path) {
  const buf = readFileSync(path);
  if (buf.subarray(0, 8000).includes(0)) return null;
  return buf.toString('utf8');
}
