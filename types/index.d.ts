import type { Config, LintResult } from './core.js';

export * from './core.js';

export function findConfig(cwd?: string): { config: Config; path: string | null; dir: string };
export function loadConfig(path: string): { config: Config; path: string; dir: string };
export function collectFiles(
  inputs: string[],
  options?: {
    cwd?: string;
    /** Globs relative to cwd (or ignoreBase), or groups with their own base folder. */
    ignore?: Array<string | { patterns: string[]; base: string }>;
    ignoreBase?: string;
    gitignore?: boolean;
  },
): string[];
export interface Source {
  text: string;
  encoding: 'utf8' | 'utf16le' | 'utf16be';
  bom: boolean;
}
/** Reads UTF-8 or BOM-marked UTF-16; null for binary files. */
export function readSource(path: string): Source | null;
export function writeSource(path: string, text: string, source?: Partial<Source>): void;
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
