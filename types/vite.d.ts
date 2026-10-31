import type { Plugin } from 'vite';

export interface RtlintViteOptions {
  /** Language of the messages: "en" (default) or "fa" (Persian). */
  lang?: 'en' | 'fa';
  /** Fail `vite build` when rtlint reports an error. */
  failOnError?: boolean;
  /** Only check modules whose path matches. */
  include?: RegExp;
  /** Skip modules whose id matches (default: node_modules, .vite, virtual modules). */
  exclude?: RegExp;
}

export default function rtlint(options?: RtlintViteOptions): Plugin;
