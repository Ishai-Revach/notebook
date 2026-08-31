# Scrapbook, product definition

> Personal project, open source. Lives outside the Meridian workspace on purpose.
> Status: definition draft, 2026-07-26. Author: Ishai, written with Claude.
> Nothing here is built yet. Today's notebook is `~/Freelance-work/Meridian/platform-design/notebook/` (static HTML pages inside a client project).
>
> **Companion specs:** [`ARCHITECTURE.md`](ARCHITECTURE.md) (what lives once versus what is copied into every workspace, and how upgrades survive it), [`AGENT-INTERFACE.md`](AGENT-INTERFACE.md) (how any agent discovers and drives it, plus what workspace creation scaffolds), [`TOOLS.md`](TOOLS.md) (the tool contract, the SDK, and the promotion path), and [`CUSTOMIZATION.md`](CUSTOMIZATION.md) (what is in your project and how to change it).

---

## 1. What it is

A local-first hub of documents where the documents are HTML files and an agent is a first-class author.

You open it like an app. It holds many documents, arranged in folders. Some documents are prose. Some are wild (animations, infographics, whole small websites). Some are not documents at all but tools (a task manager, a calculator, an image editor, a morning brief). You write in them by hand, and you tell an agent to write in them, and both are normal.

The one-line version: **Notion, if you could tell an agent to build the page and the page could be anything.**

## 2. Why it exists (what it does that Notion and Google Docs cannot)

Four things, in order of how much they matter.

1. **An agent authors and edits the document itself.** Not "an AI block inside a document". The agent opens the file, rewrites a section, adds a diagram, restructures the layout. In Notion you can ask AI to write text into a block. You cannot say "restructure this page as a lifecycle infographic with a dashed loop-back arrow" and get it.
2. **A document can be anything.** Because the format is HTML, the ceiling is the web. Animation, canvas, live charts, an interactive prototype, a whole scrolling site. This is the thing that makes the work feel like thinking out loud, and it is the thing a block-based editor structurally cannot allow.
3. **A page can be a working tool.** Not an embed, not a database view. Real behavior, written for the job in front of you. Today: `tasks.html`. Tomorrow: whatever the moment needs.
4. **The agent has the project's knowledge base in reach.** The documents sit next to `specs/`, `raw/`, `activity-log/`, `memory/`. Asking for a document means asking something that already knows the project. This is the actual reason the current notebook works, and any architecture that breaks it is wrong.

Everything else in this spec exists to serve those four and not break them.

## 3. Hard design constraints

These are the load-bearing decisions. Breaking one turns this into a worse Notion.

- **A document is a single HTML file.** No database, no block model, no proprietary format. A document is portable, greppable, diffable, and can be opened forever.
- **The scrapbook's own code lives inside the project it serves.** Design system, shell, navigation, chrome, edit mode, tools: vendored into `<project>/scrapbook/` as ordinary editable files, so the project's agent can read and change any of it with no mechanism to learn. Only the kernel (daemon, write API, registry, hub switcher) lives once. See [`ARCHITECTURE.md`](ARCHITECTURE.md).
- **Everything you can see is changeable.** What you download is version one: the bones. This is the product, not a feature of it. The one locked surface is the hub's workspace switcher. See [`CUSTOMIZATION.md`](CUSTOMIZATION.md).
- **Vendoring without a merge path is a trap,** so the update mechanism is load-bearing: per-file hashes of the pristine version, three-way merge, never a silent overwrite of something you edited. `ARCHITECTURE.md` section 5.
- **No accounts, no cloud sync, no realtime multiplayer.** Local-first. Sharing is an explicit export step.
- **No build step for a document.** Author it, save it, refresh. The agent must never need to run a bundler to change a paragraph.
- **The server binds to `127.0.0.1` only.** It writes files on disk; it is never reachable from the network.
- **The engine repo never contains client content.** Ever. Content is a workspace; workspaces are elsewhere.

## 4. Should this leave the Meridian folders?

Yes, with one correction to how you framed it.

Separate the **engine**, not the **content**.

The Meridian notebook's documents should stay at `platform-design/notebook/`. They depend on being next to the Meridian knowledge bank, they are versioned with that project's git, and they are client work. Ripping them out would break the exact thing that makes them useful.

