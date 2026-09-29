# tihlde-wrapped — feature rules

Applies to the `tihlde-wrapped` feature and every branch built for it.
Delete this file in the final `tihlde-wrapped` → `main` pull request.

## The feature

A digital disposable camera per TIHLDE arrangement (event), like the POV app: attendees take a
limited number of photos, upload them, and the photos become accessible after the event.

**Nothing is decided yet** — shots per person, how/when photos are revealed, storage and systems.
Don't assume any of it; ask the team before building on a guess.

Inspiration: POV, Party!, Lense, Scene, Pix Wedding.

Existing building blocks worth checking before writing anything new:

- Asset upload/download: `apps/api/src/routes/asset/`, `apps/api/src/lib/storage/`, `apps/api/src/lib/asset/image.ts`
- Galleries with pictures: `apps/api/src/routes/gallery/`
- Events and registration: `apps/api/src/routes/event/`
- Client-side image helpers: `packages/ui/src/lib/heic.ts`, `packages/ui/src/lib/image-compression.ts`

## Quality

Everything reaching `main` is reviewed against the root `CLAUDE.md` and `apps/kvark/CLAUDE.md`.
Never hardcode UI: use the `@tihlde/ui` component (`Button`, `Card`, ...). If the feature genuinely
needs a new primitive, add it to `@tihlde/ui`, not to the app.

## Branching and pull requests

`tihlde-wrapped` is the feature's integration branch. Nobody commits to it directly.

- Every new piece of work gets its own branch off `tihlde-wrapped`, named
  `tihlde-wrapped-<topic>` (not `tihlde-wrapped/<topic>` — git can't hold both a branch `x` and `x/y`).
- Pull requests always go **into `tihlde-wrapped`**, never into `main`. They are squash-merged.
- Keep PRs small: split anything past ~400 changed lines (excluding generated migrations and
  `bun.lock`) into a stack of PRs with `gh stack`
  (<https://docs.github.com/en/pull-requests/how-tos/stacked-pull-requests>), based on `tihlde-wrapped`.
- CI (`ci.yml`) only runs on PRs into `main`. Run `bun run typecheck`, `bun run lint`,
  `bun run format` and the relevant tests locally before opening a PR into `tihlde-wrapped`.
- Only the lead dev updates `tihlde-wrapped` from `main`, by merge — never rebase or force-push
  the shared branch.
- When the feature is done, `tihlde-wrapped` goes to `main` in one PR. Every commit in it is an
  already-reviewed, squashed PR, so it can be reviewed commit by commit.

```shell
gh extension install github/gh-stack                      # once, needs gh >= 2.90
git switch tihlde-wrapped && git pull                     # start from the latest integration branch
gh stack init --base tihlde-wrapped tihlde-wrapped-<topic>  # new branch based on tihlde-wrapped
gh stack add tihlde-wrapped-<next-topic>                  # optional: next layer when the PR grows too big
gh stack submit                                           # push and open PR(s) into tihlde-wrapped
gh stack sync                                             # after tihlde-wrapped moves or a PR merges
gh stack checkout <pr-number>                             # pick up a teammate's branch or stack
```

- Restack your own branches with `gh stack sync` / `gh stack rebase`, not plain `git rebase` +
  `git push --force` — that breaks every layer above.
- All branches live in `TIHLDE/Photon`; stacks can't cross forks.

Before working on this feature: check the current branch, never commit to `tihlde-wrapped` itself,
and create a `tihlde-wrapped-<topic>` branch for the work.
