import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * A lint result cache keyed by file content and settings. A file whose text
 * and effective settings are unchanged since the last run is not linted again.
 */
export class LintCache {
  constructor(path, version) {
    this.path = path;
    this.version = version;
    this.entries = {};
    this.dirty = false;
    if (existsSync(path)) {
      try {
        const data = JSON.parse(readFileSync(path, 'utf8'));
        if (data.version === version) this.entries = data.files ?? {};
      } catch {
        // A broken cache is just an empty cache.
      }
    }
  }

  static key(text, settings) {
    return createHash('sha1').update(JSON.stringify(settings)).update('\0').update(text).digest('hex');
  }

  get(file, key) {
    const hit = this.entries[file];
    return hit && hit.key === key ? hit.result : null;
  }

  set(file, key, result) {
    this.entries[file] = { key, result };
    this.dirty = true;
  }

  save() {
    if (!this.dirty) return;
    writeFileSync(this.path, JSON.stringify({ version: this.version, files: this.entries }));
  }
}
