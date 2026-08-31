import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { share } from '../src/share.js';

let root;

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'sbk-share-'));
  await mkdir(join(root, 'scrapbook/design-system'), { recursive: true });
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'scrapbook/design-system/tokens.css'), ':root{--x:1}');
  await writeFile(join(root, 'scrapbook/shell.js'), 'window.KIT = true;');
  await writeFile(join(root, 'own.js'), 'window.MINE = true;');
  await writeFile(join(root, 'assets/dot.png'), Buffer.from([137, 80, 78, 71]));
  await writeFile(join(root, 'page.html'), `<!doctype html><html><head>
<link rel="stylesheet" href="/scrapbook/design-system/tokens.css">
<link rel="stylesheet" href="https://example.com/remote.css">
</head><body><img src="assets/dot.png"><img src="https://example.com/x.png">
<script src="/scrapbook/shell.js"></script>
<script src="own.js"></script>
</body></html>`);
});

test('a shared page carries its own styles', async () => {
  const { html } = await share(root, 'page.html');
  assert.match(html, /--x:1/);
  assert.doesNotMatch(html, /<link[^>]*tokens\.css/);
});

test('a remote reference is left alone, not guessed at', async () => {
  const { html } = await share(root, 'page.html');
  assert.match(html, /https:\/\/example\.com\/remote\.css/);
  assert.match(html, /https:\/\/example\.com\/x\.png/);
});

test('a local image becomes part of the file', async () => {
  const { html } = await share(root, 'page.html');
  assert.match(html, /src="data:image\/png;base64,/);
});

test('the kit is dropped and the page keeps its own script', async () => {
  const { html } = await share(root, 'page.html');
  assert.doesNotMatch(html, /window\.KIT/);
  assert.match(html, /window\.MINE/);
});

test('the shared copy does not keep room for a sidebar it no longer has', async () => {
  const { html } = await share(root, 'page.html');
  assert.match(html, /shared copy: no sidebar/);
});

test('refuses to reach outside the workspace', async () => {
  await assert.rejects(() => share(root, '../secrets.html'), /outside the workspace/);
});
