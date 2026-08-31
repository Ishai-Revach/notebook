#!/usr/bin/env node
import { resolve, dirname, join } from 'node:path';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createScrapbookServer } from '../src/serve.js';
import { start, stop, status, LOG } from '../src/service.js';
import * as kit from '../src/kit.js';
import { share } from '../src/share.js';
import { agentBrief, seedBrief, writePointers } from '../src/agent.js';
import * as workspaces from '../src/workspaces.js';
import { writeFile } from 'node:fs/promises';

const HERE = dirname(fileURLToPath(import.meta.url));

// Piping into head closes stdout early. That is not a failure worth a stack
// trace, it is someone reading the first few lines.
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});
const DEFAULT_PORT = 4321;

const USAGE = `usage:
  sbk serve [dir] [--port N]    serve a folder now, in this terminal
  sbk start [dir] [--port N]    serve it always, and after a restart
  sbk stop                      stop serving
  sbk status                    what is being served, and where

  sbk init [dir]                set a folder up as a workspace
  sbk add [dir]                 serve a folder as it is, without the kit
  sbk update [dir]              bring the kit up to date, keeping your edits
  sbk update --check [dir]      is there anything to update
  sbk diff <file> [dir]         what you changed in a kit file
  sbk restore <file> [dir]      throw away your changes to a kit file

  sbk share <page> [dir]        write one file you can send anyone
  sbk install <url> [dir]       add a page someone else wrote

  sbk agent-brief [dir]         the contract, for an agent to read
  sbk workspaces                every workspace you have set up
  sbk forget [dir]              stop serving a folder, changing nothing in it`;

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function parse(rest) {
  let dir = '.';
  let port = DEFAULT_PORT;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--port') port = Number(rest[++i]);
    else if (rest[i].startsWith('-')) die(USAGE);
    else dir = rest[i];
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) die(`sbk: not a port: ${port}`);
  const root = resolve(dir);
  try {
    if (!statSync(root).isDirectory()) throw new Error();
  } catch {
    die(`sbk: not a folder: ${root}`);
  }
  return { root, port };
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'serve') {
  const { root, port } = parse(rest);
  const server = createScrapbookServer(root);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') die(`sbk: port ${port} is busy. Try --port ${port + 1}`);
    die(`sbk: ${err.message}`);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Scrapbook serving ${root}`);
    console.log(`  http://localhost:${port}/`);
  });
} else if (cmd === 'serve-all') {
  const all = await workspaces.list();
  if (!all.length) die('sbk: no workspaces registered. Run: sbk init <folder>');
  const p = rest.indexOf('--port');
  const port = p === -1 ? workspaces.PORT : Number(rest[p + 1]);
  // One server, every workspace. The name in front of the address picks which.
  const server = createScrapbookServer((req) => workspaces.byHost(req.headers.host).then((w) => w && w.path), { port });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') die(`sbk: port ${port} is busy`);
    die(`sbk: ${err.message}`);
  });
  server.listen(port, '127.0.0.1', () => {
    for (const w of all) console.log(`${w.label.padEnd(20)} ${workspaces.addressOf(w, port)}`);
  });
} else if (cmd === 'start') {
  const named = rest.some((a) => !a.startsWith('-') && rest[rest.indexOf(a) - 1] !== '--port');
  const { root } = parse(rest);
  if (named) await workspaces.register(root);
  const all = await workspaces.list();
  if (!all.length) die('sbk: no workspaces yet. Run: sbk init <folder>');
  await start({ entry: join(HERE, 'sbk.js') }).catch((e) => die(`sbk: ${e.message}`));

  const url = `http://localhost:${workspaces.PORT}/`;
  let up = false;
  for (let i = 0; i < 20 && !up; i++) {
    up = await fetch(url).then(() => true).catch(() => false);
    if (!up) await new Promise((r) => setTimeout(r, 250));
  }
  if (!up) {
    console.log(`sbk: started, but nothing answered on ${url}`);
    console.log(`  check ${LOG}`);
  } else {
    for (const w of all) console.log(`${w.label.padEnd(20)} ${workspaces.addressOf(w)}`);
    console.log(`\n${all[0].label} also answers at ${url}`);
    console.log(`Switch between them at ${url}_hub`);
  }
} else if (cmd === 'stop') {
  await stop();
  console.log('Scrapbook stopped.');
} else if (cmd === 'status') {
  const s = await status();
  if (!s.installed) {
    console.log('Not set up to run on its own. Use: sbk start <folder>');
  } else if (!s.workspaces.length) {
    console.log('Running, but no workspaces registered. Use: sbk init <folder>');
  } else {
    for (const w of s.workspaces) {
      console.log(`${w.up ? 'up  ' : 'down'}  ${w.label.padEnd(18)} ${workspaces.addressOf(w).padEnd(38)} ${w.path}`);
    }
    if (!s.running) console.log(`\nNothing is answering. Check ${LOG}`);
  }
} else if (cmd === 'init') {
  const { root } = parse(rest);
  const { added, kept, seeded } = await kit.init(root);
  console.log(`Workspace ready at ${root}`);
  if (added.length) console.log(`  added ${added.length} file${added.length === 1 ? '' : 's'} under ${kit.KIT_DIR}/`);
  if (kept.length) console.log(`  left ${kept.length} of your own file${kept.length === 1 ? '' : 's'} alone`);
  if (seeded) console.log(`  wrote ${seeded} so there is something to open`);
  if (await seedBrief(root)) console.log('  wrote SCRAPBOOK.md, the house style your agent reads');
  const pointed = await writePointers(root);
  if (pointed.length) console.log(`  pointed your agent at it in ${pointed.join(', ')}`);
  await workspaces.register(root);
  console.log(`  next: sbk start ${root === process.cwd() ? '.' : root}`);
} else if (cmd === 'add') {
  /* A folder that already has its own design system, its own shell and its
     own pages does not want the kit dropped on top of it. Register it and
     serve it exactly as it is. */
  const { root } = parse(rest);
  const entry = await workspaces.register(root);
  console.log(`Serving ${root} as it is`);
  console.log(`  ${workspaces.addressOf(entry)}`);
  console.log('  nothing was added to it. Use sbk init if you want the kit.');
} else if (cmd === 'update') {
  const check = rest.includes('--check');
  const dry = check || rest.includes('--dry-run');
  const { root } = parse(rest.filter((a) => a !== '--check' && a !== '--dry-run'));
  const have = await kit.installedVersion(root);
  if (have === null) die(`sbk: ${root} is not a workspace yet. Run: sbk init ${root}`);
  const changes = await kit.update(root, { dryRun: dry });
  if (!changes.length) {
    console.log(`Up to date (kit ${have}).`);
  } else {
    console.log(dry ? 'Would change:' : `Updated to kit ${await kit.kitVersion()}:`);
    for (const c of changes) console.log(`  ${c.action.padEnd(22)} ${c.file}`);
    const stuck = changes.filter((c) => c.action === 'merged with conflicts');
    if (stuck.length) {
      console.log(`\n${stuck.length} file${stuck.length === 1 ? '' : 's'} need a decision from you.`);
      console.log('Open them, keep the lines you want, delete the markers, then run update again.');
    }
  }
  if (check) process.exit(changes.length ? 1 : 0);
} else if (cmd === 'diff' || cmd === 'restore') {
  const [file, ...tail] = rest;
  if (!file || file.startsWith('-')) die(USAGE);
  const { root } = parse(tail);
  if (cmd === 'diff') {
    const out = await kit.diff(root, file);
    console.log(out.trim() ? out : `No changes to ${file}.`);
  } else {
    const ok = await kit.restore(root, file);
    console.log(ok ? `Restored ${file} to the shipped version.` : `sbk: no shipped version of ${file}`);
  }
} else if (cmd === 'agent-brief') {
  const { root } = parse(rest);
  const known = (await workspaces.list()).find((w) => w.path === root);
  console.log(agentBrief(root, { address: known ? workspaces.addressOf(known) : null }));
} else if (cmd === 'workspaces') {
  const all = await workspaces.list();
  if (!all.length) console.log('No workspaces yet. Use: sbk init <folder>');
  for (const w of all) console.log(`  ${w.label.padEnd(18)} ${workspaces.addressOf(w).padEnd(38)} ${w.path}`);
} else if (cmd === 'install') {
  const [url, ...tail] = rest;
  if (!url || url.startsWith('-')) die(USAGE);
  const { root } = parse(tail);
  const made = await kit.install(root, url).catch((e) => die(`sbk: ${e.message}`));
  console.log(`Installed ${made.title} as ${made.file}`);
  console.log(`  from ${made.from}`);
  console.log('  it is a page in your workspace now: it can read and write this');
  console.log('  workspace\'s tool state and save over its documents. Open it and');
  console.log('  read it if you do not know who wrote it.');
} else if (cmd === 'forget') {
  const { root } = parse(rest);
  await workspaces.forget(root);
  console.log(`Stopped serving ${root}. Nothing in it was changed.`);
} else if (cmd === 'share') {
  const [page, ...tail] = rest;
  if (!page || page.startsWith('-')) die(USAGE);
  const { root } = parse(tail);
  const { html, skipped } = await share(root, page).catch((e) => die(`sbk: ${e.message}`));
  const out = resolve(root, page.replace(/\.html$/i, '') + '.share.html');
  await writeFile(out, html);
  console.log(`Wrote ${out}`);
  console.log('  one file, nothing left to fetch. Send it to anyone.');
  for (const f of skipped) console.log(`  left out (too big to inline): ${f}`);
} else {
  die(USAGE);
}
