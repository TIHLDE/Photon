# Ekstern påmelding

Status: **utkast, ingen kode skrevet.** Dokumentet er beslutningsgrunnlaget, ikke en implementasjon.

La folk uten TIHLDE-bruker melde seg på arrangementer, med egen kvote og egen pris. I dag går dette via Google Forms, så allergier og påmeldinger for eksterne havner aldri i Photon.

## Kort fortalt

Eksterne får **ikke** en konto. De fyller ut et offentlig skjema, bekrefter e-posten med en lenke, og den lenka er deres side for arrangementet: der betaler de, oppdaterer allergier og melder seg av.

De konkurrerer aldri med medlemmene om plassene — arrangøren setter et eget antall eksterne plasser, med egen venteliste. Prisen er egen og uavhengig av medlemsprisen, så et arrangement kan være gratis for medlemmer og koste 300 kroner for eksterne uten at medlemmenes prikke- og avmeldingsregler endrer seg.

Eksterne har sin egen frist, som er både siste påmelding og siste betaling. Ingen kastes av automatisk når den ryker — de flagges for arrangøren, som kan purre eller rydde manuelt.

## Beslutninger

1. **Egen tabell `event_external_registration`, ingen rad i `user`.** Snudd underveis: ekte brukerrader ga ni gates, hvorav to var sikkerhetshull (se fallgruver). Gjenbruksgevinsten forsvant uansett da kvote, pris og e-post ble egne.
2. **Signert token-lenke per påmelding, ingen sesjon.** Lenka er et permanent håndtak på raden, ikke en innlogging. «Send meg lenka på nytt» svarer identisk uansett om adressen finnes.
3. **Plassen teller først når bekreftelseslenka klikkes.** Raden er `unconfirmed` og holder ingenting, så falske adresser kan ikke spise kvota.
4. **Alltid egen kvote og egen venteliste.** Aldri delt pott. Ingen bytte krysser grensen, så `findSwapTarget` trenger ikke røres.
5. **Utad vises bare «det er plass» eller «du havner på venteliste».** Aldri kapasitet, ventelistelengde eller posisjon.
6. **`externalPriceMinor` er uavhengig av `isPaidEvent`.** Nødvendig, fordi `isPaidEvent` river ut `canCauseStrikes` og `cancellationDeadline` for hele arrangementet.
7. **Én ekstern-innstilling per arrangement, ingen billettyper.** De to tilfellene (student fra annen linjeforening, og ikke-student) skiller seg bare på pris og på om linjeforening er relevant.
8. **`event_payment` utvides:** `user_id` blir nullable, ny `external_registration_id`, CHECK på nøyaktig én. Webhook, capture, refusjon og fristtimere leser raden og virker uendret.
9. **Én frist som er både påmeldings- og betalingsfrist,** uavhengig av medlemmenes `registration_end`. Bekreftelseslenka må også klikkes innen den.
10. **Ubetalt ved fristen flagges, ingen kastes av.** `event_payment` har allerede `flag` og `flagged_at`.
11. **Opprykk får sin egen 48-timersfrist,** uansett når det skjer — også etter hovedfristen. Kappes ved arrangementsstart. Mekanikken finnes: `paymentDeadline(48 * 60, event.startDate)`.
12. **Avmelding: ubetalt fritt via token-lenka, betalt aldri.** Samme regel som medlemmer. Refusjon forblir manuell.
13. **Skjemafelter:** navn, e-post, allergier, godtar arrangementsregler, kort fritekst «linjeforening». Ikke kjønn, ikke telefon.
14. **E-postkollisjon lekker aldri om adressen finnes.** Tilhører den et medlem, får hen en e-post om å logge inn og melde seg på som medlem i stedet.
15. **Knappen vises kun for uinnloggede, og krever `visibility = 'public'`.** Hindrer at medlemmer omgår prikker, evalueringskrav og medlemspris.
16. **Anonymiser automatisk 30 dager etter arrangementet.** Navn, e-post, allergier og linjeforening nulles; status, beløp og betalingsreferanse består. Allergier er helseopplysninger.
17. **Egen «Eksterne»-fane i admin, men allergifanen fletter begge kilder** med tydelig ekstern-merking. Ingen nye tilganger — `events:update`, `events:registrations:view`, `events:registrations:manage`, `events:payments:refund` dekker alt.
18. **Eksterne er usynlige for alle som ikke er arrangør.** Teller ikke i offentlig deltakertall, står ikke i deltakerlista.
19. **Eksterne krysses inn som `attended`, men får aldri prikker.** Ingen `no_show`-status: den finnes kun for å utløse prikker. No-show-jobben må hoppe over eksterne.
20. **Arrangementer med betalinger kan ikke slettes.** Lukker et hull som allerede står åpent for medlemmer.

## Skjemaendringer

### `event` (endres)

| Kolonne | Beskrivelse |
| --- | --- |
| `allows_external_registration` | boolean, default false. Krever `visibility = 'public'`. |
| `external_capacity` | integer. Påkrevd når ekstern påmelding er på. |
| `external_price_minor` | integer, nullable. Øre. Uavhengig av `is_paid_event`. NULL = gratis. |
| `external_deadline` | timestamp, nullable. Både siste påmelding og siste betaling. Erstatter `registration_end` for eksterne. |
| `external_asks_organisation` | boolean. Om skjemaet spør om linjeforening. |

