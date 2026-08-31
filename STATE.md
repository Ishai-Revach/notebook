# State

**last_updated:** 2026-08-31
**phase:** P0 through P9 done, first pass
**next move:** the editor, see below

---

## Where this came from

The Scrapbook started as a folder of static HTML planning pages inside a client project (`~/Freelance-work/Meridian/platform-design/notebook/`): documents Ishai reads and plans on, styled with their own small design system, authored and edited by an agent that can see the project's knowledge base. It worked well enough that it needs to be its own product: installable, shareable, usable in any project, open source.

This repo is that product. The client notebook stays where it is and becomes one workspace.

## What exists right now

The specs, plus a kernel that serves a folder of documents on `http://localhost:4321` and keeps doing it across restarts. Nothing is copied and nothing is rewritten.

Commands: `sbk serve` (this terminal), `sbk start` (always, and after a reboot), `sbk stop`, `sbk status`.

| File | What |
|---|---|
| `README.md` | The product in plain language. The version Ishai reads. |
| `docs/SPEC.md` | Product definition: what it is, why, constraints, architecture, build order, risks |
| `docs/ARCHITECTURE.md` | Kernel versus kit, vendoring, how updates survive it, the hub |
| `docs/AGENT-INTERFACE.md` | How any agent discovers and drives it; what workspace creation scaffolds |
| `docs/TOOLS.md` | The app contract, the SDK, authoring, the promotion path |
| `docs/CUSTOMIZATION.md` | What lives in a project folder and how to change it |
| `CLAUDE.md` | Project rules for any agent working here |
| `bin/sbk.js` | The CLI. One command so far: `serve` |
| `src/serve.js` | The static server: workspace root, directory listing, path escape refused |
| `src/service.js` | The launchd agent: install, remove, and report what is served |
| `state/*.json` | Where a tool keeps its state, in the workspace, readable and editable by the agent |
| `kit/` | The vendored source: design system, shell. Copied into each workspace and yours to edit |
| `src/kit.js` | Vendoring, the three-way merge behind `sbk update`, `diff` and `restore` |
| `src/nav.js` | Reads the workspace and builds the menu, on request, with no build step |
| `src/share.js` | Turns one page into a single file with nothing left to fetch |
| `kit/edit.js` | Authoring: edit mode, the toolbar, text boxes, autosave |
| `src/agent.js` | `sbk agent-brief`, the pointer blocks, the seeded SCRAPBOOK.md |
| `src/workspaces.js` | The registry: which folders are workspaces, and on which port |
| `kit/apps/tasks.html` | The task board every workspace is seeded with |
| `test/serve.test.js` | `node --test`, ten cases including traversal and symlink escape |
| `test/service.test.js` | Three cases: the served folder survives the plist round trip |

## Decisions log

Newest first. One line each. Reasoning lives in the specs.

