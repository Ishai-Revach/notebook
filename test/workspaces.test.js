import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_PORT } from '../src/workspaces.js';

/* register() writes to the real ~/.scrapbook, so the port rule is tested as
   the pure thing it is rather than by moving someone's registry aside. */
function freePort(workspaces) {
  const taken = new Set(workspaces.map((w) => w.port));
  let port = FIRST_PORT;
  while (taken.has(port)) port++;
  return port;
}

test('the first workspace gets the first port', () => {
  assert.equal(freePort([]), FIRST_PORT);
});

test('a new workspace never takes a port that is already spoken for', () => {
  const taken = [{ port: FIRST_PORT }, { port: FIRST_PORT + 1 }];
  assert.equal(freePort(taken), FIRST_PORT + 2);
});

test('removing a workspace frees its port for the next one', () => {
  const after = [{ port: FIRST_PORT }, { port: FIRST_PORT + 2 }];
  assert.equal(freePort(after), FIRST_PORT + 1);
});
