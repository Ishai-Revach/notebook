# Notebook, kernel and kit

> The decision about what lives once and what gets copied into every workspace, and why.
> Supersedes the layered-resolver model in the first draft of `CUSTOMIZATION.md`.
> Companion to [`SPEC.md`](SPEC.md). Definition draft, 2026-07-26.

---

## 1. The question

Ishai's proposal: the workspace sits inside each project folder, and one hub application loads all of them. The hub creates the folder structure, downloads the files it needs, and everything (design system, runtime, tools) is duplicated per workspace so the agent has the entire codebase in front of it. The agent may change anything except the link back to the hub, which owns the one menu for crossing between workspaces.

The alternative, from the first draft: one engine installed once, thin per-workspace overrides resolved at request time, `nbk eject` when you want to own a file.

## 2. What the proposal gets right

Three things, and the first is strong enough to change the design on its own.

**1. Agents work on files in the project, not on a global install.** This is the decisive argument. If the runtime lives in a global npm directory, an agent in the project cannot read the shell template to learn its structure, cannot grep the design system to match an existing style, and in many setups is not permitted outside the working directory at all. The override-and-eject model asked the agent to learn a mechanism before it could change anything. Vendoring asks it to learn nothing: the files are right there, so editing them is the obvious move rather than the advanced one. For a product whose whole premise is agent-native authoring, that difference is not a detail.

**2. The mental model collapses to something true.** "It is all here, change it" beats "there is a three-layer resolver, and here is the eject command." A promise that needs a mechanism explained is a weaker promise.

**3. Per-project stability, which I undercredited.** A vendored workspace does not change under you when the hub upgrades. For client work that is genuinely valuable: the Meridian notebook keeps rendering exactly as it did last month, no matter what you install this month. Live-linking a shared engine means every upgrade silently touches every project at once, which is the wrong default for work you are being paid for.

## 3. What it gets wrong

**Upgrades stop reaching anyone.** With six workspaces each holding a full copy, a fix to the share pipeline, the tool host, edit mode, or the write API reaches nobody. Fixing it means six manual updates, each risking a collision with local changes. This is the failure the resolver existed to prevent, and hand-waving it is how a vendored project becomes six abandoned private forks. It is felt within months by you and immediately by anyone else who installs this.

**Duplicating the write path duplicates the risk.** The file-write logic and the resolver are the two places where a bug loses work. Nobody wants to customize them, and copying them into every project multiplies the chance that one workspace has a subtly broken one.

**The pool stops compounding.** Full duplication means a good component built in one project does not flow to the others, in either direction, without manual copying. That was one of the things you wanted most.

## 4. The decision

Split by mutability, not by location. Two parts, one boundary.

**The kernel** stays installed once and is not copied: the daemon, the file-write API, the workspace registry, the update machinery, the hub chrome, the CLI. Roughly a tenth of the code, and none of it is anything anyone wants to redesign.

**The kit** is vendored into every workspace, in full, and is yours the moment it lands: the design system, the runtime shell, the navigation, the document chrome, edit mode, the tool host, the templates, and the tools. No eject step, no resolver to learn. The agent opens the file and edits it.

| | Kernel (installed once) | Kit (copied per workspace) |
|---|---|---|
| Where | the hub, global install | `<project>/notebook/` |
| Contents | daemon, write API, registry, update, hub chrome, CLI | design system, runtime, nav, chrome, edit mode, tool host, templates, tools, library entries in use |
| Changeable | no | anything, freely |
| Upgrades | with the hub | opt-in, per file, three-way merged |
| In the project's git | no | yes |
| Visible to the project's agent | reference copy, read-only | fully, it is just the codebase |

This keeps your proposal's payoff (the agent sees and owns the whole surface it might want to change) and removes its two dangerous parts (duplicated write path, dead upgrade path).

## 5. Making upgrades survive vendoring

Vendoring is only sane with a merge mechanism. This is the part that has to exist, and it is well-trodden ground: it is how Rails `app:update`, `npx shadcn diff`, and every vendored-dependency workflow stays maintainable.

When the hub vendors the kit, it writes a manifest:

```json
// <project>/notebook/.notebook/vendor.json
{
  "schema": 1,
  "kitVersion": "1.4.2",
  "vendoredAt": "2026-07-26T09:14:00Z",
  "files": {
    "design-system/tokens.css":  { "hash": "sha256:a1b2...", "modified": false },
    "design-system/components.css": { "hash": "sha256:c3d4...", "modified": true },
    "runtime/nav.js":            { "hash": "sha256:e5f6...", "modified": false }
  }
}
```

The hash is of the pristine shipped version, which makes the only question that matters answerable: **did you change this file?**

```
nbk update            three-way merge the kit to the current version
nbk update --dry-run  what would change, per file
nbk update --check    is an update available
nbk diff <path>       your version against pristine
nbk restore <path>    throw away local changes to one file
```

`nbk update` walks every file and does one of four things:

