#!/usr/bin/env node
import { resolve, dirname, join } from 'node:path';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createNotebookServer } from '../src/serve.js';
import { start, stop, status, LOG } from '../src/service.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 4321;

const USAGE = `usage:
  nbk serve [dir] [--port N]    serve a folder now, in this terminal
  nbk start [dir] [--port N]    serve it always, and after a restart
  nbk stop                      stop serving
  nbk status                    what is being served, and where`;

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
  if (!Number.isInteger(port) || port < 1 || port > 65535) die(`nbk: not a port: ${port}`);
  const root = resolve(dir);
  try {
    if (!statSync(root).isDirectory()) throw new Error();
  } catch {
    die(`nbk: not a folder: ${root}`);
  }
  return { root, port };
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'serve') {
  const { root, port } = parse(rest);
  const server = createNotebookServer(root);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') die(`nbk: port ${port} is busy. Try --port ${port + 1}`);
    die(`nbk: ${err.message}`);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Notebook serving ${root}`);
    console.log(`  http://localhost:${port}/`);
  });
} else if (cmd === 'start') {
  const { root, port } = parse(rest);
  await start({ root, port, entry: join(HERE, 'nbk.js') }).catch((e) => die(`nbk: ${e.message}`));
  // launchd reports success the moment it accepts the job, not when the port is
  // open. Poll briefly so "started" means the notebook actually answers.
  const url = `http://localhost:${port}/`;
  let up = false;
  for (let i = 0; i < 20 && !up; i++) {
    up = await fetch(url).then(() => true).catch(() => false);
    if (!up) await new Promise((r) => setTimeout(r, 250));
  }
  console.log(up ? `Notebook is serving ${root}` : `nbk: started, but nothing answered on ${url}`);
  console.log(`  ${url}`);
  if (!up) console.log(`  check ${LOG}`);
} else if (cmd === 'stop') {
  await stop();
  console.log('Notebook stopped.');
} else if (cmd === 'status') {
  const s = await status();
  if (!s.installed) console.log('Not set up to run on its own. Use: nbk start <folder>');
  else if (!s.running) console.log(`Installed but not running. Check ${LOG}`);
  else console.log(`Serving ${s.root}\n  http://localhost:${s.port}/`);
} else {
  die(USAGE);
}
