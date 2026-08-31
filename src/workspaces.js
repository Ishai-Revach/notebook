import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

// One file, one list. A workspace is a path, a label and a slug; everything
// else about it lives in the workspace itself, where its own agent can read it.
const DIR = join(homedir(), '.scrapbook');
export const FILE = join(DIR, 'workspaces.json');

/* Every workspace is served from one port and told apart by the name in front
   of it, so adding a scrapbook no longer costs a port and an address says
   which scrapbook it is instead of which number it landed on. */
export const PORT = 4321;

/** A slug is a hostname label, so it gets hostname rules and nothing else. */
export function slugify(name) {
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'scrapbook';
}

function uniqueSlug(wanted, workspaces, forPath) {
  const taken = new Set(workspaces.filter((w) => w.path !== forPath).map((w) => w.slug));
  let slug = slugify(wanted);
  for (let n = 2; taken.has(slug); n++) slug = `${slugify(wanted)}-${n}`;
  return slug;
}

export async function list() {
  let workspaces;
  try {
    const parsed = JSON.parse(await readFile(FILE, 'utf8'));
    workspaces = Array.isArray(parsed.workspaces) ? parsed.workspaces : [];
  } catch {
    return [];
  }
  // Registries written before names existed carry a port and no slug. Fill it
  // in on read so nobody has to run a migration.
  const filled = [];
  for (const w of workspaces) {
    filled.push({ ...w, slug: w.slug || uniqueSlug(w.label || basename(w.path), filled, w.path) });
  }
  return filled;
}

/** The one served at a bare localhost, so an address with no name still works. */
export async function defaultWorkspace() {
  const all = await list();
  return all[0] ?? null;
}

export async function byHost(host) {
  const all = await list();
  if (!host) return null;
  const name = String(host).split(':')[0].toLowerCase();
  if (name === 'localhost' || name === '127.0.0.1' || name === '::1' || name === '[::1]') {
    return all[0] ?? null;
  }
  const label = name.split('.')[0];
  return all.find((w) => w.slug === label) ?? null;
}

export function addressOf(workspace, port = PORT) {
  return `http://${workspace.slug}.localhost:${port}/`;
}

async function save(workspaces) {
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify({ workspaces }, null, 2) + '\n');
}

export async function register(root, label) {
  const path = resolve(root);
  const workspaces = await list();
  const existing = workspaces.find((w) => w.path === path);
  if (existing) {
    if (label && existing.label !== label) existing.label = label;
  } else {
    const name = label || basename(path);
    workspaces.push({ path, label: name, slug: uniqueSlug(name, workspaces, path) });
  }
  await save(workspaces);
  return workspaces.find((w) => w.path === path);
}

export async function rename(root, label) {
  const path = resolve(root);
  const workspaces = await list();
  const target = workspaces.find((w) => w.path === path);
  if (!target) return null;
  target.label = label;
  target.slug = uniqueSlug(label, workspaces, path);
  await save(workspaces);
  return target;
}

export async function forget(root) {
  const path = resolve(root);
  const workspaces = (await list()).filter((w) => w.path !== path);
  await save(workspaces);
  return workspaces;
}
