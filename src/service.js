import { writeFile, unlink, readFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);

export const LABEL = 'com.notebook.hub';
export const PLIST = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
export const LOG = join(homedir(), 'Library', 'Logs', 'notebook.log');
const DOMAIN = `gui/${process.getuid()}`;

function xml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

export function plist(args) {
  const argv = args.map((a) => `      <string>${xml(a)}</string>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${argv}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xml(LOG)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(LOG)}</string>
</dict>
</plist>
`;
}

/** Read back what a plist is serving. Paired with plist() above. */
export function readPlist(text) {
  const unxml = (v) => v.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const args = [...text.matchAll(/<string>([^<]*)<\/string>/g)].map((m) => unxml(m[1]));
  const i = args.indexOf('serve');
  const p = args.indexOf('--port');
  return { root: i === -1 ? null : args[i + 1], port: p === -1 ? null : Number(args[p + 1]) };
}

// launchctl exits non-zero for "already loaded" and "not loaded", which are both
// fine here. Callers care about the end state, not the transition.
async function launchctl(...args) {
  try {
    return await run('launchctl', args);
  } catch (err) {
    return { stdout: '', stderr: err.stderr ?? String(err), code: err.code };
  }
}

/** Install and start the launchd agent. Replaces any previous one. */
export async function start({ root, port, entry }) {
  await mkdir(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true });
  await launchctl('bootout', `${DOMAIN}/${LABEL}`);
  await writeFile(PLIST, plist([process.execPath, entry, 'serve', root, '--port', String(port)]));
  const res = await launchctl('bootstrap', DOMAIN, PLIST);
  if (res.code) throw new Error(res.stderr.trim() || 'launchctl bootstrap failed');
}

/** Stop the agent and remove it, so it does not come back after a restart. */
export async function stop() {
  await launchctl('bootout', `${DOMAIN}/${LABEL}`);
  await unlink(PLIST).catch(() => {});
}

/**
 * What the agent is doing right now.
 * ponytail: "is it running" is answered by asking the port, not by scraping
 * launchctl. launchd reports "spawn scheduled" mid-restart, which is neither
 * yes nor no, and the only thing the answer is used for is whether the
 * notebook opens.
 */
export async function status() {
  let installed;
  try {
    installed = await readFile(PLIST, 'utf8');
  } catch {
    return { installed: false, running: false };
  }
  const { root, port } = readPlist(installed);
  const running = port
    ? await fetch(`http://localhost:${port}/`).then(() => true).catch(() => false)
    : false;
  return { installed: true, running, root, port };
}
