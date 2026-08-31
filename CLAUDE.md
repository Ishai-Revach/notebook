# Scrapbook, project instructions

> Self-contained project. An agent pointed at this folder has everything it needs. Read `STATE.md` first, then this file.
> This is Ishai's personal open-source project. It is NOT part of the Meridian workspace and inherits nothing from it.

## Read at session start

1. `STATE.md` , where the work stands, what is decided, what is next.
2. `README.md` , the product in plain language. This is the version Ishai reads.
3. The spec in `docs/` relevant to what you are about to touch. Do not read all five by default.

## Who you are talking to

**Ishai is a designer, not a developer.** This governs every reply.

- **Answer in plain language. If he does not need to know it, do not tell him.** No architecture terms, no file paths he did not ask for, no mechanics of how something works internally. He asked for this explicitly.
- **Short. Bullets. The default reply is 3 to 6 bullets, and fewer is better.** Lead with the answer.
- Never explain the build system, the merge logic, the resolver, or the daemon unless he asks. Those exist in `docs/` for whoever implements them.
- When he asks for an opinion, give one. A recommendation, not a survey of options.
- When he proposes something that is partly wrong, say which part and why, in one or two sentences, then do the work.

## Hard rules

**Ishai approves every publish action.** Pushing to a remote, creating a GitHub repo, publishing to npm, or deploying only happens when he explicitly asks for it in that specific moment, never assumed from earlier context. Local git commits are fine and expected on their own. When something is ready to go out, say so and wait for him to say go.

**No em-dashes or en-dashes, and no arrow character.** Grep every file before finishing, with `-E`: `grep -rEn '—|–|→' .` must come back empty apart from this file. The `-E` matters: macOS ships BSD grep, which does not understand `\|` alternation and reports a clean repo whatever is in it. CI runs the same check. Use a hyphen, comma, period, semicolon, or parens. This is zero tolerance and it applies to code comments and commit messages too.

**Never copy Meridian or client content into this repo.** The reference notebook at `~/Freelance-work/Meridian/platform-design/notebook/` contains client material (Confluence page IDs, artifact URLs, partner names). Read it as reference, port the mechanisms, never copy the content. This repo will be public. Stated as a product constraint in `docs/SPEC.md` section 3 and it is absolute.

**Log decisions in `STATE.md`.** Any decision that should survive the session goes there, dated, in one line. Do not let a decision die in chat scrollback.

## What is already decided

Do not relitigate these. They are in `docs/SPEC.md` section 11 with reasoning.

- Node 20 or newer. Package `scrapbook-hub` on npm, binary `sbk`, repo `scrapbook`. MIT. No telemetry.
- A document is a single HTML file. No database, no block model.
- Kernel installs once; the kit is vendored into each workspace as editable source. Updates come back through a three-way merge that never clobbers local edits. See `docs/ARCHITECTURE.md`.
- The CLI is the whole agent interface, vendor-neutral. `sbk agent-brief` is the discovery primitive. MCP later.
- One hub with one workspace switcher, and that switcher is the only locked surface.
- Ishai curates the app menu to start. Anyone can install an app from a URL without him.

## Build discipline

- **Day one means it works with no agent involved:** create a page, write, format, text boxes, folders, reorder the menu, task board, share. `docs/SPEC.md` section 9 defines this and it comes before the clever parts.
- **The kit is public API.** Anything a user might edit has a documented contract and a version. Keep the kit small; every file exposed is a promise.
- **Verify before claiming done.** Run it, open it, look at it. Never report a feature working on the strength of the code reading correctly.
- **Commit in scoped commits, staged by path.** Never `git add -A`. Each commit is a restore point.
- **No build step for a document.** If changing a paragraph requires a bundler, the design is wrong.

## Reference material (read, never copy)

- `~/Freelance-work/Meridian/platform-design/notebook/` , the working notebook this product comes from. The design system (`design-system/tokens.css`, `components.css`), the shell (`shell.js`), the share pipeline (`share/build-share.py`), and the task tool (`tasks.html`) are the things to port.
- `~/Freelance-work/Meridian/platform-design/.claude/rules/notebook.md` , the hard-won build spec for that notebook. Read it in full once before building the kit. Most of its checklist should become kit behavior rather than written advice. It contains client specifics; take the mechanisms only.
- `~/open-design/` , a local-first daemon plus web app on this machine, useful as a precedent for the daemon and always-on pattern.
