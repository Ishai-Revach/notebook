# Scrapbook, the desktop app

> Plan, not yet built. Written 2026-08-31, from Ishai's description: a desktop
> application where the application running *is* the service running, which
> manages scrapbooks (make a new one, point at an existing folder, move one,
> stop serving one), while the browser stays the way you actually read them.
> Viewing inside the app, with a switcher, comes later and is not urgent.

## 1. What it is

**A control panel, first.** One window listing your scrapbooks, with a way to
make a new one, adopt a folder you already have, move one somewhere else, and
stop serving one. It shows whether the service is running, and quitting the app
stops it. There is no separate on and off to remember, because the app is the
switch.

**A viewer, later.** Eventually the same window opens a scrapbook and switches
between them. That is genuinely nice and it is not the point: the browser
already does that job well, and every hour spent on a webview is an hour not
spent on the part only an app can do.

Reading always works in a browser, from the same server, whether the window is
open or not. The app is a nicer front door and a set of controls, not a
different product.

## 2. What it is not

Worth stating, because each of these is a thing a wrapper drifts into:

- **Not a general browser.** Even after the viewer lands: no address bar, no
  tabs, no extensions. It opens scrapbooks and nothing else.
- **Not a second UI for authoring.** The sidebar, the menu, the editing and the
  switcher all already exist as web surfaces. The app frames them; it never
  reimplements them.
- **Not required.** The CLI keeps working with no app installed, and
  `sbk start` keeps its own always-on mode for anyone who prefers it.
- **Not a file manager.** It manages which folders are scrapbooks. It does not
  browse inside them.

## 3. What "managing" means, concretely

Every one of these lands in the kernel first, as a command, and the app calls
it. The CLI never falls behind the window, and the window has no logic of its
own to get out of step.

| Action | What it does | Command behind it |
|---|---|---|
| **New scrapbook** | Pick a folder, set it up with the kit, start serving it | `sbk init` |
| **Use a folder I have** | Pick a folder, serve it exactly as it is, add nothing | `sbk add` |
| **Move** | Move the folder somewhere else and keep serving it | `sbk move` (new) |
| **It already moved** | Point at where the folder went, without touching it | `sbk relocate` (new) |
| **Rename** | Change the name shown in the menu and in the address | `sbk rename` (new) |
| **Stop serving** | Forget it. Nothing on disk changes | `sbk forget` |
| **Open in browser** | Open its address in the default browser | none, a link |
| **Show in Finder** | Reveal the folder | none, the platform |

**Deleting a scrapbook is not on this list, on purpose.** Stop serving is
reversible and touches nothing. Deleting someone's folder of documents from a
list of otherwise harmless buttons is how work gets lost. If it is ever added,
it asks properly, in its own words, and it is not next to Rename.

**Move needs care.** Moving a folder that is inside a git repository, or that
something else has open, is a real operation with real ways to go wrong. The
rules: refuse if the destination exists, move then update the registry (never
the reverse, so a failed move leaves a correct registry), and refuse outright
if the folder is a git repository root, where moving it is the user's call to
make in their own tools.

## 4. The address, answered properly

Ishai asked whether the address can be nicer than `localhost:4321`. Three
separate questions hide inside that, with different answers.

**Can it be a name instead of `localhost`?** Yes, today, with no setup at all.
Every browser resolves anything ending in `.localhost` to this machine, so
`http://scrapbook.localhost:4321/` already works. That is a standard, not a
trick, and it needs no entry in `/etc/hosts` and no password.

**Can each scrapbook have its own name?** Yes, and this is the change worth
making. Right now each workspace gets its own port, so the reference notebook
is `:4321` and the next one is `:4322`. Numbers are the worst possible name.
Instead, serve every workspace on **one** port and route on the hostname:

| Now | After |
|---|---|
| `localhost:4321` | `notebook.localhost:4321` |
| `localhost:4322` | `home.localhost:4321` |
| `localhost:4323` | `client-work.localhost:4321` |

Adding a scrapbook stops consuming a port, an address says which scrapbook it
is, and a bare `localhost:4321` lands on the switcher. It also gives Rename
something real to change.

**Can the `:4321` go away?** Only with a password, once. Ports below 1024 are
privileged on macOS and nothing about being an app changes that. The honest
options are a one-time `pfctl` rule forwarding 80 to 4321, or a root-level
service, and the second contradicts the whole point of the app being the
switch. **Recommendation: keep the port.** `notebook.localhost:4321` is a good
address. If it grates later, the `pfctl` rule is a documented opt-in, never
something an installer does behind anyone's back.

