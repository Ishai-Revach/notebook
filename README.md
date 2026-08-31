# Scrapbook

A place to keep documents that can be anything, where your agent is one of the authors.

You open it like an app. It holds your pages. Some are writing, some are diagrams or animations or small websites, and some are working tools like a task board. You write in them yourself, and you tell your agent to write in them, and both are normal.

---

## Setting it up

Needs Node 20 or newer, on a Mac.

```
npm install -g scrapbook-hub
sbk init ~/some/project
sbk start
```

That is the whole setup. `init` puts everything it needs inside that folder, `start` serves it and keeps serving it after a restart. It prints the address to open.

Repeat `init` for every project. Client work, home stuff, whatever. Each one is separate and cannot see the others, and the workspace name in the sidebar switches between them.

Already have a folder of pages you like? `sbk add ~/that/folder` serves it exactly as it is and adds nothing to it.

### The commands

| | |
|---|---|
| `sbk init [dir]` | set a folder up as a workspace |
| `sbk add [dir]` | serve a folder as it is, without the kit |
| `sbk start` | serve every workspace, now and after a restart |
| `sbk stop` | stop serving |
| `sbk status` | what is being served, and where |
| `sbk share <page>` | write one file you can send anyone |
| `sbk update` | bring the kit up to date, keeping your edits |
| `sbk install <url>` | add a page someone else wrote |
| `sbk agent-brief` | the contract, for an agent to read |

## What works without an agent

Press Edit, and:

- Create a new page from the sidebar.
- Write on it. Headings, text, lists, links, quotes.
- Add a text box and drag it where you want it.
- Arrange pages into folders and reorder the menu.
- Share a page as a single file you can send anyone.

Every workspace comes with a task board. It keeps its tasks in a plain file, so
"put this week's tasks on a page called Today" is a sentence, not a job.

Not yet: deleting a page. That one should ask properly rather than sit in a menu
next to Rename.

## What you ask the agent for

Everything past that:

- "Make me a page about the review flow, pull it from the specs folder."
- "Turn this into a diagram."
- "Add an animation to the top of this page."
- "Put the tasks tagged this-week on a page and call it Today."
- "Move these three pages into a group in the menu called Research."
- "Build me a page that calculates X."
- "Change the accent colour to orange everywhere."

It can also just write you a plain HTML page that does whatever you described, linked in the menu like any other page. That is allowed and it is often the fastest thing.

## You can change all of it

When the app sets up your project folder, it puts its own files there too: the design, the menu, the page chrome, the tools. Not hidden away somewhere on your computer, but in the project, next to your pages.

That means two things:

- **You never have to look at them.** Ignore all of it and the scrapbook works fine.
- **When you want something different, your agent just changes it.** No special mode, no settings you have to find. The code is sitting right there, so "make the menu work differently" is a normal request.

I keep improving the shipped version. When there is an update, you get told, and pulling it in keeps whatever you changed. If something breaks, there is a way to boot the original and fix it.

## House style

Each project folder has a short guidelines file: how pages here are usually laid out, the fonts, the spacing, the tone. Your agent reads it before it builds anything, so new pages look like the old ones instead of like a stranger made them.

It is a suggestion, not a rule. Tell the agent to do something different and it does something different. Edit the guidelines file and everything after follows the new version.

## Apps and shared pieces

An "app" is a page that does something rather than says something. The task board is one. A calculator, an image cropper, a morning brief, a timer.

- The app menu lists what you can add. One click and it is in your scrapbook.
- You can ask your agent to build a new one. It becomes a page in your project like anything else.
- You can put yours on GitHub for other people to install.
- A **shared piece** is smaller: an area of a page, or a whole page with its content, that someone else can drop into theirs.

To start, I curate what is in the menu, so it stays short and everything in it works. Anyone can still install anyone else's app directly from a link, without going through me. Nothing is paid, ever.

## What you never have to care about

Listed so you can stop thinking about them: where the files go, what the ports are, keeping the server running, how updates merge, how sharing gets built, what the folder structure means. The app handles all of it, and if any of it needs your attention, that is a bug.

---

**For whoever builds this:** [`docs/SPEC.md`](docs/SPEC.md) is the product definition, [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is what lives where and how updates work, [`docs/AGENT-INTERFACE.md`](docs/AGENT-INTERFACE.md) is how any agent drives it, [`docs/TOOLS.md`](docs/TOOLS.md) is the app contract, [`docs/CUSTOMIZATION.md`](docs/CUSTOMIZATION.md) is what is changeable. [`STATE.md`](STATE.md) is where the work currently stands.
