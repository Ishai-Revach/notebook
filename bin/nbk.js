#!/usr/bin/env node
import { resolve } from 'node:path';
import { statSync } from 'node:fs';
import { createNotebookServer } from '../src/serve.js';

const USAGE = 'usage: nbk serve [dir] [--port N]';

const [cmd, ...rest] = process.argv.slice(2);
if (cmd !== 'serve') {
  console.error(USAGE);
  process.exit(1);
}

let dir = '.';
let port = 4321;
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--port') port = Number(rest[++i]);
  else if (rest[i].startsWith('-')) {
    console.error(USAGE);
    process.exit(1);
  } else dir = rest[i];
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`nbk: not a port: ${port}`);
  process.exit(1);
}

const root = resolve(dir);
try {
  if (!statSync(root).isDirectory()) throw new Error();
} catch {
  console.error(`nbk: not a folder: ${root}`);
  process.exit(1);
}

const server = createNotebookServer(root);
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`nbk: port ${port} is busy. Try --port ${port + 1}`);
  else console.error(`nbk: ${err.message}`);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Notebook serving ${root}`);
  console.log(`  http://localhost:${port}/`);
});
