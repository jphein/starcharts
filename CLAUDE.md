# Starcharts — Claude guidance

## Start of every session

Before doing any work the user requests, always run:

```bash
git fetch origin main && git log --oneline origin/main | head -10
```

Compare what you see against what you last worked on. Other contributors
push to main between sessions, so files you remember may have changed.
If main has new commits, read the relevant changed files before
proceeding — never assume your in-memory knowledge of the codebase
is current.

## Branch strategy

- All development happens on feature branches off `main`.
- Default branch for this assistant: `claude/streamline-login-flow-q5360`
- Always push to that branch and open a PR against `main`; squash-merge when ready.
- After merging a PR, pull `origin/main` before starting new work.

## Merge hygiene

- After every squash-merge, do a `git fetch origin main` and verify the
  merged file on main has no conflict markers before calling the task done:
  ```bash
  git show origin/main:path/to/file | grep -c "<<<<<<<"
  ```
  Zero output = clean.

## Key architecture notes

- **InstantDB** for realtime data; permission rules live in
  `app/src/instant.perms.ts` and must be pushed separately:
  ```bash
  cd app && npx instant-cli push perms -a e526d9cf-e783-4a99-b3b3-a69730ecdd7e
  ```
  (jphein has wired this into CI so it runs on every merge to main.)
- **Cloudflare Worker** handles invite-code joins and star-image generation;
  source in `worker/src/index.ts`.
- `newData.ref()` in InstantDB permission rules does **not** support link
  traversal — only plain attribute access like `newData.completedAt`.
  Using it with a link path causes a runtime "Could not evaluate permission
  rule" crash.
- Groups ↔ users is many-to-many (`groupMembers` link). The UI now
  supports switching groups via the dashboard group picker.
