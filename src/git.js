import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigError } from './engine.js';

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const detail = String(err.stderr || err.message).trim().split('\n')[0];
    throw new ConfigError(`git ${args[0]} failed: ${detail}`);
  }
}

const lines = (out) => out.split('\n').map((l) => l.trim()).filter(Boolean);

/** Absolute paths of files that still exist, from paths relative to the repository root. */
function existing(root, paths) {
  return [...new Set(paths)].map((p) => resolve(root, p)).filter((p) => existsSync(p));
}

/**
 * Files changed since `ref` (default HEAD): modified, added and renamed files
 * plus untracked ones, so a pull request or a work-in-progress can be linted
 * without the rest of the codebase.
 */
export function changedFiles(cwd, ref = 'HEAD') {
  const root = git(['rev-parse', '--show-toplevel'], cwd).trim();
  const changed = lines(git(['diff', '--name-only', '--diff-filter=ACMR', ref, '--'], root));
  const untracked = lines(git(['ls-files', '--others', '--exclude-standard'], root));
  return existing(root, [...changed, ...untracked]);
}

/** Files staged for the next commit (for pre-commit hooks). */
export function stagedFiles(cwd) {
  const root = git(['rev-parse', '--show-toplevel'], cwd).trim();
  return existing(root, lines(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], root)));
}
