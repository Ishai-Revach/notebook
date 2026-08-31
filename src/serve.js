import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readdir, realpath, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join, resolve, extname, sep, posix } from 'node:path';
import { buildNav } from './nav.js';
import { pageTemplate } from './kit.js';
import { list as listWorkspaces } from './workspaces.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

// Tools keep their state in state/*.json so the agent can read and edit it as
// a file. That is the whole point of the folder, so it is the only place the
// server accepts a write, and it only accepts JSON.
const STATE_DIR = 'state';
const MAX_STATE_BYTES = 5 * 1024 * 1024;

function isStatePath(urlPath) {
  return /^\/state\/[a-z0-9][a-z0-9-]*\.json$/.test(urlPath);
}

// A document is writable; the kit and the pristine copy behind it are not.
// Editing the kit is a thing you do in your editor, on purpose, not something
// a page should be able to do to itself by accident.
function isDocumentPath(urlPath) {
  return /\.html$/i.test(urlPath) && !/^\/scrapbook\//.test(urlPath) && !urlPath.includes('..');
}

/** A title becomes a file name. Anything that is not a letter or a digit goes. */
export function slugify(title) {
  const slug = title
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'untitled';
}

async function readBody(req, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'content-type': type });
  res.end(body);
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// No index.html in a workspace is the normal case, not an error: the
// reference notebook has fifteen pages and no front door. Listing beats a 404.
async function listing(dir, urlPath) {
  const entries = await readdir(dir, { withFileTypes: true });
  const rows = entries
    .filter((e) => !e.name.startsWith('.'))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .map((e) => {
      const name = e.name + (e.isDirectory() ? '/' : '');
      const href = posix.join(urlPath, encodeURIComponent(e.name)) + (e.isDirectory() ? '/' : '');
      return `<li><a href="${href}">${escapeHtml(name)}</a></li>`;
    })
    .join('\n');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(urlPath)}</title>
