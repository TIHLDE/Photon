# tihlde-wrapped — feature rules

Applies to the `tihlde-wrapped` feature and every branch built for it.
Delete this file once the feature is fully merged into `main`.

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

## Stacked pull requests

The feature never lands as one large PR. It ships as a stack of small PRs via `gh stack`
(<https://docs.github.com/en/pull-requests/how-tos/stacked-pull-requests>), each a discrete,
reviewable change targeting the branch below it. The bottom one targets `main`.

- `tihlde-wrapped` is the bottom layer: foundations (schema, migrations, shared types).
  Higher layers depend on lower ones, never the reverse: API → kvark → tests/polish.
- Start a new layer when switching concern, or when a PR passes ~400 changed lines
  (excluding generated migrations and `bun.lock`).
- Name layers `tihlde-wrapped-<topic>`, not `tihlde-wrapped/<topic>` — git can't hold both
  a branch `x` and `x/y`.
- Each merged layer ships with the next release tag, so nothing half-wired may be reachable by users.

```shell
gh extension install github/gh-stack   # once, needs gh >= 2.90
gh stack checkout <pr-number>          # pick up the stack locally
gh stack view                          # where am I
gh stack add tihlde-wrapped-<topic>    # new layer on top of the current one
gh stack submit                        # push all layers, create/update linked PRs
gh stack sync                          # after main moves or a layer merges
```

- Restack with `gh stack rebase` / `gh stack sync`. Never plain `git rebase` or `git push --force`
  on a single layer — it breaks every layer above it.
- All branches live in `TIHLDE/Photon`; stacks can't cross forks.
- Merge bottom-up. After a lower PR merges, the next one retargets `main` automatically.
  Squash merging works; auto-merge is not supported for stacks.

Before working on this feature: run `gh stack view`, put the change in the right layer, and
propose a new layer instead of growing one past the size target.
