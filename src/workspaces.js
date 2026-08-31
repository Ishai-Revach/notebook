import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

// One file, one list. A workspace is a path and a label; everything else about
// it lives in the workspace itself, where its own agent can read it.
const DIR = join(homedir(), '.scrapbook');
export const FILE = join(DIR, 'workspaces.json');

export async function list() {
  try {
    const parsed = JSON.parse(await readFile(FILE, 'utf8'));
    return Array.isArray(parsed.workspaces) ? parsed.workspaces : [];
  } catch {
    return [];
  }
}

export const FIRST_PORT = 4321;

/* A workspace keeps its port for good, so a bookmark and a browser tab stay
   valid. Adding or removing another workspace never renumbers the rest. */
function freePort(workspaces) {
  const taken = new Set(workspaces.map((w) => w.port));
  let port = FIRST_PORT;
  while (taken.has(port)) port++;
  return port;
}

export async function register(root, label) {
  const path = resolve(root);
  const workspaces = await list();
  const existing = workspaces.find((w) => w.path === path);
  if (existing) {
    if (label && existing.label !== label) existing.label = label;
    if (!existing.port) existing.port = freePort(workspaces);
  } else {
    workspaces.push({ path, label: label || basename(path), port: freePort(workspaces) });
  }
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify({ workspaces }, null, 2) + '\n');
  return workspaces.find((w) => w.path === path);
}

export async function forget(root) {
  const path = resolve(root);
  const workspaces = (await list()).filter((w) => w.path !== path);
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify({ workspaces }, null, 2) + '\n');
  return workspaces;
}
