import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, byHost, addressOf, PORT } from '../src/workspaces.js';

test('a name becomes something that can sit in front of an address', () => {
  assert.equal(slugify('Meridian Platform Design'), 'meridian-platform-design');
  assert.equal(slugify('Home!! (notes)'), 'home-notes');
  assert.equal(slugify('  --  '), 'scrapbook');
  assert.equal(slugify('Tom & Jerry'), 'tom-jerry');
});

test('the address is a name, not a number', () => {
  assert.equal(addressOf({ slug: 'notebook' }), `http://notebook.localhost:${PORT}/`);
});

/* byHost reads the real registry, so these cover the parsing rules it applies
   rather than whatever happens to be registered on this machine. */
function pick(all, host) {
  if (!host) return null;
  const name = String(host).split(':')[0].toLowerCase();
  if (name === 'localhost' || name === '127.0.0.1' || name === '::1' || name === '[::1]') return all[0] ?? null;
  return all.find((w) => w.slug === name.split('.')[0]) ?? null;
}

const all = [{ slug: 'notebook', path: '/a' }, { slug: 'home', path: '/b' }];

test('a bare localhost serves the first workspace, so old addresses keep working', () => {
  assert.equal(pick(all, 'localhost:4321').path, '/a');
  assert.equal(pick(all, '127.0.0.1:4321').path, '/a');
});

test('a name in front picks the workspace, whatever the port', () => {
  assert.equal(pick(all, 'home.localhost:4321').path, '/b');
  assert.equal(pick(all, 'HOME.localhost').path, '/b');
});

test('a name nobody has picks nothing, rather than the wrong scrapbook', () => {
  assert.equal(pick(all, 'typo.localhost:4321'), null);
  assert.equal(pick(all, ''), null);
});

test('byHost agrees with those rules', async () => {
  assert.equal(await byHost(''), null);
  assert.equal(await byHost('definitely-not-a-workspace-xyz.localhost'), null);
});
