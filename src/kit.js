import { readdir, mkdir, copyFile, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const KIT_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'kit');

export const KIT_DIR = 'scrapbook';
const PRISTINE = '.pristine';
const VERSION_FILE = '.kit-version';

/**
 * A copy of exactly what was shipped, kept beside the editable copy.
 * Hashes would be enough to notice a local edit, but not to merge around one:
 * a three-way merge needs the original text. It is a few kilobytes.
 */
const pristinePath = (root, rel) => join(root, KIT_DIR, PRISTINE, rel);
const livePath = (root, rel) => join(root, KIT_DIR, rel);

async function* walk(dir, base = dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, base);
    else yield relative(base, full).split(sep).join('/');
  }
}

export async function kitFiles() {
  const out = [];
  for await (const f of walk(KIT_SRC)) out.push(f);
  return out.sort();
}

const read = (f) => readFile(f, 'utf8').catch(() => null);

async function place(from, to) {
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
}

export async function kitVersion() {
  const pkg = JSON.parse(await readFile(join(KIT_SRC, '..', 'package.json'), 'utf8'));
  return pkg.version;
}

/**
 * The markup every page starts from. Kept here rather than in the kit because
 * it is a seed, not a shipped file: once a page exists it is yours, and no
 * update should ever reach back into it.
 */
export function pageTemplate(title, group) {
  const escape = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const groupTag = group ? `\n<meta name="scrapbook:group" content="${escape(group)}">` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>${groupTag}
<link rel="stylesheet" href="/${KIT_DIR}/design-system/tokens.css">
<link rel="stylesheet" href="/${KIT_DIR}/design-system/components.css">
<link rel="stylesheet" href="/${KIT_DIR}/design-system/edit.css">
<style>
  /* A page must be able to scroll before anything else is true of it. */
  html, body { height: auto; min-height: 100%; overflow-x: hidden; overflow-y: auto; }
</style>
</head>
<body>
<article class="article">
  <h1>${escape(title)}</h1>
  <p class="lede">Write here, or ask your agent to.</p>
</article>
<script src="/${KIT_DIR}/shell.js"></script>
<script src="/${KIT_DIR}/edit.js"></script>
</body>
</html>
`;
}

/** Vendor the kit into a workspace. Never overwrites a file that is already there. */
export async function init(root) {
  const files = await kitFiles();
  const added = [];
  const kept = [];
  for (const rel of files) {
    const target = livePath(root, rel);
    const exists = await stat(target).then(() => true).catch(() => false);
    if (exists) kept.push(rel);
    else {
      await place(join(KIT_SRC, rel), target);
      added.push(rel);
    }
    await place(join(KIT_SRC, rel), pristinePath(root, rel));
  }
  await writeFile(join(root, KIT_DIR, VERSION_FILE), await kitVersion());

  // A workspace with nothing to look at is hard to tell from a broken one.
  let seeded = null;
  const hasPage = (await readdir(root)).some((f) => f.toLowerCase().endsWith('.html'));
  if (!hasPage) {
    seeded = 'index.html';
    await writeFile(join(root, seeded), pageTemplate('Welcome'));
  }
  return { added, kept, seeded };
}

export async function installedVersion(root) {
  return read(join(root, KIT_DIR, VERSION_FILE));
}

/**
 * Three-way merge the kit into a workspace, per file.
 * Four outcomes, and only the last one needs a human: the file was never
 * there, only we changed it, only you changed it, or both did.
 */
export async function update(root, { dryRun = false } = {}) {
  const results = [];
  for (const rel of await kitFiles()) {
    const [live, base, next] = await Promise.all([
      read(livePath(root, rel)),
      read(pristinePath(root, rel)),
      read(join(KIT_SRC, rel)),
    ]);

    let action;
    if (live === null) action = 'added';
    else if (live === base) action = base === next ? 'unchanged' : 'updated';
    else if (base === next) action = 'kept your version';
    else if (live === next) action = 'unchanged';
    else action = 'merged';

    if (!dryRun) {
      if (action === 'added' || action === 'updated') await place(join(KIT_SRC, rel), livePath(root, rel));
      if (action === 'merged') {
        // git ships a three-way merge and every machine running this has it.
        // Writing another one would be a worse version of a solved problem.
        const ours = livePath(root, rel);
        const basef = `${ours}.base`;
        const theirs = `${ours}.new`;
        await writeFile(basef, base ?? '');
        await writeFile(theirs, next ?? '');
        const res = await run('git', ['merge-file', '-L', 'yours', '-L', 'shipped', '-L', 'new', ours, basef, theirs])
          .then(() => ({ code: 0 }))
          .catch((e) => ({ code: e.code ?? 1 }));
        await rm(basef, { force: true });
        await rm(theirs, { force: true });
        if (res.code > 0) action = 'merged with conflicts';
      }
      if (action !== 'kept your version' && action !== 'merged with conflicts') {
        await place(join(KIT_SRC, rel), pristinePath(root, rel));
      }
    }
    if (action !== 'unchanged') results.push({ file: rel, action });
  }
  if (!dryRun) await writeFile(join(root, KIT_DIR, VERSION_FILE), await kitVersion());
  return results;
}

/** What you changed in one kit file, against what was shipped. */
export async function diff(root, rel) {
  const ours = livePath(root, rel);
  const base = pristinePath(root, rel);
  return run('git', ['diff', '--no-index', '--', base, ours])
    .then((r) => r.stdout)
    .catch((e) => e.stdout ?? '');
}

/** Throw away local changes to one kit file. */
export async function restore(root, rel) {
  const base = pristinePath(root, rel);
  if (!(await stat(base).then(() => true).catch(() => false))) return false;
  await place(base, livePath(root, rel));
  return true;
}
