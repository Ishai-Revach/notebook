# Blocks and plugins

> Plan, not yet built. Written 2026-08-31 from Ishai's description: everything
> works like plugins. A plugin can be a whole page, like the task board, or
> something you insert into an ordinary page. Inside an ordinary page you write
> like a word processor: blocks you can move, a slash command to insert a
> checklist or a heading. Installing a plugin makes it yours to edit, and you
> can publish your version back for other scrapbooks to install.

## 1. The collision, and how it resolves

There is a locked decision in `SPEC.md` section 11:

> A document is a single HTML file. No database, **no block model.** This is
> what lets a document be anything, and it is not negotiable.

What Ishai has now described is a block model. That is not a contradiction to
paper over, so here is the resolution in full, because everything below depends
on it.

**What that decision was protecting** was never the absence of blocks. It was
three things:

1. A document is one file you can open, mail, or read in ten years.
2. Nothing has to be built, compiled or migrated for a page to work.
3. A page can contain anything, including things nobody anticipated, because
   the format is the web's format rather than a schema someone invented.

Notion's block model breaks all three: content is rows in a database, the file
does not exist, and a block can only be one of the types the schema allows.
That is what was rejected, and rejecting it was right.

**Blocks as markup break none of them.** A block is a `<div>` in the html file
with an attribute saying what kind it is. Moving a block reorders two DOM
nodes. Inserting a checklist inserts a `<ul>`. Saving writes the same single
html file the editor already writes today. Open that file with no server, no
kit and no JavaScript and it is still a readable document, because it was
always just markup.

So: **the block model is a convention over html, never a replacement for it.**
The rule this has to keep passing, and the thing to check first in any review:

> Delete the kit, open the file in a browser with JavaScript off. If it is
> still the document, the block is legitimate. If it is an empty div waiting
> for a renderer, it is the thing we said no to.

That test is what keeps this from quietly becoming the database.

## 2. What a block is

```html
<div class="sb-block" data-block="text">
  <p>An ordinary paragraph, which is an ordinary paragraph.</p>
</div>

<div class="sb-block" data-block="heading">
  <h2>A heading</h2>
</div>

<div class="sb-block" data-block="checklist">
  <ul class="sb-checklist">
    <li data-done="true">Something finished</li>
    <li data-done="false">Something not</li>
  </ul>
</div>
```

Three properties, and they are the whole contract:

- **The markup is the content.** No JSON sidecar, no id pointing at a store.
- **It renders with no JavaScript.** A checklist with JavaScript off is a list
  with ticks in it. Behaviour is an enhancement, never the thing itself.
- **The wrapper is uniform.** `.sb-block` with `data-block`. That is what the
  editor moves, selects and deletes, so it never needs to know what is inside.

An existing page, written before any of this, is already valid: content not
inside a `.sb-block` is treated as one implicit block. Nothing has to be
migrated, which is the point.

## 3. What a plugin is

Two kinds, and they are genuinely different things that happen to share a word.

### 3.1 A page plugin

A whole html file that does something rather than says something. The task
board is one, and it already works this way: a page carrying
`<meta name="scrapbook:app" content="true">`, which the authoring layer leaves
alone. `sbk install <url>` already installs one.

Nothing new is needed here beyond what exists. It is listed so the two ideas do
not get conflated.

### 3.2 A block plugin

Adds a kind of block you can insert into any page. A folder:

```
scrapbook/plugins/checklist/
  plugin.json      name, label, version, what it inserts
  block.js         registers the type, wires behaviour
  block.css        how it looks
```

`plugin.json` is small on purpose:

```json
{
  "name": "checklist",
  "label": "Checklist",
  "version": "1.0.0",
  "menu": "Checklist",
  "author": "someone"
}
```

`block.js` registers against one function:

```js
Scrapbook.block('checklist', {
  // What gets inserted when you pick it from the slash menu. Markup, so the
  // block exists and reads correctly the instant it lands, before any script
  // has run on it.
  create() {
    return '<ul class="sb-checklist"><li data-done="false"></li></ul>';
  },
  // Behaviour, added to a block that is already on the page. Called for blocks
  // the editor just inserted and for blocks that were in the file on load, so
  // it must be safe to run twice.
  mount(el) {
    el.addEventListener('click', ...);
  },
});
```

That is the entire API surface: `create`, `mount`, and the manifest. It is
small because it is a promise. Every function added here is a function that
cannot be changed once somebody has published a plugin against it.

### 3.3 Installed means yours

Same rule the kit already follows, for the same reason. A plugin installs as
ordinary source into your workspace, you can open it and change it, and
`sbk update` merges new versions around your edits rather than overwriting
them. Nothing is minified, nothing is hidden, nothing is read-only.

## 4. The word processor

This is itself a plugin, or rather it is the host plus three built-in block
types. It replaces the current `edit.js`.

**What it does:** you type. Enter makes a new block. A slash at the start of an
empty block opens a menu of every registered block type, filtered as you type.
Each block has a handle to drag it up or down, and a menu to delete or turn it
into another type. A page has a title at the top, and optionally a cover above
that.

