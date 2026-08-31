# Scrapbook, everything is changeable

> The engine ships bones, not a cage. What you download is version one.
> Rewritten 2026-07-26 for the vendored-kit architecture in [`ARCHITECTURE.md`](ARCHITECTURE.md), which replaced this document's original layered-resolver model. Companion to [`SPEC.md`](SPEC.md), [`AGENT-INTERFACE.md`](AGENT-INTERFACE.md), [`TOOLS.md`](TOOLS.md).

---

## 1. The short version

The scrapbook's own code lives inside your project, at `<project>/scrapbook/`. The design system, the shell, the navigation, the document chrome, edit mode, the tool host, the templates, the tools. All of it, as ordinary files in your repo.

So the answer to "how do I change the navigation" is: open `scrapbook/runtime/nav.js` and change it. There is no override folder, no eject command, no resolver to learn. You are already looking at the source.

This document exists to say what the files are, which changes are cheap versus expensive, and how to keep receiving upstream fixes after you have edited things.

## 2. What is in your project

```
<project>/scrapbook/
├── scrapbook.json          workspace config (see 4)
├── SCRAPBOOK.md            the workspace's agent brief, yours to write
│
├── design-system/
│   ├── tokens.css         colors, type scale, spacing, radius, motion
│   ├── components.css     every shared component
│   └── fonts.css          what loads, and from where
│
├── runtime/
│   ├── shell.html         the app frame: nav, header, content, chrome slots
│   ├── nav.js / nav.html  navigation model and render
│   ├── doc-chrome.js      the per-document bar: share, versions, download
│   ├── edit-mode.js       hand-editing behavior and its toolbar
│   ├── tool-host.js       how tool blocks mount, and the SDK bridge
│   └── index.js           the document index and search
│
├── library/
│   ├── templates/         what `sbk new` scaffolds from
│   └── components/        this project's component pool
│
├── tools/                 every tool, as editable source
├── share/                 the export pipeline and its targets
├── docs/                  your documents
├── .data/                 tool state, as JSON
└── .scrapbook/vendor.json  which kit version this came from, and what you have edited
```

The only thing not here is the kernel: the daemon, the file-write API, the workspace registry, and the hub's workspace switcher. Those stay installed once and are not yours to edit, for the reasons in `ARCHITECTURE.md` section 4. Everything above is.

## 3. Cheap changes and expensive changes

Both are allowed. The difference is only what happens when you run `sbk update`.

A file you have **not** edited receives upstream fixes silently, forever. A file you **have** edited is yours: upstream changes to it get three-way merged, and a genuine conflict leaves your version in place with `<file>.upstream` beside it for reconciling.

That gives a simple rule of thumb, not a restriction:

- **If config can do it, use config.** The file stays unmodified and keeps updating for free.
- **If a hook can do it, use a hook.** New file, so nothing upstream conflicts with it.
- **Otherwise edit the file.** That is what it is there for. Just know you now own it.

Nothing enforces this order. It is only about how much reconciling you sign up for.

## 4. Config: the cheap path

`scrapbook.json` in the workspace, with the same fields available at `~/.scrapbook/config.json` for defaults across all your workspaces. Workspace wins per field, merged shallowly, so a project can retint the accent without restating everything.

```json
{
  "schema": 1,
  "name": "meridian-partners",
  "label": "Meridian Partners",

  "theme": {
    "accent": "#e8622a",
    "fonts": { "title": "Fraunces", "heading": "Manrope", "body": "Manrope" },
    "surface": "white",
    "density": "comfortable"
  },

  "shell": {
    "nav": "sidebar",
    "navPosition": "left",
    "collapsedByDefault": false,
    "showWorkspaceBadge": true
  },

  "nav": {
    "groups": [
      { "title": "UX Research", "items": ["docs/jobs-to-be-done", "docs/journey", "docs/user-roles"] },
      { "title": "Planning", "items": ["tools/tasks", "docs/feature-board", "docs/milestone"] }
    ],
    "hidden": ["docs/scratch/**"],
    "pinned": ["tools/tasks"],
    "sort": "manual",
    "footer": ["docs/design-system"]
  },

  "tools": { "enabled": ["tasks", "morning-brief"], "disabled": ["pomodoro"] },
  "docs": { "defaultTemplate": "library/templates/doc-standard" }
}
```

This covers most of what people mean by "change how the navigation works" and "change how it looks": order, grouping, labels, pinning, hiding, sidebar versus top bar, which tools exist, accent, fonts, density.

