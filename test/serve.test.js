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

const put = (path, body) =>
  fetch(`${origin}${path}`, { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) });

test('a tool can save its state and read it back', async () => {
  assert.equal((await put('/state/tasks.json', { tasks: [{ title: 'ship it' }] })).status, 204);
  const back = await (await fetch(`${origin}/state/tasks.json`)).json();
  assert.deepEqual(back, { tasks: [{ title: 'ship it' }] });
});

test('state that was never saved reads as an empty object, not a 404', async () => {
  const res = await fetch(`${origin}/state/never-written.json`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {});
});

test('refuses to write outside the state folder and the documents', async () => {
  // Encoded, because fetch would normalise a plain ../ away before sending.
  assert.equal((await put('/state/..%2ftasks.html', '{}')).status, 403);
  assert.equal((await put('/..%2fsecrets%2fx.html', '{}')).status, 403);
  assert.equal((await put('/state/notes.txt', '{}')).status, 403);
  assert.equal((await put('/state/sub/dir.json', '{}')).status, 403);
  assert.equal((await put('/design-system/tokens.css', 'body{}')).status, 403);
  // The kit is edited on purpose, in an editor, not by a page saving itself.
  assert.equal((await put('/scrapbook/shell.js', 'x')).status, 403);
  assert.equal((await put('/scrapbook/anything.html', 'x')).status, 403);
});

test('a document saves itself, and comes back as it was written', async () => {
  const page = '<!doctype html><html><head><title>Edited</title></head><body><p>hi</p></body></html>';
  assert.equal((await put('/tasks.html', page)).status, 204);
  assert.equal(await (await fetch(`${origin}/tasks.html`)).text(), page);
});

test('creating a page picks a name from the title and never lands on an existing one', async () => {
  const make = (title) => fetch(`${origin}/_new`, { method: 'POST', body: JSON.stringify({ title }) }).then((r) => r.json());
  assert.deepEqual(await make('My First Page!'), { href: 'my-first-page.html' });
  assert.deepEqual(await make('My first page'), { href: 'my-first-page-2.html' });
  const html = await (await fetch(`${origin}/my-first-page.html`)).text();
  assert.match(html, /<title>My First Page!<\/title>/);
});

test('a new page in a group says so in its own markup', async () => {
  const made = await fetch(`${origin}/_new`, {
    method: 'POST', body: JSON.stringify({ title: 'Grouped', group: 'Research' }),
  }).then((r) => r.json());
  const html = await (await fetch(`${origin}/${made.href}`)).text();
  assert.match(html, /name="scrapbook:group" content="Research"/);
});

test('refuses a body that is not JSON, so a tool cannot corrupt its own state', async () => {
  assert.equal((await put('/state/tasks.json', 'not json at all')).status, 400);
  const back = await (await fetch(`${origin}/state/tasks.json`)).json();
  assert.deepEqual(back, { tasks: [{ title: 'ship it' }] });
});

test('refuses other methods', async () => {
  assert.equal((await fetch(`${origin}/tasks.html`, { method: 'DELETE' })).status, 405);
});

test('the menu is read from the workspace, and a page needs no registration', async () => {
  const nav = await (await fetch(`${origin}/_nav.json`)).json();
  const labels = nav.pages.map((p) => p.label);
  assert.ok(labels.length > 0, 'a workspace of html files should produce a menu');
  assert.ok(nav.pages.some((p) => p.href === 'tasks.html'));
});
