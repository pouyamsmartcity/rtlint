import type { Config, LintResult } from './core.js';

export * from './core.js';

export function findConfig(cwd?: string): { config: Config; path: string | null; dir: string };
export function loadConfig(path: string): { config: Config; path: string; dir: string };
export function collectFiles(
  inputs: string[],
  options?: { cwd?: string; ignore?: string[]; gitignore?: boolean },
): string[];
export const DEFAULT_IGNORE: string[];

type Formatter = (
  results: LintResult[],
  options?: { cwd?: string; color?: boolean; version?: string },
) => string;
export const formatters: Record<'stylish' | 'compact' | 'json' | 'github' | 'sarif', Formatter>;

/** Runs the CLI with arguments; resolves to the exit code. */
export function run(
  argv: string[],
  io?: { stdout?: NodeJS.WritableStream; stderr?: NodeJS.WritableStream; stdin?: NodeJS.ReadableStream; cwd?: string },
): Promise<number>;
