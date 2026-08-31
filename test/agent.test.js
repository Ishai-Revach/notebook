import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentBrief, seedBrief, writePointers } from '../src/agent.js';

const box = () => mkdtemp(join(tmpdir(), 'sbk-agent-'));

test('the brief describes the workspace it was asked about', () => {
  const brief = agentBrief('/somewhere/notes', { address: 'http://notes.localhost:4321/' });
  assert.match(brief, /\/somewhere\/notes/);
  assert.match(brief, /http:\/\/notes\.localhost:4321\//);
  assert.match(brief, /scrapbook:group/);
});

test('a project with no agent file gets one', async () => {
  const root = await box();
  assert.deepEqual(await writePointers(root), ['AGENTS.md']);
  assert.match(await readFile(join(root, 'AGENTS.md'), 'utf8'), /sbk agent-brief/);
});

test('an existing agent file is appended to, not replaced', async () => {
  const root = await box();
  await writeFile(join(root, 'CLAUDE.md'), '# House rules\n\nDo the thing.\n');
  await writePointers(root);
  const text = await readFile(join(root, 'CLAUDE.md'), 'utf8');
  assert.match(text, /Do the thing\./);
  assert.match(text, /scrapbook:begin/);
});

test('running init twice does not leave two pointers behind', async () => {
  const root = await box();
  await writeFile(join(root, 'AGENTS.md'), '# Agents\n');
  await writePointers(root);
  await writePointers(root);
  const text = await readFile(join(root, 'AGENTS.md'), 'utf8');
  assert.equal(text.split('scrapbook:begin').length - 1, 1);
});

test('the house style file is seeded once and never overwritten', async () => {
  const root = await box();
  assert.equal(await seedBrief(root), true);
  await writeFile(join(root, 'SCRAPBOOK.md'), 'mine');
  assert.equal(await seedBrief(root), false);
  assert.equal(await readFile(join(root, 'SCRAPBOOK.md'), 'utf8'), 'mine');
});