- **2026-08-31** , A1 of the desktop app plan shipped, ahead of the app itself. One port, and the name in front of the address picks the workspace: `notebook.localhost:4321`. Every browser already resolves anything ending in `.localhost` to this machine, so names cost nothing and need no password.
- **2026-08-31** , A bare `localhost:4321` serves the first workspace rather than the switcher. The plan had old ports redirecting to new names; serving the default instead keeps every existing address working with no redirect machinery.
- **2026-08-31** , An address whose name matches no workspace shows the switcher, not the default. Silently serving the wrong scrapbook to someone who mistyped is worse than a page saying which ones exist.
- **2026-08-31** , P8 and P9 shipped, first pass. `scrapbook.json` carries the label and the accent colour, which is the whole cheap customisation path: anything it cannot express is a change to the kit, and the kit is sitting in the workspace.
- **2026-08-31** , Every workspace is seeded with a task board, written fresh rather than ported. The reference notebook's board is 2,600 lines of client-specific merge logic; a plain list of title and status is the part that was actually day one.
- **2026-08-31** , The board is seeded, not vendored. Once it is in a workspace it is that workspace's page and no update reaches back into it. The cost is that improvements do not reach existing workspaces, which is the same trade every seeded page makes.
- **2026-08-31** , A page can declare `scrapbook:app` and the authoring layer leaves it alone. Turning an app into editable prose would break the controls someone came to the page for.
- **2026-08-31** , `sbk install <url>` is https only, refuses to overwrite, and says plainly what an installed page can do. An installed page runs on the workspace's origin, so it can read the tool state and save over documents. There is no sandbox that leaves it able to be a useful tool, so the trust is made explicit instead of pretended away.
- **2026-08-31** , P7 shipped. README matches what the thing does, CONTRIBUTING says what the project cares about, and CI runs the tests on Node 20, 22 and 24.
- **2026-08-31** , The no-dashes rule was never actually being enforced. `grep $'\u2014\|\u2013\|\u2192'` returns nothing on macOS, because BSD grep does not understand `\|` alternation, so every check since the rule was written passed no matter what was in the repo. It needs `-E`. The repo turned out to be clean anyway. CI now runs the working form, so it cannot go quiet again.
- **2026-08-31** , P5 and P6 shipped. `sbk agent-brief` prints the contract rather than storing it, so a pointer left in a project only ever has to say "run this" and can never go stale.
- **2026-08-31** , `SCRAPBOOK.md` is the one per-workspace file a human edits, and it absorbs the house-style role that the 2026-07-26 decision called `GUIDELINES.md`. One file, not two.
- **2026-08-31** , A workspace keeps its port for good. Adding or removing another never renumbers the rest, so a bookmark stays valid.
- **2026-08-31** , One always-on process serves every registered workspace, each on its own port. A switcher across processes would need a supervisor and a proxy; across ports it is a link.
- **2026-08-31** , `sbk add` registers a folder and serves it exactly as it is. A folder that already has its own design system and shell does not want the kit dropped on top of it, which is how the reference notebook is served.
- **2026-08-31** , The switcher at `/_hub` is served by the kernel, so a workspace edited into a broken state cannot take away the way out of it.
- **2026-08-31** , P3 shipped, except the task board. New page, write, format, links, lists, quotes, text boxes you can drag, folders, menu order, and share as one file, all with no agent involved.
- **2026-08-31** , A page saves itself by serialising its own document with the injected chrome stripped out. Everything the kit injects carries `data-sb-chrome`, so what is on screen and what is on disk cannot drift apart, and the save works for anything a page grows later.
- **2026-08-31** , Formatting uses `document.execCommand`. It is deprecated and it is still the only rich-text editing every browser implements. The replacement is writing a selection model, which is a project of its own.
- **2026-08-31** , Moving a page in the menu renumbers every page in that list, not just the one moved. Only some pages carry an order, so shuffling a single number leaves gaps that read as random.
- **2026-08-31** , A page with text boxes carries its own `min-height`. A positioned box adds nothing to the page's height, so without it the box falls outside the scroll container and is clipped. Found by looking, not by reading the code.
- **2026-08-31** , A shared file drops the kit's scripts rather than inlining them. An Edit button that cannot save is worse than no Edit button.
- **2026-08-31** , P2 shipped. The kit is vendored into `<workspace>/scrapbook/`, with the exact shipped copy kept beside it under `.pristine/`. Hashes would spot a local edit but cannot merge around one, and a three-way merge needs the original text.
- **2026-08-31** , `sbk update` merges with `git merge-file`. Every machine that can run this has git, and writing another three-way merge would be a worse version of a solved problem.
- **2026-08-31** , A conflicted file leaves `.pristine` untouched, so running update again retries the same merge instead of treating the conflict as resolved.
- **2026-08-31** , The menu is generated per request from the pages themselves, not built into a file. A page declares itself with ordinary `<meta name="scrapbook:...">` tags, and a page with no tags still appears under its `<title>`. Writing an html file is the whole of adding a page.
- **2026-08-31** , The kit uses the `sb-` class prefix. The reference notebook keeps its own `nb-` design system untouched, so the two never have to agree.
- **2026-08-31** , P4 shipped. Tool state is a JSON file in the workspace at `state/<tool>.json`. The server accepts `PUT` there and nowhere else, only JSON, written to a temp file and renamed so a crash cannot truncate a board.
- **2026-08-31** , A tool keeps localStorage as its offline copy and treats the file as the real one. A browser that already holds a board hands it up the first time it meets a workspace with no file yet; a browser that has never held one stays quiet, so seeded defaults can never overwrite a real board.
- **2026-08-31** , **Renamed from Notebook to Scrapbook.** Ishai's call: the thing is his visual memory, a place everything goes and gets organised, and "notebook" was both generic and already Jupyter's word. npm `scrapbook-hub` (bare `scrapbook` is a dormant package), binary `sbk`, repo `scrapbook`. The known cost is that "scrap" leans toward keepsakes and away from a working surface, which the product's own writing has to carry instead of the name.
- **2026-08-31** , P1 shipped. Always-on is a launchd agent with `KeepAlive`, and the plist is the only config: the folder being served is remembered as an argument in it, so there is no second place for the answer to live.
- **2026-08-31** , The Dock icon is Chrome's own "Install page as app", not a generated `.app` bundle. Chrome takes the icon from the page and gets the window right, which is the whole job, for no code.
- **2026-08-31** , `sbk status` answers "is it running" by asking the port, not by reading launchd. Mid-restart launchd says "spawn scheduled", which is neither yes nor no.
- **2026-08-31** , P0 shipped. The server has no caching, etags, compression or range requests on purpose. One person, one machine, localhost. Add them when a page actually feels slow.
- **2026-08-31** , A workspace with no `index.html` gets a plain directory listing rather than a 404. The reference notebook has no front door and does not need one.
- **2026-07-26** , Basic authoring (new page, write, format, text boxes, folders, menu reorder) moves to the front of the build order. It has to work with no agent involved. Was late in the plan; that was wrong.
- **2026-07-26** , Each workspace carries a `GUIDELINES.md` house-style file the agent reads before authoring. A default, never a rule to argue back with.
- **2026-07-26** , Ishai curates the app menu to start. Anyone can still install an app from a URL without him. Opening curation later is a policy change, not an architecture change.
- **2026-07-26** , Kernel and kit split. The kernel (daemon, write API, registry, hub switcher, update) installs once. The kit (design system, runtime, nav, chrome, edit mode, tools) is vendored into each workspace as editable source so the project's agent can change anything with no mechanism to learn. Updates return via three-way merge against stored pristine hashes.
- **2026-07-26** , The workspace switcher is the single locked surface. Kernel-served so a broken workspace cannot take it down. Themeable, not removable.
- **2026-07-26** , Open source, MIT, on GitHub. Superseded by the rename on 2026-08-31. The original names were npm `notebook-hub`, binary `nbk`, repo `notebook`, chosen because `notebook` and `notebook-cli` were taken on npm and a bare `notebook` binary would collide with Jupyter's.
- **2026-07-26** , Node 20 or newer, not Python. Install friction decides adoption for a tool strangers download.
- **2026-07-26** , The CLI is the entire agent interface, vendor-neutral. `sbk agent-brief` prints the contract so the pointer left in a project never goes stale. MCP later, as a thin wrapper.
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

