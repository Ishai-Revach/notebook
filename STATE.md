# State

**last_updated:** 2026-07-26
**phase:** definition complete, nothing built yet
**next move:** P0, see below

---

## Where this came from

The Notebook started as a folder of static HTML planning pages inside a client project (`~/Freelance-work/Meridian/platform-design/notebook/`): documents Ishai reads and plans on, styled with their own small design system, authored and edited by an agent that can see the project's knowledge base. It worked well enough that it needs to be its own product: installable, shareable, usable in any project, open source.

This repo is that product. The client notebook stays where it is and becomes one workspace.

## What exists right now

Specs only. No code.

| File | What |
|---|---|
| `README.md` | The product in plain language. The version Ishai reads. |
| `docs/SPEC.md` | Product definition: what it is, why, constraints, architecture, build order, risks |
| `docs/ARCHITECTURE.md` | Kernel versus kit, vendoring, how updates survive it, the hub |
| `docs/AGENT-INTERFACE.md` | How any agent discovers and drives it; what workspace creation scaffolds |
| `docs/TOOLS.md` | The app contract, the SDK, authoring, the promotion path |
| `docs/CUSTOMIZATION.md` | What lives in a project folder and how to change it |
| `CLAUDE.md` | Project rules for any agent working here |

## Decisions log

Newest first. One line each. Reasoning lives in the specs.

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

**P0: serve the existing notebook.** Stand up the kernel as a plain local daemon and serve the client notebook at `~/Freelance-work/Meridian/platform-design/notebook/` over http, unchanged. Nothing about that content moves or changes. This proves the split with zero risk to work in progress.

Then **P1** (launchd agent plus install-as-app, so it is always on and has a Dock icon) and **P2** (kernel/kit split, vendoring, `nbk update`, generated nav). Full table in `docs/SPEC.md` section 9.

Ishai's own stated preference was to do the tool-storage change early because it improves his mornings immediately. That is P4 in the table. Worth asking him whether to pull it forward before P2, since it is a day of work and it is the change he will feel first.

## Session continuity

Update this file when project reality changes: bump `last_updated`, add to the decisions log, move the next move. An agent opening this folder cold should be able to read `STATE.md` plus `CLAUDE.md` and start working without asking Ishai to re-explain anything.
