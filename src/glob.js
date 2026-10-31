function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts a gitignore-style glob to a RegExp over POSIX relative paths.
 * Supports **, *, ?, {a,b} and [abc]. A pattern without a slash matches at any
 * depth; a leading slash anchors it; a trailing slash means "this directory".
 */
export function globToRegExp(glob) {
  let g = glob.replace(/\\/g, '/').trim();
  if (g.startsWith('./')) g = g.slice(2);
  const anchored = g.startsWith('/');
  if (anchored) g = g.slice(1);
  const directory = g.endsWith('/');
  if (directory) g = g.slice(0, -1);
  if (!anchored && !g.includes('/')) g = '**/' + g;
  if (directory) g += '/**';
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        const atStart = i === 0 || g[i - 1] === '/';
        const next = g[i + 2];
        if (atStart && next === '/') { re += '(?:.*/)?'; i += 2; continue; }
        re += '.*';
        i++;
        continue;
      }
      re += '[^/]*';
      continue;
    }
    if (c === '?') { re += '[^/]'; continue; }
    if (c === '{') {
      const end = g.indexOf('}', i);
      if (end > i) {
        re += '(?:' + g.slice(i + 1, end).split(',').map(escapeRe).join('|') + ')';
        i = end;
        continue;
      }
    }
    if (c === '[') {
      const end = g.indexOf(']', i);
      if (end > i) {
        re += g.slice(i, end + 1).replace('[!', '[^');
        i = end;
        continue;
      }
    }
    re += escapeRe(c);
  }
  return new RegExp('^' + re + '$');
}

const cache = new Map();

export function matchGlob(path, glob) {
  let re = cache.get(glob);
  if (!re) {
    re = globToRegExp(glob);
    cache.set(glob, re);
  }
  return re.test(path.replace(/\\/g, '/').replace(/^\.\//, ''));
}

export function matchAny(path, globs = []) {
  return [].concat(globs).some((g) => matchGlob(path, g));
}
