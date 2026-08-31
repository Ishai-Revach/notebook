# Contributing

Thanks for looking. This is early: the daily loop works, the shape is still moving.

## Running it

```
git clone https://github.com/Ishai-Revach/scrapbook.git
cd scrapbook
node bin/sbk.js init ~/somewhere/to/try
node bin/sbk.js serve ~/somewhere/to/try
```

No install step, no build step, no dependencies. Node 20 or newer.

## Tests

```
node --test
```

Plain `node:test`, no framework. Every non-trivial piece leaves one runnable
check behind: the smallest thing that fails if the logic breaks. If you are
adding a branch, a parser or anything touching a file on disk, add the check
with it.

## What this project cares about

- **A document is a single html file.** No database, no block model, no build
  step. This is what lets a document be anything, and it is not negotiable.
- **The kit is public API.** Anything a user might edit has a contract. Keep it
  small: every file exposed is a promise.
- **Verify by looking.** Run it, open it, look at the page. Two of the bugs in
  the history here were invisible in the code and obvious on screen.
- **The laziest thing that works.** Reach for the standard library, then the
  platform, then a few lines. `sbk update` is a three-way merge because git
  ships one, not because a merge was written here.

## Style

- No em-dashes, en-dashes or arrow characters, anywhere, including comments and
  commit messages. Use a comma, a semicolon, a period or parentheses.
- Comments say why, not what. If a shortcut has a known ceiling, say where it
  is and what would replace it.
- Commits are scoped and staged by path, one restore point each.

## Reporting something

Say what you did, what you expected and what happened. If it involves a page,
the page's html is usually the whole bug report.
