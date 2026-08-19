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

Det sjekker at du står på `main`, at treet er rent, og at `main` er i synk med `origin/main`. Det regner ut neste nummer for dagen, viser hvilke commits som slippes siden forrige release, og spør før det pusher.

**Skriptet sjekker ikke CI.** Det må du gjøre selv før du tagger. Merge-commiten på `main` har typisk fortsatt testene kjørende i flere minutter etter at PR-en gikk inn, og det er den commiten taggen peker på:

```bash
gh api "repos/TIHLDE/Photon/commits/<sha>/check-runs" \
  --jq '[.check_runs[] | "\(.name): \(.conclusion // .status)"] | join("\n")'
```

For å se hva som ville skjedd uten å slippe noe:

```bash
bun run cut-release --dry-run
```

Etterpå: følg kjøringen og **rapporter faktisk status**, ikke bare «deployet».

```bash
gh run list --limit 3
```

### «Deploy: success» betyr ikke at migrasjonen har kjørt

`deploy.yml` har tre jobber — `build`, `release_notes`, `notify` — og ingen av dem rører databasen. Migrasjonen ligger i containerens entrypoint:

```
ENTRYPOINT ["sh", "-c", "bun run ./apps/api/dist/migrate.js && bun run ./apps/api/dist/index.js"]
```

Skjemaet endrer seg altså først når Drift har byttet container, som er minutter etter at workflowen melder `success`. Venter du på en migrasjon, poll databasen — ikke workflowen. Og `drizzle-kit migrate` velger på journal-tidsstempel, ikke på hash — den kan melde «applied successfully» uten å ha kjørt noe. Verifiser mot databasen, ikke mot loggen.

Rekkefølgen i entrypointet er det som gjør skjemaendringer trygge: migrasjonen er ferdig før ny kode svarer på en eneste forespørsel. Et skript som må kjøre *etter* en migrasjon — en backfill som skriver en ny enum-verdi, for eksempel — kan derfor ikke kjøres før ny container faktisk har startet.

## Ting å ikke gjøre

- **Ikke lag taggen manuelt** med `git tag`. Skriptet finnes fordi sjekkene (i synk med origin, rent tre, riktig nummer for dagen) er lette å glemme, og en feil tag deployer rett i prod.
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
