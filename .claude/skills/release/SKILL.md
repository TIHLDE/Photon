---
name: release
description: Slipp en ny prod-release av Photon ved å lage en datobasert release-tag på main. Bruk når noen sier "release", "slipp ny versjon", "deploy til prod", "ship dette", "lag en tag" eller ber om å få dagens main ut i produksjon. Dekker også hvordan man ruller tilbake til en tidligere release.
---

# Release (tag-basert)

Photon har **én branch: `main`**. Ingen dev-branch, ingen merge-strategi å huske. En release er en tag.

- Alt arbeid: feature-branch → PR → `main`. CI kjører på PR-en.
- En release: en tag på `main` med formatet `<YYYY-MM-DD>.release-<n>` (f.eks. `2026-08-08.release-1`, `2026-08-08.release-2`, `2026-08-09.release-1`).
- Taggen — ikke push til main — trigger [deploy.yml](.github/workflows/deploy.yml): bygg → push til GHCR → varsle Drift → publiser GitHub Release med generert changelog.
- Imaget tagges med release-taggen i tillegg til `latest` og sha, så Drift kan bruke den som markør på containeren.

## Slippe en release

Kjør skriptet — ikke lag taggen for hånd:

```bash
bun run cut-release
```

Det gjør alle sjekkene selv: at du står på `main`, at treet er rent, at `main` er i synk med `origin/main`, og at CI faktisk er grønn på commiten som tagges. Det regner ut neste nummer for dagen, viser hvilke commits som slippes siden forrige release, og spør før det pusher.

For å se hva som ville skjedd uten å slippe noe:

```bash
bun run cut-release --dry-run
```

Etterpå: følg kjøringen og **rapporter faktisk status**, ikke bare «deployet».

```bash
gh run list --limit 3
```

## Ting å ikke gjøre

- **Ikke lag taggen manuelt** med `git tag`. Skriptet finnes fordi sjekkene (CI grønn, i synk med origin, riktig nummer) er lette å glemme, og en feil tag deployer rett i prod.
- **Ikke gjenbruk eller flytt en tag.** En release-tag er en uforanderlig markør — Drift peker på den. Trenger du å fikse noe, lag en ny tag.
- **Ikke gjenopprett en `dev`-branch.** Den ble bevisst fjernet: dobbel CI-venting (~20 min i stedet for ~10) og en merge-strategi nye i Index måtte lære. Kommer det en «vi burde ha en staging-branch»-diskusjon, er det en egen avgjørelse — ikke noe man gjør i forbifarten.

## Rulle tilbake

Ingen revert-commit nødvendig — Drift kan peke på et tidligere image, siden hver release har sin egen docker-tag.

```bash
git tag --list '*.release-*' --sort=-creatordate | head -5
```

Finn taggen som var grønn, og be Drift deploye `ghcr.io/tihlde/photon:<tag>`. Er problemet i koden, fiks det på `main` som vanlig via PR og slipp en ny release oppå.

### Rollback uten Drift-tilgang

Å be Drift om et bestemt image krever `DEPLOY_RECEIVER_TOKEN`, som ligger som GitHub-secret. Har du bare `gh`, gjør dette samme jobben — `deploy.yml` har `workflow_dispatch`, og bygget følger ref-en du oppgir:

```bash
gh workflow run deploy.yml --ref <forrige-grønne-tag>
```

Det bygger den gamle commiten på nytt, gjør `latest` til den koden, og notify-steget får verten til å hente den. Bygget tar typisk under et minutt siden lagene allerede ligger i cache fra da taggen ble sluppet.

To ting å vite:

- **`latest` peker nå på den gamle releasen.** Neste `cut-release` overskriver det som normalt, men deployer noen «latest» i mellomtiden, får de den gamle koden.
- **Migrasjoner rulles ikke tilbake.** Basen blir stående på den nye releasens skjema mens koden er den gamle. Additive endringer (nye indekser, nye nullbare kolonner) er trygge — den gamle koden bryr seg ikke om at de finnes. En migrasjon som fjerner eller endrer noe den gamle koden leser, er det ikke: da må du fram, ikke tilbake.

**Restart før rollback, for å skille de to feilene.** Kjør `gh run rerun --job <deploy-job-id>` på den siste deploy-kjøringen først — det sender samme image ut på nytt. Kommer den opp, var det en hengende container; er den nede fortsatt et par minutter etter, ligger feilen i koden og rollback er riktig medisin. Jobb-ID-en finner du med `gh run view <run-id> --json jobs -q '.jobs[] | "\(.databaseId) \(.name)"'`.

## Hvis noe skurrer

- **Taggen ble pushet, men ingen deploy startet.** Sjekk at taggen matcher glob-en i [deploy.yml](.github/workflows/deploy.yml) (`[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].release-*`). En tag som `v1.2.3` trigger ingenting.
- **Release-noten mangler.** `release_notes`-jobben krever at taggen finnes på remote (`--verify-tag`). Se jobbloggen i kjøringen.
- **Docker-imaget mangler release-taggen.** Da er `extra_tags`-inputen i `TIHLDE/tihlde-workflows` sin `_ci_ghcr.yml` borte eller endret — den er forutsetningen for at Drift får markøren sin.
