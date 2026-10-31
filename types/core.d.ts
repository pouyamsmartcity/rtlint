export type Level = 'off' | 'warn' | 'error' | 0 | 1 | 2;
export type RuleEntry = Level | [Level] | [Level, Record<string, unknown>];

export interface Config {
  $schema?: string;
  /** Persian text detection: "auto" (default) looks at letters and locale paths. */
  persian?: 'auto' | boolean;
  /** Check utility classes (Tailwind, UnoCSS, Bootstrap). Default true. */
  classes?: boolean;
  /** Tailwind prefix, e.g. "tw-". */
  classPrefix?: string;
  /** Rule ids, category wildcards ("fa/*") or "*". */
  rules?: Record<string, RuleEntry>;
  /** Globs to skip (CLI only). */
  ignore?: string[];
  overrides?: Array<{
    files: string | string[];
    excludedFiles?: string | string[];
    persian?: 'auto' | boolean;
    classes?: boolean;
    classPrefix?: string;
    rules?: Record<string, RuleEntry>;
  }>;
}

export interface Fix {
  /** [start, end) offsets in the linted text. */
  range: [number, number];
  text: string;
}

export interface Message {
  ruleId: string;
  /** 1 = warning, 2 = error. */
  severity: 1 | 2;
  message: string;
  /** 1-based, UTF-16 code units. */
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  fix?: Fix;
  /** Set when a rule crashed; the message explains it. */
  fatal?: true;
}

export interface LintResult {
  filePath: string;
  messages: Message[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
}

export interface FixResult extends LintResult {
  /** The text after all safe fixes. */
  output: string;
  fixed: boolean;
}

export interface Settings {
  persian: 'auto' | boolean;
  classes: boolean;
  classPrefix: string;
  rules: Record<string, { level: 'off' | 'warn' | 'error'; options: Record<string, unknown> }>;
}

export interface LintOptions {
  /** Decides the file type by extension and is matched against overrides. Default "input.txt". */
  filePath?: string;
  config?: Config;
  /** Pre-resolved settings (from resolveSettings); takes precedence over config. */
  settings?: Settings;
}

export interface FixOptions extends LintOptions {
  /** Return false to skip a fix. */
  filter?: (message: Message) => boolean;
}

export interface RuleInfo {
  id: string;
  description: string;
  fixable: boolean;
  level: 'off' | 'warn' | 'error';
}

export class ConfigError extends Error {}

export function lintText(text: string, options?: LintOptions): LintResult;
export function fixText(text: string, options?: FixOptions): FixResult;
export function applyFixes(text: string, messages: Message[]): string;
export function resolveSettings(config?: Config, filePath?: string): Settings;
/** Applies rule levels on top of resolved settings; they win over the config and its overrides. */
export function applyRuleOverrides(settings: Settings, rules: Record<string, RuleEntry>): Settings;
export function listRules(): RuleInfo[];
export function getRule(id: string): unknown;
export function isRtlLanguage(tag: string): boolean;
/** Logical replacement for a physical utility class ("ml-4" → "ms-4"), or null. */
export function logicalClass(token: string, prefix?: string): string | null;
export const SUPPORTED_EXTENSIONS: string[];