**The editor.** `docs/PLUGINS.md` has the plan: blocks as markup, a slash menu, plugins. B1 to B4 is the word processor and it is the piece everything else waits on.

The rest of the desktop app (A2 onward in `docs/DESKTOP-APP.md`) is ready to start whenever it is wanted; A1 is done.

### Known ceilings, not yet a problem

**No hooks, no settings page.** P8 called for both. `scrapbook.json` covers the settings a person actually changes, and hooks were skipped because nothing yet fires an event worth hanging one on. Adding them before there is a use is guessing at the shape.

**The app menu is a command, not a menu.** `sbk install <url>` works. There is no curated list, because there is nothing yet to curate.

**No delete.** A page can be made, renamed, moved and shared, but not deleted from the menu. Deleting a document is the one authoring action that loses work, and it should ask properly rather than sit in a row menu next to Rename.

**Which browser migrates the board.** A tool with no state file yet is migrated by the first browser that opens it and already holds a board. If a second browser gets there first, its own copy wins and the other is masked, not lost, since localStorage still holds it. Deleting the state file and reloading the right browser recovers it. It stops mattering once every workspace has been opened once.

**Where the agent is pointed.** The launchd agent runs `bin/sbk.js` from wherever the repo is checked out when `sbk start` runs. Right now that is a worktree, so removing the worktree breaks always-on. It stops mattering the moment the package is installed globally, which is the natural thing to do once this is merged to `main`.

## Session continuity

Update this file when project reality changes: bump `last_updated`, add to the decisions log, move the next move. An agent opening this folder cold should be able to read `STATE.md` plus `CLAUDE.md` and start working without asking Ishai to re-explain anything.
