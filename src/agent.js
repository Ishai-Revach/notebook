import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { KIT_DIR } from './kit.js';

const BEGIN = '<!-- scrapbook:begin (managed by scrapbook-hub, safe to move, do not hand-edit) -->';
const END = '<!-- scrapbook:end -->';

// Every vendor has its own file and none of them agree. Append to whichever
// already exist, and fall back to AGENTS.md, which is the emerging convention.
const AGENT_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.cursor/rules/scrapbook.mdc',
  '.github/copilot-instructions.md',
];

const POINTER = `${BEGIN}
## Scrapbook

This project has a Scrapbook workspace here: pages are html files in this
folder, and the menu is built from them.
Run \`sbk agent-brief\` for the current contract before creating or editing
anything in it.
${END}`;

const exists = (f) => stat(f).then(() => true).catch(() => false);

/**
 * The contract, printed rather than written down somewhere that can rot.
 * This is the discovery primitive: a pointer in a project can go stale, but
 * it only ever has to say "run this", and this always describes what is true
 * of the version installed.
 */
export function agentBrief(root, { port } = {}) {
  const url = port ? `http://localhost:${port}/` : 'http://localhost:4321/';
  return `# Scrapbook, agent contract

Workspace: ${root}
Served at: ${url}

## What a page is

One html file in the workspace. There is no database, no block model and no
build step. Writing a file is the whole of adding a page.

A page tells the menu about itself with ordinary meta tags. All optional:

    <meta name="scrapbook:label" content="Tasks">     menu label, defaults to <title>
    <meta name="scrapbook:group" content="Research">  the folder it sits in
    <meta name="scrapbook:order" content="2">         position, lower is higher
    <meta name="scrapbook:hidden" content="true">     keep it out of the menu

A page with no tags still appears, under its <title>.

## Making and changing pages

    POST ${url}_new           {"title": "...", "group": "..."}  -> {"href": "..."}
    PUT  ${url}<page>.html    the whole document, as html
    GET  ${url}_nav.json      what the menu currently shows

Writing the file directly works just as well. The menu is read on request, so
a page is in it the moment it exists.

Start from ${KIT_DIR}/ by copying the head of an existing page: the two
stylesheets, the scroll rule, and the two scripts at the end of the body.
A page missing those still renders; it just has no menu and no edit button.

## Tool state

    ${root}/state/<tool>.json

Read and write it as a file. The board or tool that owns it reads the same
file, so a task written here shows up on the page. Over http, PUT to
${url}state/<tool>.json, json only.

## The kit

    ${root}/${KIT_DIR}/

The design system, the shell and the authoring layer, vendored as ordinary
source. It is meant to be edited. \`sbk update\` merges new versions around
whatever you changed, \`sbk diff <file>\` shows your changes, and
\`sbk restore <file>\` throws them away.

Do not edit ${KIT_DIR}/.pristine/. It is the copy of what shipped, and it is
what makes the merge possible.

## House style

Read SCRAPBOOK.md in the workspace before authoring. It carries what this
engine cannot know: what the project is, where its knowledge lives, the tone,
and who may see these documents. It is a default, not a rule to argue with.

## Commands

    sbk serve [dir]           serve it now, in this terminal
    sbk start [dir]           serve it always, and after a restart
    sbk status                what is being served, and where
    sbk init [dir]            set a folder up as a workspace
    sbk update [dir]          bring the kit up to date, keeping your edits
    sbk share <page> [dir]    write one file you can send anyone
    sbk agent-brief [dir]     this text
`;
}

/** Seed the workspace's own brief. Obviously empty beats plausibly wrong. */
export async function seedBrief(root) {
  const file = join(root, 'SCRAPBOOK.md');
  if (await exists(file)) return false;
  const name = basename(root);
  await writeFile(file, `# ${name}

> Seeded by \`sbk init\`. Every line below is a placeholder. An agent reads this
> before it writes anything here, so it is worth ten minutes.

## What this project is

TODO, one paragraph.

## Where the knowledge lives

TODO. Which folders are authoritative, and which are drafts.

## House style

TODO. Tone, how a page here is usually laid out, what to name things.

## Who may see these documents

TODO. This is the line that keeps work from being shared casually.

## Never touch

TODO.
`);
  return true;
}

/** Leave a pointer in whatever agent files the project already keeps. */
export async function writePointers(root) {
  const touched = [];
  let found = false;
  for (const rel of AGENT_FILES) {
    const file = join(root, rel);
    if (!(await exists(file))) continue;
    found = true;
    const text = await readFile(file, 'utf8');
    if (text.includes(BEGIN)) {
      // Replace in place, so an update never leaves two of these behind.
      const start = text.indexOf(BEGIN);
      const stop = text.indexOf(END) + END.length;
      const next = text.slice(0, start) + POINTER + text.slice(stop);
      if (next !== text) {
        await writeFile(file, next);
        touched.push(rel);
      }
      continue;
    }
    await writeFile(file, `${text.trimEnd()}\n\n${POINTER}\n`);
    touched.push(rel);
  }
  if (!found) {
    const file = join(root, 'AGENTS.md');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `# Agents\n\n${POINTER}\n`);
    touched.push('AGENTS.md');
  }
  return touched;
}
