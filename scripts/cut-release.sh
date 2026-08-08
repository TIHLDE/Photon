#!/usr/bin/env bash
#
# Lager og pusher en release-tag på main. Taggen trigger build -> push -> deploy
# (.github/workflows/deploy.yml) og publiserer en GitHub Release med changelog.
#
# Tag-format: <YYYY-MM-DD>.release-<n>, f.eks. 2026-08-08.release-1
#
#   bun run cut-release           # lag neste tag på HEAD av origin/main
#   bun run cut-release --dry-run # vis hva som ville skjedd
#
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

die() {
    echo "feil: $*" >&2
    exit 1
}

command -v gh >/dev/null || die "gh (GitHub CLI) må være installert"

echo "Henter fra origin..."
git fetch origin --tags --quiet

# --- Sjekker -----------------------------------------------------------------

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "$BRANCH" == "main" ]] || die "du står på '$BRANCH' — releases tagges fra main"

[[ -z "$(git status --porcelain)" ]] || die "arbeidstreet er ikke rent — commit eller stash først"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[[ "$LOCAL" == "$REMOTE" ]] || die "main er ikke i synk med origin/main — kjør 'git pull' først"

# Ikke tagg en commit CI ikke har godkjent.
CI_STATUS=$(gh run list --commit "$LOCAL" --workflow "CI/CD" --limit 1 --json conclusion --jq '.[0].conclusion // "mangler"')
if [[ "$CI_STATUS" != "success" ]]; then
    echo "advarsel: CI for $(git rev-parse --short HEAD) er '$CI_STATUS', ikke 'success'." >&2
    read -r -p "Tagge likevel? [y/N] " svar
    [[ "$svar" == "y" || "$svar" == "Y" ]] || die "avbrutt"
fi

# --- Regn ut neste tag -------------------------------------------------------

DATE=$(date +%F)
# Numerisk sortering, ikke leksikografisk — ellers blir release-10 < release-2.
LAST=$(git tag --list "${DATE}.release-*" | sed "s/^${DATE}\.release-//" | sort -n | tail -1)
NEXT=$((${LAST:-0} + 1))
TAG="${DATE}.release-${NEXT}"

git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null && die "taggen ${TAG} finnes allerede"

# --- Vis hva som slippes -----------------------------------------------------

PREV_TAG=$(git tag --list '*.release-*' --sort=-creatordate | head -1)
echo
echo "Release:  ${TAG}"
echo "Commit:   $(git rev-parse --short HEAD)"
if [[ -n "$PREV_TAG" ]]; then
    COUNT=$(git rev-list --count "${PREV_TAG}..HEAD")
    echo "Siden:    ${PREV_TAG} (${COUNT} commits)"
    echo
    git log --format='  %h %s' "${PREV_TAG}..HEAD"
else
    echo "Siden:    (første release)"
fi
echo

if [[ "$DRY_RUN" == true ]]; then
    echo "--dry-run: ingenting ble tagget eller pushet."
    exit 0
fi

read -r -p "Dette deployer til prod. Fortsette? [y/N] " svar
[[ "$svar" == "y" || "$svar" == "Y" ]] || die "avbrutt"

# --- Tagg og push ------------------------------------------------------------

git tag -a "$TAG" -m "Release ${TAG}"
git push origin "$TAG"

echo
echo "Pushet ${TAG}. Følg deployet med:"
echo "  gh run list --limit 3"