What leaves is the machinery: the design system, the shell, the share pipeline, the tool runtime, the server. That becomes its own product at `~/AI-Projects/scrapbook/`, with its own git repo, and the Meridian notebook becomes its first registered workspace.

You get reuse across projects, no risky content migration, and upgrades to the engine reach every project at once.

## 5. Architecture

### 5.1 Engine and workspaces

```
~/AI-Projects/scrapbook/            ← THE OSS REPO (no content, ever)
├── kernel/                        ← installed once: daemon, write API, registry, hub, update
├── kit/                           ← the template that gets VENDORED into each workspace
│   ├── runtime/                   ←   shell, nav, doc chrome, edit mode, tool host
│   ├── design-system/             ←   tokens.css, components.css, fonts.css
│   ├── library/                   ←   templates + starter components
│   └── tools/                     ←   the official tools
├── cli/                           ← the `sbk` command
├── README.md                      ← the plain-language front door
├── STATE.md                       ← where the work stands right now
└── docs/                          ← the specs, including this file

~/.scrapbook/                       ← the user layer
├── workspaces.json                ← the registry: name to path
├── config.json                    ← your defaults across all workspaces
├── library/                       ← YOUR pool, a source to copy from (not a live layer)
└── logs/

<any project>/scrapbook/            ← A WORKSPACE: the kit, vendored, plus your content
├── scrapbook.json                  ← workspace config
├── SCRAPBOOK.md                    ← this workspace's agent brief
├── GUIDELINES.md                  ← house style for pages here (a default, not a rule)
├── design-system/                 ← yours, editable
├── runtime/                       ← yours, editable
├── tools/                         ← yours, editable
├── hooks/                         ← behavior extensions
├── library/                       ← this project's pool
├── docs/                          ← the documents (nesting allowed)
├── share/                         ← generated self-contained exports
├── .data/                         ← tool state as JSON (see 5.7)
└── .scrapbook/vendor.json          ← kit version + which files you have edited
```

A workspace registry entry:

```json
{
  "meridian-partners": {
    "path": "~/Freelance-work/Meridian/platform-design/notebook",
    "knowledge": ["../specs/**", "../raw/**", "../activity-log/**", "../memory/**"],
    "label": "Meridian Partners",
    "kitVersion": "1.4.2"
  },
  "home": { "path": "~/AI-Projects/home-scrapbook", "knowledge": ["./knowledge/**"] }
}
```

The kernel serves every registered workspace, from that workspace's own files:

- `http://localhost:7470/w/meridian-partners/docs/user-roles` , a document
- `http://localhost:7470/w/meridian-partners/design-system/tokens.css` , that workspace's design system
- `http://localhost:7470/hub` , the workspace switcher, kernel-served and unbreakable
- `http://localhost:7470/_nb/api/...` , the write API

Documents do not inline the design system; they link it, and the path resolves inside their own workspace. One change to `scrapbook/design-system/tokens.css` updates every document in that project, and nothing outside it. Cross-project propagation is explicit: promote the change to `~/.scrapbook/library/` and pull it into other workspaces, or upstream it to the kit. See [`ARCHITECTURE.md`](ARCHITECTURE.md).

### 5.2 Always on, feels like an app

Two pieces, both boring and both reliable:

1. **A launchd LaunchAgent** at `~/Library/LaunchAgents/com.ishai.scrapbook.plist` with `RunAtLoad` and `KeepAlive`. It starts at login, restarts on crash, survives reboot. This is how the always-on local apps you have seen do it. No Docker, no manual `npm run dev`.
2. **Install it as a desktop app from Chrome** (Install this page as an app). You get a Dock icon, its own window, no browser chrome, and it points at localhost. Zero code.

A native wrapper (Tauri, or a menu-bar app) is a nice-to-have much later. It buys polish, not capability.

### 5.3 Stack, locked: Node

Node 20 or newer, single-file daemon, minimal dependencies. Four reasons, and the distribution one is decisive:

