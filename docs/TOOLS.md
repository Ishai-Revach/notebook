# Notebook tools, authoring and promotion

> How a tool is built, how any agent can build one, and the path from "I made this in my project" to "it ships with Notebook".
> Companion to [`SPEC.md`](SPEC.md) and [`AGENT-INTERFACE.md`](AGENT-INTERFACE.md). Definition draft, 2026-07-26.

---

## 1. What a tool is

A page that does something rather than saying something. Today's example is the task manager. Others that make sense: a calculator, an image cropper, a morning brief, a decision log, a moodboard, a timer, a diff viewer.

A tool is a folder of plain web files plus a manifest. It is not a plugin, there is no build step, and there is no compilation. That is deliberate: an agent can author a working tool in one pass, and a human can read the whole thing.

Two ways a tool appears:

- **As its own page**, at `/w/<workspace>/tools/<name>`, listed in the sidebar.
- **As a block inside a document**, so a document can compose tools:

```html
<div data-nb-tool="tasks" data-view="this-week"></div>
```

The second is what makes "a document that shows me what needs doing today" a five minute job instead of a project.

## 2. Anatomy

```
tools/tasks/
├── tool.json        required, the manifest
├── tool.html        required, the UI fragment (no <html>, <head>, or <body>)
├── tool.js          optional, ES module, receives the SDK
├── tool.css         optional, page-unique styles
├── README.md        strongly recommended, what it does and why
└── preview.png      optional, shown in the library
```

### 2.1 The manifest

```json
{
  "schema": 1,
  "name": "tasks",
  "title": "Tasks",
  "description": "A local task board with list and board views, nesting, and tags.",
  "version": "1.2.0",
  "author": "ishai",
  "license": "MIT",
  "icon": "list-checks",
  "storage": { "kind": "kv", "key": "tasks" },
  "views": {
    "default": { "title": "All tasks" },
    "this-week": { "title": "This week", "params": { "tag": "this-week" } }
  },
  "permissions": ["kv"],
  "requires": { "notebook": ">=1.0.0" }
}
```

Every field is either self-explanatory or explained below. Two that carry weight:

- **`views`** are the named entry points a document may embed. Declaring them means a document does not need to know the tool's internals, and a tool can change internally without breaking documents.
- **`permissions`** are declared, and the runtime enforces them. Nothing is ambient.

| Permission | Grants |
|---|---|
| `kv` | Read and write this tool's own state file. Nothing else's. |
| `docs:read` | List and read documents in the current workspace |
| `docs:write` | Create and modify documents. Prompts on install. |
| `net` | Outbound network requests. Must list allowed hosts. Prompts on install. |
| `files:read` | Read files under the workspace path. Prompts on install. |

A tool with no `permissions` key gets nothing but the DOM. That is the default, and plenty of tools need nothing more.

### 2.2 Icons

Lucide names only, resolved by the runtime from the bundled set. No external requests, no emoji standing in for an icon, and every tool looks like it belongs.

## 3. The SDK

`tool.js` is imported as a module and receives one object. That is the whole API surface, which is the point: a small, stable surface is what lets an agent write a correct tool without reading the source of the engine.

```js
export default function init(notebook) {
  // notebook.kv        file-backed state, this tool only
  //   .get()                      -> Promise<object>
  //   .set(obj)                   -> Promise<void>   full replace, mtime-checked
  //   .patch(partial)             -> Promise<object> shallow merge, returns the result
  //   .onExternalChange(cb)       fires when an agent or another tab writes the file

  // notebook.workspace  { name, label, accent }  read-only
  // notebook.view       { name, params }          which declared view is mounted
  // notebook.docs       list / read, only with docs:read
  // notebook.ui         DS-consistent primitives: button, chip, dialog, menu, field, empty
  // notebook.on('save' | 'resize' | 'visible', cb)
}
```

### 3.1 `kv` is the important one

`notebook.kv` writes a JSON file inside the workspace, at `notebook/.data/<key>.json`. Not localStorage.

This single decision is what makes tools worth building:

- **An agent can read and write the same state.** `nbk tool data tasks --json` returns your tasks; the agent can reorder them, add one, or write a document from them. A tool backed by localStorage is invisible to the agent and therefore half a product.
- **The state is versioned with the project,** so it has history and it moves between machines through the repo.
- **`onExternalChange`** means the UI updates when the agent writes, so the two never disagree on screen.

`kv` writes are mtime-checked and fail loudly on conflict, for the same reason document writes are.

### 3.2 Sandboxing

Every tool runs in a sandboxed iframe, and the SDK is a `postMessage` bridge to the host. Uniformly, including your own tools and the official ones.

The cost is small (design tokens are injected into the frame, and height auto-sizes through a `ResizeObserver`). The benefits are worth more than the cost:

- A third-party tool cannot read your documents, reach the network, or touch another tool's state unless its manifest says so and you agreed.
- A buggy tool cannot break the shell around it.
- The contract is testable, because there is exactly one way in.

Say the trust model plainly in the README: installing a tool from a URL is trusting its author, the same as adding an npm dependency. The sandbox narrows the blast radius; it does not make untrusted code safe.

## 4. Authoring, including by an agent

```
nbk tool new tasks
```