**The three built in:** heading, text, checklist. Everything else, including
things Ishai has not thought of yet, arrives as a plugin.

**What this costs:** the current editor uses `document.execCommand` across the
whole article, which was the right lazy call for "make a page editable" and is
the wrong shape for this. Per-block editing means each block is its own
editable region and the editor owns Enter, Backspace at a boundary, and paste.
That is the genuinely hard part of this whole plan, and it is a rewrite of
`edit.js` rather than an addition to it. It is also unavoidable: a slash menu
and movable blocks do not sit on top of one big `contenteditable`.

## 5. The agent

This is the part that comes almost free, and it is the strongest argument for
blocks being markup.

An agent inserts a block by writing markup into the html file, which it already
knows how to do and already has the contract for in `sbk agent-brief`. "Write
some text, then drop an illustration in here" is: read the file, insert a
`<div class="sb-block" data-block="image">` where it belongs, write the file.
No API, no protocol, no store to reconcile against.

`sbk agent-brief` grows one section listing the block types installed in this
workspace and the markup each one expects. Because it prints rather than
stores, that list is generated from the plugins actually installed and cannot
go stale.

The one new rule: a page open in a browser does not see a change made to its
file. Currently that is fine because a page is written once. With an agent
inserting into a page while it is open, the editor needs to notice the file
changed and reload rather than save over it. That is a real concurrency
problem, and it is the second hardest thing here after the editor rewrite.

## 6. Installing and publishing

Deliberately last, and deliberately small.

**Installing** is what exists, extended: `sbk install <url>` already takes a
page. It grows the ability to take a plugin folder, given a url to its
`plugin.json`. Same rules as today: https only, refuses to overwrite, and says
plainly what an installed plugin can do, which is everything a script on that
page can do.

**Publishing** is a repository, not a service. `sbk publish <plugin>` prepares
the folder to be pushed to a GitHub repo of the author's choosing. Anyone can
install from a raw url without asking anyone's permission, which is the P9
decision already made: Ishai curates a short list of ones that work, and that
list is a json file in the scrapbook repository, not a server.

**Not now, and worth saying why.** A registry means versions, compatibility,
trust and someone's time answering issues. Two plugins written by one person do
not need any of it. The contract in 3.2 should be exercised by three or four
real plugins before anyone else is invited to write against it, because a
schema is cheap to change before people depend on it and expensive after.

## 7. Build order

| | What | Why here |
|---|---|---|
| **B1** | The block wrapper, and the rule in section 1. Existing pages keep working, content becomes blocks, nothing else changes | Smallest possible step, and it proves the markup convention before anything is built on it |
| **B2** | The editor rewrite: per-block editing, Enter makes a block, move up and down, delete | The hard part. Everything else waits on it |
| **B3** | The slash menu, and the three built-in types: heading, text, checklist | The thing that makes it feel like Notion |
| **B4** | Page title and cover | Small, and it is most of the first impression |
| **B5** | The plugin contract: `Scrapbook.block`, `plugin.json`, loading from `scrapbook/plugins/` | Only now, with three block types built, is it clear what the contract has to be |
| **B6** | The block types move out to plugins, so the built-ins prove the contract | If a built-in cannot be written as a plugin, the contract is wrong |
| **B7** | Reload-on-change, so an agent writing into an open page does not lose a race | Needed the first time an agent and a person touch one page together |
| **B8** | `sbk install` for plugins, `sbk publish`, the curated list | After the contract has survived contact |

**B1 through B4 is the word processor.** That is a coherent piece of work with
a visible result, and it is where I would stop and use it before going on.

B5 onward is the plugin system proper, and it should not start until the built
in blocks have been in daily use, because they are the evidence for what the
contract needs to be.

## 8. What this costs, plainly

- **It is bigger than everything built so far, combined.** P0 through P9 was a
  server, a kit and an editor. This is an editor of a different class.
- **B2 has no lazy version.** Per-block editing is genuinely intricate: Enter
  at the end of a block, Backspace at the start of one, paste of many
  paragraphs, selection across blocks. Every editor that exists has spent years
  there. The mitigation is to keep the block set tiny, not to be clever.
- **The plugin contract is permanent** in a way nothing else in this project is
  yet. Three functions is a promise that can be kept. Thirty is not.
- **The share pipeline has to keep working.** A shared file with block markup
  and no scripts must still read as the document. That is the section 1 test,
  and it is already how `sbk share` behaves, so it should hold, but it is the
  thing to check at every step.

## 9. What is needed from Ishai

- **A decision on section 1.** This changes a decision recorded as not
  negotiable. The change is that blocks are allowed as html markup, and the
  reasons behind the original decision are kept intact. It should be logged in
  `STATE.md` in his words, not assumed from this document.
- **How much like Notion.** Slash menu and movable blocks, yes. Nested blocks,
  columns, drag between pages, comments on a block: each is a decision, and
  each one at least doubles B2.
- **What the cover is.** An image, a colour, a generated thing. It is the first
  thing anyone sees on a page and it is a design call, not an engineering one.
