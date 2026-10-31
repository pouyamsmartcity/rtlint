// Vite plugin: reports RTL and Persian typography problems while you develop.
//
//   // vite.config.js
//   import rtlint from 'rtlint/vite';
//   export default { plugins: [rtlint({ lang: 'fa' })] };
//
// Options: { lang: 'en' | 'fa', failOnError: false, include: RegExp, exclude: RegExp }
// With failOnError, `vite build` fails when rtlint reports an error.
import { relative } from 'node:path';
import { findConfig } from './config.js';
import { lintText, resolveSettings } from './engine.js';
import { extOf, SUPPORTED_EXTENSIONS } from './file.js';

const SUPPORTED = new Set(SUPPORTED_EXTENSIONS);

export default function rtlint(options = {}) {
  let root = process.cwd();
  let found = { config: {}, dir: root };
  let isBuild = false;
  const exclude = options.exclude ?? /[\\/]node_modules[\\/]|[\\/]\.vite[\\/]|^\0/;
  const seen = new Map();

  return {
    name: 'rtlint',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
      isBuild = config.command === 'build';
      found = findConfig(root);
    },
    transform(code, id) {
      const file = id.split('?')[0];
      if (exclude.test(id) || (options.include && !options.include.test(file))) return null;
      if (!SUPPORTED.has(extOf(file))) return null;
      // Each module is reported once per content, not on every HMR pass.
      if (seen.get(file) === code) return null;
      seen.set(file, code);
      const rel = relative(found.dir, file).split('\\').join('/');
      const settings = resolveSettings({ ...found.config, ...(options.lang ? { lang: options.lang } : {}) }, rel);
      const result = lintText(code, { filePath: rel, settings });
      for (const m of result.messages) {
        const text = `${rel}:${m.line}:${m.column} ${m.message} (${m.ruleId})`;
        if (m.severity === 2 && options.failOnError && isBuild) this.error(text);
        else this.warn(text);
      }
      return null;
    },
  };
}
