# tihlde-wrapped — feature rules

Applies to the `tihlde-wrapped` feature and every branch built for it.
This file never reaches `main`: the lead dev drops it when the feature lands.

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
- Pull requests always go **into `tihlde-wrapped`**, never into `main`. They are squash-merged,
  so each PR becomes one commit on `tihlde-wrapped`.
- A piece too big for one reviewable PR can be split into a stack of PRs based on `tihlde-wrapped`
  with `gh stack` (<https://docs.github.com/en/pull-requests/how-tos/stacked-pull-requests>).
- CI (`ci.yml`) only runs on PRs into `main`. Run `bun run typecheck`, `bun run lint`,
  `bun run format` and the relevant tests locally before opening a PR into `tihlde-wrapped`.
- Only the lead dev updates `tihlde-wrapped` from `main`, by merge — never rebase or force-push
  the shared branch.

### How the feature lands in `main`

When the feature is done, the lead dev turns `tihlde-wrapped` into a **GitHub stacked PR** into
`main`: a chain of small PRs, each a run of consecutive commits from `tihlde-wrapped`, reviewed and
merged bottom-up. That is why:

- **One concern per PR, ~400 changed lines max** (excluding generated migrations and `bun.lock`) —
  each PR should be able to become (part of) one reviewable layer.
- **Merge order matters.** Layers follow the order commits landed on `tihlde-wrapped`, so merge
  foundations first: schema/migrations → API → kvark → polish.
- **Land fix-ups quickly** — a fix merged much later leaves an earlier layer broken during review.
- **Keep Drizzle migrations in as few PRs as possible** — migration numbers collide when the stack
  is rebased onto `main`.
- **Every commit must build on its own**, because every layer runs CI against `main` at landing.

```shell
gh extension install github/gh-stack                        # once, needs gh >= 2.90
git switch tihlde-wrapped && git pull                       # start from the latest integration branch
git switch -c tihlde-wrapped-<topic>                        # one branch per piece of work
gh pr create --base tihlde-wrapped                          # PR into tihlde-wrapped, never main

gh stack init --base tihlde-wrapped tihlde-wrapped-<topic>  # only if the piece needs splitting
gh stack add tihlde-wrapped-<next-topic>                    # next layer
gh stack submit                                             # push and open the PRs
gh stack sync                                               # after tihlde-wrapped moves or a PR merges
gh stack checkout <pr-number>                               # pick up a teammate's stack
```

- Restack your own branches with `gh stack sync` / `gh stack rebase`, not plain `git rebase` +
  `git push --force` — that breaks every layer above.
- All branches live in `TIHLDE/Photon`; stacks can't cross forks.

Before working on this feature: check the current branch, never commit to `tihlde-wrapped` itself,
and create a `tihlde-wrapped-<topic>` branch for the work.
