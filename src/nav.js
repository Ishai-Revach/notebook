import { readdir, open } from 'node:fs/promises';
import { basename, join, extname, relative, sep } from 'node:path';

// A page declares itself with ordinary <meta> tags, so nothing has to be
// registered anywhere and there is no build step. A page with no tags at all
// still appears, under its <title>.
//
//   <meta name="scrapbook:label" content="Tasks">
//   <meta name="scrapbook:group" content="Research">
//   <meta name="scrapbook:order" content="2">
//   <meta name="scrapbook:hidden" content="true">
const HEAD_BYTES = 8192;

function meta(head, name) {
  const re = new RegExp(
    `<meta[^>]*name=["']scrapbook:${name}["'][^>]*content=["']([^"']*)["']|` +
    `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']scrapbook:${name}["']`,
    'i',
  );
  const m = re.exec(head);
  return m ? (m[1] ?? m[2]).trim() : null;
}

async function readHead(file) {
  const fh = await open(file, 'r');
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await fh.read(buf, 0, HEAD_BYTES, 0);
    return buf.subarray(0, bytesRead).toString('utf8');
  } finally {
    await fh.close();
  }
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'");
}

async function* htmlFiles(dir, root) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'scrapbook' || e.name === 'state') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(full, root);
    else if (extname(e.name).toLowerCase() === '.html') yield full;
  }
}

/**
 * Read the workspace and return what the menu should show.
 * Scanned on request rather than built, so a page that was just written is in
 * the menu the moment it exists. No build step, which is the whole rule.
 */
export async function buildNav(root) {
  const pages = [];
  for await (const file of htmlFiles(root, root)) {
    const head = await readHead(file);
    if (meta(head, 'hidden') === 'true') continue;
    const href = relative(root, file).split(sep).join('/');
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]?.trim();
    // Number(null) is 0, not NaN, so an absent order would sort ahead of a
    // stated one. Check for the tag before converting.
    const rawOrder = meta(head, 'order');
    const order = rawOrder === null ? null : Number(rawOrder);
    pages.push({
      href,
      label: decode(meta(head, 'label') ?? title ?? href.replace(/\.html$/, '')),
      group: meta(head, 'group'),
      order: Number.isFinite(order) ? order : null,
    });
  }

  // Ordered pages first in their stated order, then everything else
  // alphabetically, so a workspace nobody has curated still reads sensibly.
  const sort = (a, b) =>
    (a.order ?? Infinity) - (b.order ?? Infinity) || a.label.localeCompare(b.label);

  const groups = new Map();
  for (const p of pages.sort(sort)) {
    const key = p.group ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ href: p.href, label: p.label });
  }
  // Ungrouped pages sit at the top, the way a menu with no sections would.
  const ungrouped = groups.get('') ?? [];
  groups.delete('');
  return {
    // The folder's own name, so the sidebar can say which workspace this is
    // without anyone having to configure a title.
    workspace: basename(root),
    pages: ungrouped,
    groups: [...groups].map(([label, items]) => ({ label, items })),
  };
}
