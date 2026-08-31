import { readFile } from 'node:fs/promises';
import { dirname, join, resolve, extname, sep } from 'node:path';

const TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
};

const MAX_INLINE = 4 * 1024 * 1024;

/** Only pull in files from inside the workspace, and only local ones. */
function localTarget(root, pageDir, url) {
  if (!url || /^(https?:|data:|mailto:|#|\/\/)/i.test(url)) return null;
  const clean = url.split(/[?#]/)[0];
  const file = clean.startsWith('/') ? join(root, clean.slice(1)) : resolve(pageDir, clean);
  const full = resolve(file);
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

/**
 * Turn one page into a single file anyone can open, with nothing left to fetch.
 * The kit's own scripts are dropped rather than inlined: a page someone else
 * opens has no workspace behind it, so an Edit button that cannot save is
 * worse than no Edit button.
 */
export async function share(root, page) {
  root = resolve(root);
  const file = resolve(root, page);
  if (file !== root && !file.startsWith(root + sep)) throw new Error(`${page} is outside the workspace`);
  let html = await readFile(file, 'utf8');
  const pageDir = dirname(file);
  const skipped = [];

  const inline = async (target) => {
    const bytes = await readFile(target).catch(() => null);
    if (bytes === null) return null;
    if (bytes.length > MAX_INLINE) {
      skipped.push(target);
      return null;
    }
    return bytes;
  };

  // Stylesheets become style blocks.
  html = await replaceAsync(html, /<link\b[^>]*>/gi, async (tag) => {
    if (!/rel=["']?stylesheet/i.test(tag)) return tag;
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    const target = localTarget(root, pageDir, href);
    if (!target) return tag;
    const bytes = await inline(target);
    return bytes === null ? tag : `<style>\n${bytes.toString('utf8')}\n</style>`;
  });

  // Scripts from the kit go; anything the page brought itself is inlined.
  html = await replaceAsync(html, /<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, async (tag, src) => {
    const target = localTarget(root, pageDir, src);
    if (!target) return tag;
    if (/(^|\/)scrapbook\//.test(src.replace(/^\//, ''))) return '';
    const bytes = await inline(target);
    return bytes === null ? tag : `<script>\n${bytes.toString('utf8')}\n</script>`;
  });

  // Images and anything else referenced by src become data URIs.
  html = await replaceAsync(html, /\bsrc=["']([^"']+)["']/gi, async (whole, url) => {
    const target = localTarget(root, pageDir, url);
    if (!target) return whole;
    const type = TYPES[extname(target).toLowerCase()];
    if (!type) return whole;
    const bytes = await inline(target);
    return bytes === null ? whole : `src="data:${type};base64,${bytes.toString('base64')}"`;
  });

  /* The sidebar is gone, so the gap the page leaves for it should be too.
     Appended rather than edited into the design system, because the shared
     copy is a different thing from the page in the workspace. */
  html = html.replace(
    /<\/head>/i,
    '<style>\n  /* shared copy: no sidebar, so no room kept for one */\n' +
    '  body { padding-left: var(--space-wide, 32px); padding-right: var(--space-wide, 32px); }\n' +
    '  .sb-side, .sb-scrim, .sb-side-toggle { display: none; }\n</style>\n</head>',
  );

  return { html, skipped };
}

async function replaceAsync(input, re, fn) {
  const jobs = [];
  input.replace(re, (...args) => {
    jobs.push(fn(...args));
    return '';
  });
  const done = await Promise.all(jobs);
  let i = 0;
  return input.replace(re, () => done[i++]);
}
