// Builds the GitHub Pages site into _site: the Persian playground, an English copy of it at /en/
// (its own URL, so search engines index the English page too), robots.txt and sitemap.xml.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const site = 'https://pouyamsmartcity.github.io/rtlint';
const out = '_site';

mkdirSync(`${out}/playground`, { recursive: true });
mkdirSync(`${out}/en`, { recursive: true });
cpSync('src', `${out}/src`, { recursive: true });
cpSync('docs/og.png', `${out}/og.png`);
cpSync('llms.txt', `${out}/llms.txt`);

const fa = readFileSync('playground/index.html', 'utf8');
writeFileSync(`${out}/playground/index.html`, fa);

const title = 'rtlint: RTL linter and Persian typography checker, online';
const description = 'Paste your code and see right-to-left (RTL) layout bugs and Persian/Arabic typography mistakes, then fix them automatically. CSS, Tailwind, Bootstrap, React, React Native, Vue, Svelte, HTML. Free, open source, runs in your browser.';

function swap(html, from, to) {
  if (!html.includes(from)) throw new Error(`build-pages: not found: ${from.slice(0, 60)}`);
  return html.replace(from, to);
}

function attr(html, pattern, value) {
  const next = html.replace(pattern, (_, head) => `${head}${value}"`);
  if (next === html) throw new Error(`build-pages: no match for ${pattern}`);
  return next;
}

let en = fa;
en = swap(en, '<html lang="fa" dir="rtl">', '<html lang="en" dir="ltr">');
en = en.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
en = attr(en, /(<meta name="description" content=")[^"]*"/, description);
en = attr(en, /(<link rel="canonical" href=")[^"]*"/, `${site}/en/`);
en = attr(en, /(<meta property="og:url" content=")[^"]*"/, `${site}/en/`);
en = attr(en, /(<meta property="og:title" content=")[^"]*"/, 'rtlint: find and fix RTL bugs and Persian typography (online playground)');
en = attr(en, /(<meta property="og:description" content=")[^"]*"/, description);
en = attr(en, /(<meta property="og:locale" content=")[^"]*"/, 'en_US');
en = attr(en, /(<meta property="og:locale:alternate" content=")[^"]*"/, 'fa_IR');
writeFileSync(`${out}/en/index.html`, en);

writeFileSync(`${out}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>rtlint by Pouyam</title><link rel="canonical" href="${site}/en/"><meta http-equiv="refresh" content="0; url=en/"><a href="en/">rtlint playground</a> · <a href="playground/">نسخه‌ی فارسی</a></html>\n`);
writeFileSync(`${out}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);

const alt = `<xhtml:link rel="alternate" hreflang="fa" href="${site}/playground/"/><xhtml:link rel="alternate" hreflang="en" href="${site}/en/"/>`;
writeFileSync(`${out}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<url><loc>${site}/en/</loc>${alt}<changefreq>weekly</changefreq></url>
<url><loc>${site}/playground/</loc>${alt}<changefreq>weekly</changefreq></url>
</urlset>
`);
console.log('pages built:', out);
