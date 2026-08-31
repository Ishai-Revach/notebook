# State

**last_updated:** 2026-08-31
**phase:** P0 and P1 done, the notebook is always on
**next move:** P2 or P4, see below

---

## Where this came from

The Notebook started as a folder of static HTML planning pages inside a client project (`~/Freelance-work/Meridian/platform-design/notebook/`): documents Ishai reads and plans on, styled with their own small design system, authored and edited by an agent that can see the project's knowledge base. It worked well enough that it needs to be its own product: installable, shareable, usable in any project, open source.

This repo is that product. The client notebook stays where it is and becomes one workspace.

## What exists right now

The specs, plus a kernel that serves a folder of documents on `http://localhost:4321` and keeps doing it across restarts. Nothing is copied and nothing is rewritten.

Commands: `nbk serve` (this terminal), `nbk start` (always, and after a reboot), `nbk stop`, `nbk status`.

| File | What |
|---|---|
| `README.md` | The product in plain language. The version Ishai reads. |
| `docs/SPEC.md` | Product definition: what it is, why, constraints, architecture, build order, risks |
| `docs/ARCHITECTURE.md` | Kernel versus kit, vendoring, how updates survive it, the hub |
| `docs/AGENT-INTERFACE.md` | How any agent discovers and drives it; what workspace creation scaffolds |
| `docs/TOOLS.md` | The app contract, the SDK, authoring, the promotion path |
| `docs/CUSTOMIZATION.md` | What lives in a project folder and how to change it |
| `CLAUDE.md` | Project rules for any agent working here |
| `bin/nbk.js` | The CLI. One command so far: `serve` |
| `src/serve.js` | The static server: workspace root, directory listing, path escape refused |
| `src/service.js` | The launchd agent: install, remove, and report what is served |
| `test/serve.test.js` | `node --test`, ten cases including traversal and symlink escape |
| `test/service.test.js` | Three cases: the served folder survives the plist round trip |

## Decisions log

Newest first. One line each. Reasoning lives in the specs.

- **2026-08-31** , P1 shipped. Always-on is a launchd agent with `KeepAlive`, and the plist is the only config: the folder being served is remembered as an argument in it, so there is no second place for the answer to live.
- **2026-08-31** , The Dock icon is Chrome's own "Install page as app", not a generated `.app` bundle. Chrome takes the icon from the page and gets the window right, which is the whole job, for no code.
- **2026-08-31** , `nbk status` answers "is it running" by asking the port, not by reading launchd. Mid-restart launchd says "spawn scheduled", which is neither yes nor no.
- **2026-08-31** , P0 shipped. The server has no caching, etags, compression or range requests on purpose. One person, one machine, localhost. Add them when a page actually feels slow.
- **2026-08-31** , A workspace with no `index.html` gets a plain directory listing rather than a 404. The reference notebook has no front door and does not need one.
- **2026-07-26** , Basic authoring (new page, write, format, text boxes, folders, menu reorder) moves to the front of the build order. It has to work with no agent involved. Was late in the plan; that was wrong.
- **2026-07-26** , Each workspace carries a `GUIDELINES.md` house-style file the agent reads before authoring. A default, never a rule to argue back with.
- **2026-07-26** , Ishai curates the app menu to start. Anyone can still install an app from a URL without him. Opening curation later is a policy change, not an architecture change.
- **2026-07-26** , Kernel and kit split. The kernel (daemon, write API, registry, hub switcher, update) installs once. The kit (design system, runtime, nav, chrome, edit mode, tools) is vendored into each workspace as editable source so the project's agent can change anything with no mechanism to learn. Updates return via three-way merge against stored pristine hashes.
- **2026-07-26** , The workspace switcher is the single locked surface. Kernel-served so a broken workspace cannot take it down. Themeable, not removable.
- **2026-07-26** , Open source, MIT, on GitHub. npm package `notebook-hub`, binary `nbk`, repo `notebook`. Product name stays Notebook. `notebook` and `notebook-cli` are taken on npm, and a bare `notebook` binary would collide with Jupyter's.
- **2026-07-26** , Node 20 or newer, not Python. Install friction decides adoption for a tool strangers download.
- **2026-07-26** , The CLI is the entire agent interface, vendor-neutral. `nbk agent-brief` prints the contract so the pointer left in a project never goes stale. MCP later, as a thin wrapper.
- **2026-07-26** , A document is a single HTML file. No database, no block model. This is what lets a document be anything, and it is not negotiable.
- **2026-07-26** , Tool state is a JSON file in the workspace, never localStorage, so the agent can read and write it. This is what makes a morning brief a five-minute job.
- **2026-07-26** , The Meridian notebook content stays in the client repo as a registered workspace. Nothing migrates.

## Still open

Small, and none of it blocks P0.

1. **Editing model ceiling.** Constrained `contenteditable` is the plan. If hand-authoring becomes the main way Ishai works rather than the exception, revisit properly.
2. **Whether tool state belongs in git.** Recommendation: commit it, gitignore only caches.
3. **GitHub account or org.** Personal account is fine to start.
4. **How much of the client notebook's build checklist becomes kit behavior** versus staying house style. Mechanical things (scroll behavior, favicon, shell markup) should be enforced by the kit; taste stays in `GUIDELINES.md`.

## Next move

Ishai's call between two.

**P2, kernel/kit split, vendoring, `nbk update`, generated nav.** The structural one. It has to land before code assumes fixed locations, and retrofitting the merge path later is a rewrite.

**P4, file-backed tool storage, tasks first.** The one he says he would feel first, in his mornings. Out of order, and worth it if the daily payoff matters more than build order.

P3 (authoring) is the real milestone either way and comes after whichever of these goes first.

### Known ceiling, not yet a problem

The launchd agent runs `bin/nbk.js` from wherever the repo is checked out when `nbk start` runs. Right now that is a worktree, so removing the worktree breaks always-on. It stops mattering the moment the package is installed globally, which is the natural thing to do once this is merged to `main`.

## Session continuity

Update this file when project reality changes: bump `last_updated`, add to the decisions log, move the next move. An agent opening this folder cold should be able to read `STATE.md` plus `CLAUDE.md` and start working without asking Ishai to re-explain anything.
