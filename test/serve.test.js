import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createScrapbookServer } from '../src/serve.js';

let server, origin, root, outside;

before(async () => {
  const box = await mkdtemp(join(tmpdir(), 'sbk-test-'));
  root = join(box, 'workspace');
  outside = join(box, 'secrets');
  await mkdir(root);
  await mkdir(outside);
  await mkdir(join(root, 'design-system'));
  await mkdir(join(root, 'withindex'));
  await writeFile(join(root, 'tasks.html'), '<h1>Tasks</h1>');
  await writeFile(join(root, 'design-system/tokens.css'), ':root { --x: 1 }');
  await writeFile(join(root, 'withindex/index.html'), '<h1>Home</h1>');
  await writeFile(join(outside, 'private.txt'), 'do not serve me');
  await symlink(join(outside, 'private.txt'), join(root, 'leak.txt'));

  server = createScrapbookServer(root);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('serves a document with the right content type', async () => {
  const res = await fetch(`${origin}/tasks.html`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(await res.text(), '<h1>Tasks</h1>');
});

test('serves a nested asset', async () => {
  const res = await fetch(`${origin}/design-system/tokens.css`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/css/);
});

test('lists the folder when there is no index.html', async () => {
  const body = await (await fetch(`${origin}/`)).text();
  assert.match(body, /tasks\.html/);
  assert.match(body, /design-system\//);
});

test('prefers index.html when one exists', async () => {
  assert.equal(await (await fetch(`${origin}/withindex/`)).text(), '<h1>Home</h1>');
});

test('404s a missing page', async () => {
  assert.equal((await fetch(`${origin}/nope.html`)).status, 404);
});

test('refuses to escape the workspace with ..', async () => {
  const res = await fetch(`${origin}/../secrets/private.txt`, { redirect: 'manual' });
  assert.notEqual(res.status, 200);
  assert.doesNotMatch(await res.text(), /do not serve me/);
});

test('serves a doubled slash instead of erroring', async () => {
  const res = await fetch(`${origin}//`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /tasks\.html/);
});

test('refuses percent-encoded traversal', async () => {
  const res = await fetch(`${origin}/..%2f..%2fsecrets%2fprivate.txt`, { redirect: 'manual' });
  assert.notEqual(res.status, 200);
  assert.doesNotMatch(await res.text(), /do not serve me/);
});

test('ignores the query string', async () => {
  assert.equal(await (await fetch(`${origin}/tasks.html?v=2`)).text(), '<h1>Tasks</h1>');
});

test('refuses to escape the workspace through a symlink', async () => {
  const res = await fetch(`${origin}/leak.txt`);
  assert.equal(res.status, 403);
});