**Config is editable from inside the scrapbook**, through a shipped `settings` tool that reads and writes this file. That tool is vendored like every other, so if you want a different settings screen, rewrite it. A product that promises total customization should be able to change itself from inside itself.

## 5. Hooks: behavior without owning a module

`scrapbook/hooks/*.js`, auto-loaded, each exporting named handlers. A hook transforms the runtime's data instead of replacing its code, so it is a new file that nothing upstream will ever conflict with. This is the sweet spot for "I want the nav to behave differently" without taking ownership of `nav.js`.

```js
// scrapbook/hooks/nav.js
export function onNavBuild(model, ctx) {
  // model.items: [{ id, type, title, path, group, meta }]
  const open = ctx.toolData('tasks')?.items.filter(t => t.status === 'in progress').length;
  return {
    ...model,
    items: [
      { id: 'today', type: 'virtual', title: `Today (${open})`, path: '/docs/today' },
      ...model.items.sort((a, b) => b.meta.modified - a.meta.modified),
    ],
  };
}
```

| Hook | Fires | Typical use |
|---|---|---|
| `onNavBuild(model, ctx)` | Nav model assembled, before render | Reorder, regroup, inject, badge |
| `onDocLoad(doc, ctx)` | A document is about to render | Inject chrome, add a banner, rewrite blocks |
| `onDocSave(doc, ctx)` | Before a write lands | Normalize markup, bump versions, lint |
| `onToolMount(tool, ctx)` | A tool block mounts | Pass context, gate access |
| `onChromeBuild(model, ctx)` | Document bar assembled | Add a button, change share targets |
| `onIndexBuild(docs, ctx)` | Document index generated | Custom grouping, computed metadata |
| `onThemeResolve(tokens, ctx)` | Tokens resolved | Compute a palette, react to time of day |

Signatures are versioned as part of the kit's `runtime-schema`, and a signature change is a major version.

## 6. Changing the shipped tools

`scrapbook/tools/tasks/` is the real source of the task manager, not a copy of a copy. Edit it, rewrite it, delete it. The same is true of every tool that came with the kit.

This is a plain consequence of vendoring, and it is the main thing the old eject command existed to fake. Your agent can be told "add a recurring-task field to the task tool" and it will find `scrapbook/tools/tasks/tool.js`, read it, and change it. Nothing to learn first.

If you later want your version everywhere, `sbk promote tools/tasks --to user` copies it into `~/.scrapbook/library/`, and new workspaces can pull it in with `sbk add tool tasks`. If it is good enough for everyone, `sbk lib package` prepares the upstream pull request. Contract and rules in [`TOOLS.md`](TOOLS.md).

## 7. Sharing what you changed

- **`sbk promote <path> --to user`** lifts a file, component, tool, or theme into `~/.scrapbook/library/`, so it follows you into future projects.
- **A theme is a package:** `design-system/*` plus the `theme` block of config. `sbk theme package`, `sbk theme add <git-url>`, `sbk theme use <name>`. Same tiers, same promotion, same direct-install escape hatch as tools.
- **A whole setup can be a starter:** `sbk new-workspace <dir> --from <git-url>` vendors someone else's kit, config, templates, and tools instead of the shipped ones. This is how a team standardizes, and how you would hand a ready-made setup to another designer.
- **Contributing back** is the same path as tools: package, validate, open a pull request.

## 8. Staying current after you have changed things

```
sbk update --check     is there a newer kit
sbk update --dry-run   what would change, file by file
sbk update             three-way merge it in
sbk diff <path>        your version against the pristine one
sbk restore <path>     discard your changes to one file
sbk doctor             hub version, kit version, modified files, conflicts
sbk run --safe         boot with the shipped kit, ignoring this workspace's
```

The mechanics, including the modified-file tracking that makes clean updates possible, are in [`ARCHITECTURE.md`](ARCHITECTURE.md) section 5. Two things worth repeating here:

- **Nothing you edited is ever silently overwritten,** and nothing you left alone ever blocks an update.
- **`sbk run --safe` is the escape hatch.** If a change breaks the workspace, safe mode boots the shipped kit so you can get in and fix it. It is also the first triage question for any bug report: does it still happen in safe mode.

## 9. The one invariant

The workspace switcher. Its existence and function are guaranteed by the kernel, and it is served by the kernel rather than by your workspace's runtime, so a broken kit cannot take it down. It reads your active workspace's tokens, so it looks like it belongs, but it cannot be removed, hidden, or intercepted, and there is a keyboard shortcut plus a `/hub` route that always work.

That is the whole locked surface. Everything else in the interface is a file in your project.