## 5. The decisions, and why

### 5.1 Electron, not a native wrapper

A Mac-native shell (Swift plus `WKWebView`) would be a tenth of the size and
would feel more at home. It loses on the one thing this app is for.

The requirement is that the app running *is* the service running. In Electron
the servers run inside the app's own process, using the same `src/serve.js`
that runs today: the app cannot be running without them, and quitting cannot
leave them behind, because they are the same process. A native shell has to
launch `node` as a child, supervise it, and clean up after crash, force quit
and log out. That is three failure modes bought in exchange for disk space.

This holds even though the first version has no webview in it. The app is an
HTML control panel around a Node process, which is exactly Electron's shape.

### 5.2 The CLI must not grow a dependency

`scrapbook-hub` has no dependencies today and that should survive this. The app
is its own package in the repo and depends on the kernel; the kernel never
depends on the app. `npm install -g scrapbook-hub` keeps installing a few files
of JavaScript and nothing else.

### 5.3 Attach if something is already serving

The app and `sbk start`'s always-on agent cannot both own the port. Rather than
making that an error, the app checks on launch:

- **Nothing answering:** start the server in-process. Quitting stops it. This
  is the normal case and the one Ishai described.
- **Something already answering:** attach to it, list the scrapbooks, and say
  so plainly in the window. Quitting leaves it running, because the app did not
  start it and should not stop it.

This removes a whole class of "why are there two of these" confusion, and
`sbk status` should say which one is serving.

### 5.4 The window is small

A list of scrapbooks, each with its name, its address and a row of actions. A
button to add one. A line at the top saying whether it is serving and, when it
attached rather than started, that quitting will not stop it.

That is the whole window. It should fit in something like 480 by 600 and never
need to be maximised.

## 6. Build order

Each of these is separately useful and separately verifiable.

| | What | Why here |
|---|---|---|
| **A1** | One port, hostname routing, `.localhost` addresses, `slug` in the registry | **Done 2026-08-31.** Independent of the app, better the day it lands, and it is the answer to the address question |
| **A2** | `sbk move`, `sbk relocate`, `sbk rename` in the kernel | The app calls these; the CLI should have them first and they are testable without a window |
| **A3** | The Electron control panel: the list, the actions, in-process server, quit stops serving, attach if already running | The thing itself |
| **A4** | A real `.app` in Applications, with a Dock icon and a name | What makes it feel installed rather than run |
| **A5** | Viewing inside the app, and the switcher | The part Ishai says is not urgent, and the browser covers until then |

**A1 first, on its own.** It stands alone, it improves the browser experience
immediately, and it means everything after is built against the addressing
scheme that is staying rather than the one being replaced.

### A1, in detail

- The registry keeps a `slug` per workspace instead of a port. `notebook`,
  `home`. The slug is what appears in the address, and Rename changes it.
- One server on 4321. Every request is dispatched on the `Host` header's first
  label. An unknown host, or a bare `localhost`, serves the switcher.
- **Changed while building:** rather than keeping the old per-workspace ports
  alive to redirect, a bare `localhost:4321` serves the first workspace. That
  keeps every existing address working with no redirect machinery at all, and
  the switcher stays where it already was, at `/_hub`.
- The switcher's links become names instead of ports.

## 7. Risks and costs, with eyes open

- **150MB, from zero.** Electron is heavier than everything else in this repo
  combined. The mitigation is that it is optional and isolated, not that it is
  small.
- **An unsigned app gets a Gatekeeper warning.** For Ishai's own machine that
  is a right-click-open, once. Handing it to a stranger properly needs an Apple
  Developer account at 99 dollars a year and notarisation in CI. That decision
  belongs with the decision to distribute, not with building it.
- **A control panel invites scope creep** toward being a file manager, and a
  wrapper invites it toward being a browser. Section 2 exists to be re-read
  when that happens.
- **Two ways to run it is a support question.** The attach behaviour in 5.3
  keeps it from being a broken state, but "is it the app or the agent" will be
  the first question on any issue.
- **Move is the one destructive-adjacent action here.** The rules in section 3
  matter more than the button does.

## 8. What is needed from Ishai

- **An icon.** He is the designer, and a Dock icon is the whole visual identity
  of the thing. A placeholder can ship for A3; A4 should not.
- **A call on the port.** The recommendation is to keep `:4321`. If he wants it
  gone, that is a one-time password prompt and a documented rule.
- **A call on Move.** Whether the app should actually move folders, or only
  follow a folder he moved himself in Finder. The second is strictly safer and
  probably enough.