| Your file | Upstream | Action |
|---|---|---|
| unchanged | changed | overwrite silently, you get the fix |
| unchanged | unchanged | nothing |
| changed | unchanged | leave it alone |
| changed | changed | three-way merge; on conflict, keep yours, write `<file>.upstream` beside it, and report |

Never a silent overwrite of something you edited, and never a blocked update because of a file you never touched. It prints a summary: how many files updated cleanly, how many were skipped as locally modified, and which need a look.

Two supporting rules:

- **`notebook.json` config is the low-risk path, still.** Changing the accent through config rather than editing `tokens.css` means the file stays unmodified and keeps receiving upstream fixes. Worth saying in the docs: configure when you can, edit when you want to. Not a restriction, just cheaper.
- **Workspaces pin their kit version and never auto-update.** Upgrading the hub changes nothing in any project until you run `nbk update` in it. That is the per-project stability you were reaching for, made explicit.

## 6. The hub

One application, the only thing you cannot change, exactly as you described. It is the kernel plus a deliberately small chrome.

**Creating a workspace** is what you described and it is right:

```
nbk new-workspace ~/some/project --label "Some Project"
```

or the same flow from the hub UI: pick a directory, name it, and it creates `notebook/` inside, vendors the current kit, registers the workspace, writes the agent pointer blocks, and opens it. One action, and the project now contains a complete, editable notebook.

**The switcher, and what "cannot change" means.** Being precise here matters, because an invariant that is too strict is annoying and one that is too loose lets you lock yourself out:

- **Guaranteed by the kernel:** the switcher exists, lists every registered workspace, and works. A workspace cannot remove it, break it, or hide it. It is served by the kernel, not by the workspace's own runtime, so a broken kit cannot take it down.
- **Themeable:** it reads the active workspace's tokens so it looks like it belongs. Appearance yours, existence not.
- **Always reachable:** a kernel route (`/hub`) and a keyboard shortcut that the workspace cannot intercept. Even with a completely broken workspace, you can get out.
- **`nbk run --safe`** boots the kernel chrome with the shipped kit and ignores the workspace's version entirely. This is the recovery path, and it is also the fastest triage question for any issue anyone files: does it still happen in safe mode.

## 7. What the library becomes

With vendoring, sharing is copy-on-demand rather than live-linked, and that is the honest version anyway.

- `~/.notebook/library/` remains, as a **source to copy from**, not a runtime layer. Your components and tools live there and travel between projects.
- `nbk add component <name>` and `nbk add tool <name>` copy an entry into the current workspace, where it becomes local editable code like everything else.
- `nbk promote <path> --to user` lifts something good from a workspace into your library, and `nbk lib package` still prepares an upstream contribution.
- The three tiers survive intact. What changes is that they are stages in a copy pipeline rather than layers resolved at request time, which is simpler to reason about and much friendlier to agents, since the code always ends up local.

## 8. What this changes in the other specs

- **`CUSTOMIZATION.md`** loses its spine. The layered resolver, the three levels, and `nbk eject` were all machinery for reaching code that lived somewhere else. With the kit vendored, roughly half of that document becomes unnecessary, which is a good outcome: the customization story is now "the code is in your project, edit it," plus config as the cheap path and hooks as a way to keep merges clean. It gets rewritten to the smaller model.
- **`SPEC.md` 5.1 and 5.6** need correcting. Documents still link the design system rather than inlining it, but the path resolves inside the workspace, not to a shared engine. A change to `notebook/design-system/tokens.css` updates every document in that project, and nothing outside it.
- **`SPEC.md` build order.** The resolver phase becomes the vendoring and update phase, and it stays early for the same reason: retrofitting a version manifest and a merge path onto code that assumed fixed locations is a rewrite.
- **`AGENT-INTERFACE.md`** gets simpler and stronger. `agent-brief` no longer has to teach an override mechanism. It says: the notebook's own code is at `./notebook`, here is the layout, edit it, and run `nbk update --check` before you assume a file is current.

## 9. Costs that remain, with eyes open

- **Four to six megabytes of vendored kit in each project's git repo,** and its diffs show up in client code review. Mitigation: keep the kit small, and gitignore only caches. Mostly this is a cosmetic complaint that is worth paying for the agent access.
- **Merge conflicts are now a thing users experience.** Unavoidable in any vendored model. Mitigation: the modified-file tracking means conflicts only ever happen in files you actually edited, and `<file>.upstream` beside the file is enough for an agent to reconcile it for you. Worth noting that "ask your agent to merge this" is a genuinely good answer here in a way it would not have been five years ago.
- **Divergence over time.** Six workspaces will drift apart. Mitigation: `nbk update --check` in `nbk doctor`, and accepting that some drift is the point. A client project frozen on last quarter's kit is working as designed.
- **Two-part versioning.** The hub and the kit version separately, and support conversations have to establish both. Mitigation: `nbk doctor` prints both, and every JSON payload carries them.
