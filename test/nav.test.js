import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildNav } from '../src/nav.js';

let root;

const page = (title, tags = '') => `<!doctype html><html><head>
<title>${title}</title>${tags}</head><body></body></html>`;

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'sbk-nav-'));
  await mkdir(join(root, 'research'));
  await mkdir(join(root, 'scrapbook'));
  await mkdir(join(root, 'state'));
  await writeFile(join(root, 'zeta.html'), page('Zeta'));
  await writeFile(join(root, 'alpha.html'), page('Alpha &amp; Friends'));
  await writeFile(join(root, 'first.html'), page('Ignored', '<meta name="scrapbook:label" content="First"><meta name="scrapbook:order" content="1">'));
  await writeFile(join(root, 'secret.html'), page('Secret', '<meta name="scrapbook:hidden" content="true">'));
  await writeFile(join(root, 'research/journey.html'), page('Journey', '<meta name="scrapbook:group" content="Research">'));
  await writeFile(join(root, 'scrapbook/shell.js'), 'not a page');
  await writeFile(join(root, 'state/tasks.json'), '{}');
});

test('a page with no metadata still appears, under its title', async () => {
  const nav = await buildNav(root);
  assert.ok(nav.pages.some((p) => p.label === 'Zeta' && p.href === 'zeta.html'));
});

test('a label overrides the title, and order comes before the alphabet', async () => {
  const nav = await buildNav(root);
  assert.equal(nav.pages[0].label, 'First');
});

test('unordered pages fall back to alphabetical', async () => {
  const nav = await buildNav(root);
  const rest = nav.pages.slice(1).map((p) => p.label);
  assert.deepEqual(rest, [...rest].sort((a, b) => a.localeCompare(b)));
});

test('entities in a title are decoded, not shown raw', async () => {
  const nav = await buildNav(root);
  assert.ok(nav.pages.some((p) => p.label === 'Alpha & Friends'));
});

test('a hidden page stays out of the menu', async () => {
  const nav = await buildNav(root);
  assert.ok(!JSON.stringify(nav).includes('Secret'));
});

test('a grouped page lands in its group, not the top level', async () => {
  const nav = await buildNav(root);
  assert.deepEqual(nav.groups, [
    { label: 'Research', items: [{ href: 'research/journey.html', label: 'Journey', group: 'Research' }] },
  ]);
});

test('the kit and the state folder are not pages', async () => {
  const nav = await buildNav(root);
  assert.ok(!JSON.stringify(nav).includes('scrapbook/'));
  assert.ok(!JSON.stringify(nav).includes('state/'));
});

test('a workspace can be renamed and re-accented without touching the kit', async () => {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(root, 'scrapbook.json'), JSON.stringify({ label: 'Home Notes', accent: '#336699' }));
  const nav = await buildNav(root);
  assert.equal(nav.workspace, 'Home Notes');
  assert.equal(nav.accent, '#336699');
});

test('a broken config file is ignored rather than fatal', async () => {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(root, 'scrapbook.json'), '{ not json');
  const nav = await buildNav(root);
  assert.ok(nav.workspace, 'the folder name should still come through');
  assert.equal(nav.accent, null);
});
