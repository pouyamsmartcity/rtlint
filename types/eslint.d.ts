import type { ESLint, Linter } from 'eslint';

declare const plugin: ESLint.Plugin & {
  configs: { recommended: Linter.Config; all: Linter.Config };
};
export default plugin;
export function eslintName(id: string): string;