- **Install is one command with no environment to manage.** `npx scrapbook-hub init` or `npm i -g scrapbook-hub`. Python would mean pipx or uv, a virtualenv, and a version fight on the user's machine. For a tool strangers download, that difference is most of the adoption.
- The tools are browser JavaScript anyway, so one language across the whole product.
- npm gives tool authors real packages when a tool needs them.
- The daemon pattern is already proven on this machine by open-design (`:7456`).

The daemon does four things and no more: serve static files per workspace, serve engine assets, expose a small JSON write API, and generate the document index. If it starts wanting a framework, that is a signal the scope drifted.

### 5.4 Names, locked

The product is **Scrapbook**. The published names have to dodge two real collisions, so they differ from it on purpose:

| Thing | Name | Why |
|---|---|---|
| Product | Scrapbook | Your call, unchanged |
| GitHub repo | `scrapbook` | Repo names are namespaced by account, so no collision |
| npm package | `scrapbook-hub` | `scrapbook` is taken by a dormant package; verified 2026-08-31 |
| CLI, short | `sbk` | For typing |
| CLI, long alias | `scrapbook-hub` | Unambiguous, what agents and docs use |

A bare `scrapbook` binary is deliberately **not** claimed: it is long to type for a command reached many times a day, and the name is already used on PyPI. `sbk` is short, free on PATH, and unambiguous. `sb` is left alone as too generic to claim politely.

### 5.5 Distribution and install

- **Primary:** npm, global or `npx`. `npx scrapbook-hub@latest init` scaffolds a workspace without installing anything permanently, which is the right first taste.
- **Also:** a Homebrew tap later, once there is demand. Not first.
- **License: MIT.** For a local-first CLI with no hosted component there is nothing for a copyleft license to protect, and MIT maximizes the chance other people build tools for it.
- **No telemetry, ever.** Say so in the README, because a local tool that writes files needs to earn trust immediately.
- The repo ships the engine, the design system, the official tool and component library, and an `examples/` workspace. It ships no content, and no client material, ever.

### 5.6 Documents

Self-describing. Metadata rides inside the file, so a document is portable and the index can always be rebuilt by scanning:

```html
<script type="application/json" id="nb-doc">
{ "title": "User roles", "group": "ux-research", "tags": ["research"],
  "contentVersion": 7, "publishedVersion": 7,
  "artifact": "https://claude.ai/...", "confluence": "https://..." }
</script>
```

**This kills a real tax.** Today, adding a page means editing the central registry in `shell.js` plus the sidebar nav in every single page. With per-document metadata plus a generated index, adding a document requires editing nothing else. The nav is rendered from `/_nb/api/docs`.

### 5.7 Tools

A tool is a folder, not a special thing. Full contract in [`TOOLS.md`](TOOLS.md):

```
tools/tasks/
├── tool.json          ← manifest: name, icon, storage, views, permissions
├── tool.html          ← the UI fragment
├── tool.js            ← optional, receives the scrapbook SDK
└── README.md          ← what it does, for humans and for agents
```

**Tool state goes in a file, not localStorage.** The daemon exposes `/_nb/api/kv/<workspace>/<tool>` which reads and writes `scrapbook/.data/<tool>.json`.

This is the highest-leverage change in the whole spec, and it is worth being explicit about why. Today `tasks.html` keeps everything in one browser's localStorage: the agent cannot see your tasks, cannot reorder them, cannot write a morning brief from them, and the data dies with the browser profile. Move it to a JSON file in the project and all of that inverts. "Make me a document showing what needs doing today" becomes a one-liner. That single change is what turns the scrapbook from a set of pages into a system.

**Tools compose into documents.** A document can embed one:

```html
<div data-nb-tool="tasks" data-view="this-week"></div>
```

The runtime mounts it. That is the "a document based on a tool" idea, and it means a morning brief is just a document with three tool blocks in it.

### 5.8 Editing by hand

An **edit mode** in the runtime, not a separate editor app. Toggle it, the article becomes `contenteditable`, a small floating toolbar appears, and save writes the HTML back to the same file through the API.

Deliberately constrained command set: bold, italic, link, h2, h3, list, quote, code, and insert-from-library. Markup gets normalized on save, because unconstrained `contenteditable` produces garbage.

It is a **mode**, not always-on. That matters: the agent and the browser both write the same file, so the save call carries the file's mtime and refuses to clobber a newer version. Two writers on one file is the main correctness risk in this design and it deserves that guard.