Scaffolds a working tool from the template: a valid manifest, a `tool.html` that renders, a `tool.js` that persists one value through `kv`, and a README skeleton. It runs immediately, which matters more than it sounds: an agent that starts from something working produces far better results than one starting from an empty file.

```
nbk tool validate tasks
```

Checks the manifest against the schema, verifies that declared views resolve, flags undeclared permission use (a `fetch` without `net`, a document read without `docs:read`), catches external asset references, and warns on missing README or version. CI runs the same command against every tool in the repo, so the contract is enforced mechanically rather than in review comments.

`nbk agent-brief` includes a compressed version of this document, so an agent asked to "build a tool that does X" has the contract in front of it without anyone pasting docs.

### 4.1 What a good tool looks like

Guidance worth putting in `CONTRIBUTING.md`, because it is the difference between a library people browse and a junk drawer:

- **One job.** A tool that manages tasks and also tracks time is two tools.
- **Works offline.** No network unless the job genuinely requires it.
- **Uses `notebook.ui` for controls** so it looks native in anyone's notebook, whatever their theme.
- **Stores plain, readable JSON.** Someone's agent is going to read it. Nested structures with opaque keys make that worse for everyone.
- **Degrades honestly.** Empty state says what to do, errors say what happened.
- **No analytics, no phoning home.** Non-negotiable for anything in the official library.

## 5. Promotion: the three tiers

Where a tool or component lives determines who can use it. The tiers are stages in a copy pipeline, not layers resolved at runtime: a tool only ever runs from the workspace's own `tools/` folder, as local editable code. Promotion copies it upward so future workspaces can pull it in.

| Tier | Location | Reach |
|---|---|---|
| 1. Workspace | `<project>/notebook/tools/<name>/` | This project. The only place a tool actually runs. |
| 2. User | `~/.notebook/library/tools/<name>/` | A source to copy into any of your workspaces |
| 3. Official | `kit/tools/<name>/` in the repo | Vendored into every new workspace, for everyone |

### 5.1 Tier 1 to tier 2

```
nbk promote tasks --to user
```

Copies the tool into your user library and validates it. The workspace copy stays exactly where it is and keeps running, so nothing changes visibly. From then on, `nbk add tool tasks` in any other workspace pulls your version in.

Because the official tools are vendored into every workspace as source, **changing a shipped tool needs no special command.** `notebook/tools/tasks/` is the real thing, not a reference copy. Open it and edit it; your agent will find it without being taught a mechanism.

### 5.2 Tier 2 to tier 3, the contribution path

This is how a stranger's tool becomes part of the product.

```
nbk lib package tasks
```

Produces a contribution bundle and a report:

1. Validates against the contract and fails on anything CI would fail on.
2. Strips workspace-specific state. **A tool's stored data never travels with the tool.** This is the step that prevents someone accidentally publishing their client's task list, and it is not optional.
3. Checks the manifest for `license`, `author`, `description`, and a `README.md` that is not the template.
4. Writes the bundle to a staging folder and prints the exact `git` and `gh pr create` commands to open the pull request.

It stops there, on purpose. It prepares the contribution; the human opens it. A CLI that opens pull requests on its own is a CLI people stop trusting.

On the maintainer side, `CONTRIBUTING.md` sets the bar: passes validation, one job, no network unless justified, MIT-compatible license, a README a stranger can follow, and a screenshot. CI runs `nbk tool validate` plus a smoke test that mounts the tool and asserts it renders.

**Curation policy, to start (locked by Ishai, 2026-07-26): Ishai is the only person who adds apps to the menu.** Contributions are welcome as pull requests and he decides what lands. The reasons are good ones: the menu stays short, everything in it works, and there is no review queue to keep up with while the product is still moving. Nothing is ever paid.

This is deliberately not a bottleneck on anyone's work, because of 5.3 below: anyone can install anyone else's app straight from a link without the menu being involved. Opening up curation later (co-maintainers, an automated index) is a change of policy, not of architecture, so it can wait until there is a reason.

### 5.3 The escape hatch that keeps the ecosystem alive

```
nbk tool add https://github.com/someone/nbk-tool-pomodoro
nbk tool add ./path/to/tool
```

Installs a tool directly into your user library from a git URL or a path, no official repo involved. It prints the manifest's declared permissions and asks for confirmation before installing anything beyond `kv`.

This matters more than the official library does. If the only way to share a tool is a pull request into someone else's repo, most tools never get shared, and the maintainer becomes a bottleneck on other people's work. Direct installs mean the ecosystem can grow faster than the maintainer can review, and the official library becomes what it should be: a curated shortlist, not a gate.

### 5.4 Components, same model

Components (a callout, a tab strip, an infographic frame, a chart block) follow the same three tiers and the same promotion commands. The difference is only what they are: an HTML fragment plus optional CSS and JS, with a manifest declaring insertion points, rather than a mounted application. `nbk lib add <doc> <selector> <name>` extracts one straight out of a document you already built, which is the path most components should take.

## 6. Versioning and stability

- **`schema` in every manifest.** The runtime supports the current schema and one back, and migrations are written, not improvised.
- **`requires.notebook`** is a semver range. A tool that needs a newer engine says so and refuses to mount with a clear message rather than failing strangely.
- **The SDK follows semver, and additions are the only easy change.** Once strangers write tools, removing an SDK method breaks their work. Get the surface in section 3 exercised by three or four of your own tools before inviting anyone in, because that is when it is still free to change.
