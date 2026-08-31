import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plist, readPlist } from '../src/service.js';

// The plist is the only place the served folder is remembered, so a path that
// survives writing but not reading back means `sbk status` lies and `sbk stop`
// looks like it worked. Round-trip the awkward characters.
test('a folder path survives the round trip through the plist', () => {
  const root = '/Users/x/Notes & <Drafts>/my scrapbook';
  const { root: back, port } = readPlist(plist(['/usr/local/bin/node', '/x/sbk.js', 'serve', root, '--port', '4321']));
  assert.equal(back, root);
  assert.equal(port, 4321);
});

test('the plist escapes xml rather than emitting broken markup', () => {
  assert.match(plist(['serve', 'a & b']), /<string>a &amp; b<\/string>/);
  assert.doesNotMatch(plist(['serve', '<evil>']), /<string><evil>/);
});

test('an unrecognised plist reports nothing rather than guessing', () => {
  assert.deepEqual(readPlist('<plist></plist>'), { root: null, port: null });
});