### 5.9 The library (the part that compounds)

`library/` holds reusable pieces: components (a callout, a tab strip, a lifecycle infographic, a chart block) and tools. Each entry is a folder with a manifest, a self-contained snippet, and a preview.

Three tiers. They are stages in a copy pipeline, not layers resolved at request time: an entry always ends up as local code in the workspace, which is what makes it editable and visible to the agent.

1. **Workspace** (`<project>/scrapbook/library/`), this project only.
2. **User** (`~/.scrapbook/library/`), a source to copy from into any of your workspaces.
3. **Official** (shipped in the kit), everyone who installs Scrapbook.

**Promotion moves an entry up a tier.** You build something good in a document, one command lifts it to your user library, and a second command packages it as a pull request against the public repo. Since the project is open source, tier 3 is how a stranger's tool becomes part of the product. That path is specified in [`TOOLS.md`](TOOLS.md), including the escape hatch that matters: people can install each other's tools directly from a git URL without the official repo ever being a bottleneck.

A generated `library/INDEX.md` is how an agent discovers what already exists, so it stops reinventing a card style that already shipped.

This is the "add features whenever I want and save them into a pool" ask, and it is what makes year two of this cheaper than year one.

### 5.10 House style: `GUIDELINES.md`

Each workspace carries a short `GUIDELINES.md` describing how pages here are normally built: the header pattern, the type scale, spacing, tone, which markers mean what, what a new page should look like. The agent reads it before authoring anything.

Three properties, and the third is the one that matters:

- **It is per workspace,** because a client project and your home scrapbook should not look alike.
- **It is one file a human can read and edit,** not a config schema. Editing it changes everything built after.
- **It is a default, not a rule.** If you tell the agent to do something else, it does something else, without arguing and without citing the guidelines back at you. The purpose is that pages you did not specify in detail still come out looking like the rest, which is the actual failure mode: a new page that looks like a stranger built it.

This replaces what is currently a long build checklist in the Meridian notebook's rules file. Anything mechanical in that checklist (scroll behavior, favicon, shell markup) should be enforced by the kit rather than restated as advice; what stays in guidelines is taste.

## 6. Multiple projects, multiple environments

Your question was whether the same product can serve a client project and home use without them bleeding into each other. Yes, and the answer is the workspace model in 5.1. Specifically:

- **One engine, N workspaces.** You never copy the engine. You register a path.
- **Each workspace carries its own agent brief** at `scrapbook/SCRAPBOOK.md`: what this project is, where its knowledge lives, its conventions, who is allowed to see its documents. It is checked into that project's repo, so any Claude Code session opened in that project reads it as normal context. That is your per-project agent, and it needs no configuration.
- **No shared data store.** Client documents, client tool data, and client library entries live entirely under that client's path. A workspace can be handed over, archived, or deleted whole, and nothing of it lingers.
- **Switching** is a dropdown in the chrome, and the workspace is in the URL, so bookmarks, shared links, and artifacts stay stable.
- **A visible workspace badge** in the chrome, tinted per workspace, so you always know which world you are in. Cheap, and it prevents the one embarrassing failure mode (client content rendered in the wrong context).
- A workspace's `knowledge` globs can point anywhere on disk, so a home workspace can read across several folders while a client workspace stays sealed to one.

Answer to "maybe I actually need to copy files": no. Copy nothing. The engine mounts; the content stays where the agent needs it.

## 7. Seamless from any agent, in any session

You want to be talking to a project's agent about a design and say "add that to my task list" or "make a document about this", and have it just work. Not only in Claude Code: whoever downloads this will be on Codex, Cursor, Gemini, Copilot, or something that does not exist yet.

The full contract is in [`AGENT-INTERFACE.md`](AGENT-INTERFACE.md). The three load-bearing ideas:

1. **The CLI is the only interface an agent needs.** `sbk` on PATH, with JSON output on every read command and exit codes that mean something. Any agent that can run a shell command can drive Scrapbook fully. No plugin, no protocol, no per-vendor integration.
2. **`sbk agent-brief` is the discovery primitive.** It prints the current, complete agent contract to stdout. So the instruction block that `init` writes into a project is three lines long and never goes stale: it says Scrapbook is here, and it says run that command to learn how to use it. The documentation lives in the tool, not in copies rotting inside a dozen `CLAUDE.md` files.
3. **`sbk init` is how an agent creates the local version.** It scaffolds the workspace, registers it, and appends its own marked instruction block to whichever agent config files the project already has. Idempotent and additive: it never overwrites what it did not write.