<style>
  html, body { height: auto; min-height: 100%; overflow-x: hidden; overflow-y: auto; }
  body { font: 15px/1.6 ui-sans-serif, system-ui, sans-serif; margin: 3rem auto; max-width: 44rem; padding: 0 1.5rem; }
  h1 { font-size: 1rem; font-weight: 600; color: #666; margin-bottom: 1.5rem; }
  ul { list-style: none; padding: 0; }
  li { padding: 0.35rem 0; border-bottom: 1px solid #eee; }
  a { color: #1a1a1a; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style></head>
<body><h1>${escapeHtml(urlPath)}</h1><ul>
${rows}
</ul></body></html>`;
}

async function hubPage(current) {
  const workspaces = await listWorkspaces();
  const rows = workspaces
    .map((w) => {
      const here = w.path === current;
      return `<li${here ? ' class="here"' : ''}><a href="http://localhost:${w.port}/">` +
        `<strong>${escapeHtml(w.label)}</strong><span>${escapeHtml(w.path)}</span></a>` +
        `${here ? '<em>open</em>' : ''}</li>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Workspaces</title>
<style>
  html, body { height: auto; min-height: 100%; overflow-x: hidden; overflow-y: auto; }
  body { margin: 0; padding: 12vh 24px; background: #fdfcf9; color: #1a1a1a;
         font: 15px/1.6 ui-sans-serif, system-ui, sans-serif; }
  main { max-width: 34rem; margin: 0 auto; }
  h1 { font-size: 1rem; font-weight: 600; color: #6b6b6b; margin: 0 0 1.5rem; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #eee9e1; }
  li a { flex: 1; display: flex; flex-direction: column; gap: 2px;
         padding: 14px 4px; text-decoration: none; color: inherit; }
  li a:hover strong { color: #b5502a; }
  li span { font-size: 12px; color: #8a8a8a; word-break: break-all; }
  li em { font-style: normal; font-size: 11px; letter-spacing: .04em;
          text-transform: uppercase; color: #b5502a; }
  p { color: #8a8a8a; }
</style></head>
<body><main><h1>Workspaces</h1>
${rows ? `<ul>\n${rows}\n</ul>` : '<p>None registered yet. Run <code>sbk init &lt;folder&gt;</code>.</p>'}
</main></body></html>`;
}

function stream(res, file) {
  res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

/**
 * Serve a workspace folder of static documents, unchanged.
 * ponytail: no caching headers, no etags, no compression, no range requests.
 * One person, one machine, localhost. Add them when a real page feels slow.
 */
export function createScrapbookServer(root) {
  const base = resolve(root);
  return createServer(async (req, res) => {
    // Deliberately not new URL(): a request for "//" is scheme-relative there
    // and throws, which is a 400 for a link a browser can legitimately send.
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.url.split(/[?#]/)[0]);
    } catch {
      return send(res, 400, 'Bad request');
    }

    if (req.method === 'PUT') {
      const state = isStatePath(urlPath);
      if (!state && !isDocumentPath(urlPath)) {
        return send(res, 403, `Only ${STATE_DIR}/<name>.json and documents can be written`);
      }
      let body;
      try {
        body = await readBody(req, MAX_STATE_BYTES);
      } catch {
        return send(res, 413, 'Too large');
      }
      if (state) {
        try {
          JSON.parse(body);
        } catch {
          return send(res, 400, 'Not JSON');
        }
      }
      const file = resolve(base, '.' + urlPath);
      if (file !== base && !file.startsWith(base + sep)) return send(res, 403, 'Forbidden');
      await mkdir(dirname(file), { recursive: true });
      // Write and rename, so a crash mid-write cannot leave a half file where
      // a document or a whole task board used to be.
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, body);
      await rename(tmp, file);
      return send(res, 204, '');
    }

    // Creating a page is a POST because the server picks the file name.
    if (req.method === 'POST' && urlPath === '/_new') {
      let wanted;
      try {
        wanted = JSON.parse(await readBody(req, 64 * 1024));
      } catch {
        return send(res, 400, 'Not JSON');
      }
      const title = String(wanted.title ?? '').trim() || 'Untitled';
      let name = slugify(title);
      // Never write over a page that already exists, whatever it is called.
      let href = `${name}.html`;
      for (let n = 2; await stat(join(base, href)).then(() => true).catch(() => false); n++) {
        href = `${name}-${n}.html`;
      }
      await writeFile(join(base, href), pageTemplate(title, wanted.group));
      return send(res, 200, JSON.stringify({ href }), 'application/json; charset=utf-8');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

    /* The switcher is served by the kernel, not by the workspace, so a
       workspace that has been edited into a broken state cannot take away
       the way out of it. This is the one surface a workspace cannot change. */
    if (urlPath === '/_hub') {
      return send(res, 200, await hubPage(base), 'text/html; charset=utf-8');
    }

    // The menu is read from the workspace on request, not built into a file,
    // so a page that was written a second ago is already in it.
    if (urlPath === '/_nav.json') {
      return send(res, 200, JSON.stringify(await buildNav(base)), 'application/json; charset=utf-8');
    }

    // Trust boundary: this serves a folder the user named, and nothing above it.
    // resolve() kills ../ traversal, realpath() kills symlinks pointing out.
    const target = resolve(base, '.' + urlPath);
    if (target !== base && !target.startsWith(base + sep)) return send(res, 403, 'Forbidden');

    let real, info;
    try {
      real = await realpath(target);
      info = await stat(real);
    } catch {
      if (isStatePath(urlPath)) return send(res, 200, '{}', 'application/json; charset=utf-8');
      return send(res, 404, 'Not found');
    }
    const realBase = await realpath(base);
    if (real !== realBase && !real.startsWith(realBase + sep)) return send(res, 403, 'Forbidden');

    if (info.isDirectory()) {
      if (!urlPath.endsWith('/')) {
        res.writeHead(302, { location: urlPath + '/' });
        return res.end();
      }
      const index = join(real, 'index.html');
      try {
        await stat(index);
        return stream(res, index);
      } catch {
        return send(res, 200, await listing(real, urlPath), 'text/html; charset=utf-8');
      }
    }
    if (!info.isFile()) return send(res, 404, 'Not found');
    stream(res, real);
  });
}
