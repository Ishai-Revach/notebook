import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as kit from '../src/kit.js';

let root;
const live = () => join(root, kit.KIT_DIR, 'shell.js');
const pristine = () => join(root, kit.KIT_DIR, '.pristine', 'shell.js');
const read = (f) => readFile(f, 'utf8');

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'sbk-kit-'));
  await kit.init(root);
});

test('init vendors the kit and leaves something to open', async () => {
  const { seeded } = await kit.init(await mkdtemp(join(tmpdir(), 'sbk-fresh-')));
  assert.equal(seeded, 'index.html and tasks.html');
  assert.equal(await read(live()), await read(pristine()));
});

test('the board is seeded, not vendored, so no update reaches back into it', async () => {
  const fresh = await mkdtemp(join(tmpdir(), 'sbk-board-'));
  await kit.init(fresh);
  await writeFile(join(fresh, 'tasks.html'), 'my board now');
  const changes = await kit.update(fresh);
  assert.ok(!changes.some((c) => c.file.includes('tasks.html')));
  assert.equal(await read(join(fresh, 'tasks.html')), 'my board now');
});

test('init never overwrites a file that is already there', async () => {
  await writeFile(live(), 'mine, do not touch');
  const { added, kept } = await kit.init(root);
  assert.ok(kept.includes('shell.js'));
  assert.ok(!added.includes('shell.js'));
  assert.equal(await read(live()), 'mine, do not touch');
});

test('an untouched file updates cleanly', async () => {
  await writeFile(pristine(), '/* an older shipped version */\n');
  const changes = await kit.update(root);
  assert.ok(!changes.some((c) => c.file === 'shell.js'));
});

test('your edit survives an update that changes nothing upstream', async () => {
  const mine = (await read(live())) + '\n/* my own line */\n';
  await writeFile(live(), mine);
  const changes = await kit.update(root);
  assert.equal(changes.find((c) => c.file === 'shell.js').action, 'kept your version');
  assert.equal(await read(live()), mine);
});

test('your edit and a new version are merged, keeping both', async () => {
  // Pristine is what shipped last time. Make it look older at the top, and
  // edit the bottom, so the two changes cannot collide.
  const shipped = await read(live());
  await writeFile(pristine(), shipped.replace('/* Scrapbook shell.', '/* OLD HEADER.'));
  await writeFile(live(), shipped.replace('/* Scrapbook shell.', '/* OLD HEADER.') + '\n/* my own line */\n');

  const changes = await kit.update(root);
  assert.equal(changes.find((c) => c.file === 'shell.js').action, 'merged');
  const merged = await read(live());
  assert.match(merged, /my own line/, 'my edit should survive');
  assert.match(merged, /Scrapbook shell\./, 'the new version should land');
});

test('two edits to the same line stop and ask, rather than picking one', async () => {
  const shipped = await read(live());
  await writeFile(pristine(), shipped.replace('/* Scrapbook shell.', '/* OLD HEADER.'));
  await writeFile(live(), shipped.replace('/* Scrapbook shell.', '/* MY HEADER.'));

  const changes = await kit.update(root);
  assert.equal(changes.find((c) => c.file === 'shell.js').action, 'merged with conflicts');
  assert.match(await read(live()), /<<<<<<</);
  // Pristine must not move, so running update again retries the same merge
  // instead of pretending the conflict was resolved.
  assert.match(await read(pristine()), /OLD HEADER/);
});

test('restore throws away your changes, diff shows them first', async () => {
  await writeFile(live(), 'gone wrong');
  assert.match(await kit.diff(root, 'shell.js'), /gone wrong/);
  assert.equal(await kit.restore(root, 'shell.js'), true);
  assert.equal(await read(live()), await read(pristine()));
});

test('installing refuses anything but https, so what arrives is what was sent', async () => {
  await assert.rejects(() => kit.install(root, 'http://example.com/app.html'), /only https/);
  await assert.rejects(() => kit.install(root, 'not a url'), /not a url/);
});

test('installing takes a page from a url and names it from its title', async () => {
  const { createServer } = await import('node:http');
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><html><head><title>Timer App</title></head><body>hi</body></html>');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/anything`;

  const made = await kit.install(root, url);
  assert.equal(made.file, 'timer-app.html');
  assert.match(await read(join(root, 'timer-app.html')), /Timer App/);

  // Twice is a refusal, not a silent overwrite of whatever is there now.
  await assert.rejects(() => kit.install(root, url), /already here/);
  server.close();
});
