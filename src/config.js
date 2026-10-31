import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ConfigError } from './engine.js';

export const CONFIG_FILES = ['rtlint.config.json', '.rtlintrc.json', '.rtlintrc'];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  } catch (err) {
    throw new ConfigError(`Cannot read ${path}: ${err.message}`);
  }
}

/**
 * Finds the nearest config walking up from `cwd`: rtlint.config.json,
 * .rtlintrc.json, .rtlintrc, or an "rtlint" key in package.json. Stops at the
 * repository root (a directory containing .git).
 */
export function findConfig(cwd = process.cwd()) {
  let dir = resolve(cwd);
  for (;;) {
    for (const name of CONFIG_FILES) {
      const path = join(dir, name);
      if (existsSync(path)) return { config: readJson(path), path, dir };
    }
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      const json = readJson(pkg);
      if (json.rtlint) return { config: json.rtlint, path: pkg, dir };
    }
    const parent = dirname(dir);
    if (parent === dir || existsSync(join(dir, '.git'))) return { config: {}, path: null, dir: resolve(cwd) };
    dir = parent;
  }
}

export function loadConfig(path) {
  const full = resolve(path);
  const json = readJson(full);
  const config = full.endsWith('package.json') ? json.rtlint ?? {} : json;
  return { config, path: full, dir: dirname(full) };
}