### `event_external_registration` (ny)

| Kolonne | Beskrivelse |
| --- | --- |
| `id` | uuid, PK |
| `event_id` | FK → `event`, ON DELETE CASCADE |
| `name`, `email` | E-post lagres normalisert til små bokstaver, unik per arrangement blant ikke-kansellerte |
| `organisation` | Kort fritekst, linjeforening, nullable |
| `status` | `unconfirmed` · `registered` · `waitlisted` · `cancelled` · `attended` |
| `waitlist_position` | integer, nullable. Beregnes, men vises aldri utad |
| `token_hash` | Hash av token-lenka. Aldri klartekst |
| `confirmed_at` | Når lenka ble klikket. Køen sorterer på denne |
| `accepted_event_rules_at` | Samme krav som medlemmer |
| `custom_allergies` | text[] |
| `anonymized_at` | Settes av cron 30 dager etter arrangementet |

### `event_external_registration_allergy` (ny)

FK til `event_external_registration` og til `allergy`. Samme katalog som medlemmene velger fra, så arrangørens oversikt kan slå sammen på etikett.

### `event_payment` (endres)

`user_id` blir nullable, ny nullable `external_registration_id`, og `CHECK (num_nonnulls(user_id, external_registration_id) = 1)`.

## Fallgruver i eksisterende kode

Disse formet beslutningene og må håndteres under implementasjon.

**En brukerrad uten passord er ikke passordløs.** `POST /forget-password` slår kun opp på e-post uten å sjekke om brukeren har en credential-konto. `POST /reset-password` oppretter credential-raden hvis den mangler. `onPasswordReset` setter `emailVerified = true`. `assertApproved` avviser bare `approvalStatus === "pending"`, og en ekstern ville hatt `null`. Kjeden ender i en full medlemssesjon, og uten medlemskapsgate på `/oauth2/authorize` blir den også innlogging i Proton og KontRes. Dette er grunnen til beslutning 1.

**`isPaidEvent` er ikke bare «koster penger».** Den blokkerer `canCauseStrikes` (`routes/event/schema.ts:254`), blokkerer `cancellationDeadline` (`:262`) og nekter avmelding av betalt plass (`routes/event/registration/delete.ts:55`).

**Prioriterte medlemmer kaster ut betalte plasser.** `findSwapTarget` demoterer en uprioritert påmeldt til venteliste selv etter betaling (`lib/event/resolve-registration.ts:210`); betalingen beholdes og må refunderes manuelt.

**Betalingsfristen har kostet plasser før.** Den var en kolonne per arrangement, og `0` skrudde den av — slik endte begge betalte arrangementer i produksjon med å dele ut plasser ingen måtte betale for (`lib/event/payment.ts:20`). Ekstern-fristen må derfor være en dato med et flagg i andre enden, ikke en av-knapp.

**`reverseEventPayment` ryker på NULL.** Den avslutter med `sendNotification({ userId: payment.userId })` (`lib/event/payment.ts:399`). Når `user_id` blir nullable trengs en ekstern-gren som sender direkte til e-postadressen. Samme gjelder `buildPaymentDescription`, som leser `user.name`.

**Sletteknappen tømmer betalingshistorikken.** `event_payment.event_id` er ON DELETE CASCADE (`packages/db/src/schema/event.ts:316`) og sletteruta gjør en rå `tx.delete(schema.event)` (`routes/event/delete.ts:53`). Gjelder allerede medlemmer i dag.

## Byggerekkefølge

Hvert steg er testbart før neste begynner.

- [ ] **1 · Skjema og migrasjon.** De fem kolonnene på `event`, de to nye tabellene, endringen på `event_payment` med CHECK-en. Ingen atferd.
- [ ] **2 · Sletteblokkeringen.** Beslutning 20. Står alene, gjelder eksisterende medlemsbetalinger, kan lande som egen PR.
- [ ] **3 · Skjema, token og bekreftelse.** Offentlig påmeldingsrute med throttle, e-post med token-lenke, «Min påmelding»-side, «send lenka på nytt». Gratis arrangementer virker fullt ut etter dette.
- [ ] **4 · Ekstern kø og venteliste.** Resolver for `external_capacity`, ventelisteposisjoner, 48-timers opprykk.
- [ ] **5 · Betaling.** Ekstern-gren i `createPaymentObligation`, `reverseEventPayment` og `buildPaymentDescription`, flagging ved fristen.
- [ ] **6 · Admin og anonymisering.** «Eksterne»-fanen, fletting i allergifanen, innsjekk, cron som anonymiserer etter 30 dager.

## Gjenbrukbare mønstre

- **Throttle på offentlig rute:** `routes/account-link/help.ts:17` — Redis-nøkkel på `x-forwarded-for` med e-post som fallback, 3 forsøk per time.
- **Frist kappet ved arrangementsstart:** `paymentDeadline(graceMinutes, eventStart)` i `lib/event/payment.ts:118`.
- **Flagging av betaling til arrangør:** `notifyOrganizersOfPaymentsWithoutSpot` i `lib/event/payment-review.ts`.
