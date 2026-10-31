import { relative, sep } from 'node:path';
import { findConfig } from './config.js';
import { fixText, lintText, resolveSettings } from './engine.js';
import { collectFiles, readSource, writeSource } from './files.js';

/**
 * Lints (and with `fix`, fixes) files on disk the way the CLI does: config
 * discovery, .gitignore, default ignores and encodings included.
 *
 *   const results = await lintFiles(['src'], { lang: 'fa' });
 */
export async function lintFiles(patterns = ['.'], { cwd = process.cwd(), fix = false, config, lang, ignore = [] } = {}) {
  const found = config ? { config, dir: cwd } : findConfig(cwd);
  const merged = { ...found.config, ...(lang ? { lang } : {}) };
  const files = collectFiles(patterns, {
    cwd,
    ignore: [...ignore, ...(merged.ignore ? [{ patterns: merged.ignore, base: found.dir }] : [])],
  });
  const results = [];
  for (const abs of files) {
    const source = readSource(abs);
    if (!source) continue;
    const rel = relative(found.dir, abs).split(sep).join('/');
    const options = { filePath: rel, settings: resolveSettings(merged, rel) };
    if (fix) {
      const r = fixText(source.text, options);
      if (r.fixed) writeSource(abs, r.output, source);
      results.push({ ...r, output: undefined, filePath: abs });
    } else {
      results.push({ ...lintText(source.text, options), filePath: abs });
    }
  }
  return results;
}