An MCP server (`sbk mcp`, stdio) is a thin wrapper over the same core for agents that prefer structured tools. Worth having, not worth having first.

## 8. Sharing

Keep the current approach and generalize it out of the Meridian folder. `nb share <doc>` inlines the design system and the document CSS and JS into one self-contained file, and you publish it. Two targets:

- **A claude.ai Artifact**, republished to the same URL so the link never changes. Same version discipline as today (`contentVersion` and `publishedVersion` in the document metadata, and the status indicator in the document's own bar).
- **A plain self-contained HTML file** you can send to anyone, no account needed. This is the safety valve and it should exist from day one.

Publishing stays your hand, always. The engine prepares; you send.

Document groups (today's UX Research trio, three URLs over one tabbed document) generalize to a `group` field in the metadata. Any set of documents can become one tabbed artifact.

## 9. Build order

Ordered by daily payoff, not by how fun it looks.

**What "day one" has to mean** (locked by Ishai, 2026-07-26). Before any of the clever parts, the scrapbook has to behave like an ordinary document app with no agent involved: create a page, write on it (headings, text, lists, links, quotes), add and move a text box, format a selection, arrange pages into folders, reorder the menu, use the task board, share a page. If a designer has to ask an agent to add a paragraph, the product has failed at the thing people will try first. This moves hand-authoring from late to early, and it is the correct trade.

| Phase | What | Why here |
|---|---|---|
| P0 | Extract engine, serve the existing Meridian notebook unchanged over http | Proves the split with zero content risk |
| P1 | launchd agent + Chrome-installed app | Always on, feels like an app, one afternoon |
| P2 | Kernel/kit split, vendoring, `sbk update` + per-document metadata and generated nav | Vendoring and the version manifest have to land before code assumes fixed locations; retrofitting a merge path later is a rewrite |
| P3 | **Authoring: new page, write, format, text boxes, folders, menu reorder** | The day-one promise above. Nothing else matters if this is missing. |
| P4 | File-backed tool storage, tasks first | Unlocks agent-readable tasks and the morning brief |
| P5 | `sbk` CLI, `init`, `agent-brief`, workspace guidelines file | Makes it seamless from any agent, and is the prerequisite for anyone else using it |
| P6 | Second workspace (home), prove isolation | Validates the multi-project claim early, while it is cheap to change |
| P7 | Public repo: MIT license, README, CONTRIBUTING, app contract, CI | The point at which a stranger can install it |
| P8 | Config, hooks, settings tool | The cheap customization paths, once vendoring has proven itself |
| P9 | App menu, curated list, install-from-URL, shared pieces | Starts compounding, and opens contribution |
| Later | Sharing generalization, comments, MCP server, native wrapper, Homebrew | Only when the daily loop is solid |

P3 and P4 are where this stops being a folder of pages and starts being a product. Consider them the real milestone.

**On when to go public:** P6 sits after your own daily loop works, on purpose. Publishing earlier means writing documentation for a design that is still moving and answering issues about it. The tool contract in particular should be exercised by two or three of your own tools before strangers are invited to write against it, because a schema is much cheaper to change before anyone depends on it. Nothing stops the repo existing (and being public) from day one; what waits is announcing it and inviting contributions.

## 10. Risks, stated plainly

- **Scope.** Written out, this reads as "build a Notion competitor", which is unwinnable head-on. The only reason it is feasible is the constraints in section 3. Documents are files, there is no database, there are no accounts, and there is no realtime. Every time one of those is questioned, the answer is no.
- **Two writers, one file.** The agent and edit mode both write documents. Mitigated by mtime-checked saves and by edit mode being a mode. Do not skip the guard.
- **Client content leaking into a personal repo.** The engine repo holds no content, and that is a rule, not a convention.
- **The current notebook's rules are rich and hard-won** (share pipeline, assumption marks across surfaces, Confluence pairing, seed-merge logic in tasks). Port them deliberately during P0 to P3 rather than rebuilding from memory. `platform-design/.claude/rules/notebook.md` is the source; it should be read once, in full, at P0 and turned into the engine's own rules.
- **Sharing outside Claude.** Artifacts are convenient but assume the reader is in that world. The self-contained file export is what keeps you from being cornered.
- **Third-party tools are third-party code.** Someone else's tool, installed into your scrapbook, runs on your machine and can be given file-backed storage. Mitigations in `TOOLS.md`: tools run sandboxed, permissions are declared in the manifest and enforced, and installing from a URL prints what it is asking for. The honest framing for the README is the npm one: you are trusting the author, same as any dependency. Do not pretend otherwise.
- **Open source has an ongoing cost.** Issues, questions, pull requests of varying quality, and people depending on decisions you wanted to change. Mitigation is a narrow, written scope (section 3 is exactly that) and a `CONTRIBUTING.md` willing to say no. Worth knowing before the announcement rather than after.
- **Total customizability turns the kit into public API,** and vendoring means every workspace can drift. The moment someone edits the shell template, its structure is a contract you cannot rename without breaking their scrapbook. This is the price of the promise and it is worth paying, but deliberately: a small kit, a versioned `runtime-schema`, three-way merges that never clobber, and `sbk run --safe` so a broken workspace is diagnosable in ten seconds. Full accounting in `ARCHITECTURE.md` section 9.
- **Your personal conventions are not contributor rules.** The no-dashes rule, the Fraunces headings, the orange accent, the Confluence pairing: those are your house style and they belong in your workspace conventions, not imposed on people writing tools. Mixing the two is how an OSS project acquires rules nobody can explain.

## 11. Decisions locked

1. **Name:** Scrapbook. Published as `scrapbook-hub` on npm, binary `sbk`, repo `scrapbook`. See 5.4.
2. **Open source:** yes, MIT, on GitHub, installable via npm. Engine only; no content in the repo.
3. **Stack:** Node 20 or newer. Locked, mainly because install friction decides adoption. See 5.3.
4. **Meridian content stays put** in the client repo as a registered workspace. Nothing migrates.
5. **Agent integration:** CLI-first, vendor-neutral, with `agent-brief` as the discovery primitive. MCP later. See `AGENT-INTERFACE.md`.
6. **Tool ecosystem:** three library tiers with a promotion path, plus direct git-URL installs so the official repo is never a bottleneck. See `TOOLS.md`.
7. **Kernel and kit.** The kernel installs once (daemon, write API, registry, hub switcher, update). The kit is vendored into every workspace as editable source, so the project's agent sees the whole codebase. Upgrades come back via `sbk update`, three-way merged per file. The one locked surface is the workspace switcher. See `ARCHITECTURE.md` and `CUSTOMIZATION.md`.

## 12. Still open

1. **Editing model ceiling.** Constrained `contenteditable` is the pragmatic call. If hand-authoring becomes your main way of working rather than the exception, that decision needs revisiting properly.
2. **How much of the current `scrapbook.md` rule set becomes engine behavior** versus staying per-workspace convention. Some of it (scroll boilerplate, favicon, sidebar shell) should just be enforced by the engine so it stops being a checklist. Your style rules should not be.
3. **Whether tool state belongs in git.** Committing `.data/` gives you task history and cross-machine sync through the project repo, at the cost of noisy diffs. Recommendation: commit it, and gitignore only caches.
4. **GitHub account and org.** Personal account is fine to start. An org only matters if other people end up maintaining it.

## 13. First move

Two candidates, pick by mood:

- **Fastest to something real:** P0 plus P1. Get the existing Meridian notebook served from an always-on local daemon in its own app window. Nothing about the content changes, and the split is proven.
- **Highest payoff for daily work:** P3 first, even before the extraction. Move `tasks.html` off localStorage onto a JSON file in the project, so the agent can read and write your tasks today. Small change, immediate difference, and it de-risks the most important claim in this spec.

Recommendation: P3 first, because it is a day of work and it makes the mornings better immediately, then P0 and P1.

Going public is P6, and deliberately not first. The repo can exist from the beginning; what waits is the invitation.
