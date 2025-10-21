# Photon

Ny backend for Kvark - en moderne, typesikker API-server bygget med TypeScript og Hono.

![Static Badge](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript)
![Static Badge](https://img.shields.io/badge/Framework-Hono-orange?logo=hono)
![Static Badge](https://img.shields.io/badge/Database-PostgreSQL-blue?logo=postgresql)

## 📖 Om prosjektet

Photon er en komplett backend-løsning for Kvark, bygget med fokus på ytelse, type-sikkerhet og utvikleropplevelse. Serveren tilbyr autentisering via Feide, hendelseshåndtering, betalingsintegrasjon med Vipps MobilePay, og mye mer.

## ✨ Hovedfunksjoner

- **🔐 Autentisering**: Better Auth med Feide OAuth2-integrasjon for norsk utdanningssektor
- **📅 Hendelseshåndtering**: Komplett API for arrangementer, påmelding og administrasjon
- **💳 Betalingsintegrasjon**: Vipps MobilePay-integrasjon med automatisk webhook-oppsett
- **📧 E-postsystem**: React Email-baserte maler med lokal forhåndsvisning
- **⚡ Jobbkø**: BullMQ med Redis for asynkron behandling
- **📊 OpenAPI-dokumentasjon**: Automatisk generert API-dokumentasjon med Scalar
- **🧪 Testing**: Vitest med Testcontainers for integrasjonstester

## 🛠️ Teknologistack

### Backend
- **Hono v4** - Minimalistisk og lynrask web-rammeverk
- **PostgreSQL 17** - Relasjonsdatabase
- **Drizzle ORM** - Type-sikker database-toolkit
- **Redis 7.4** - Cache og meldingskø
- **BullMQ** - Robust jobbkøhåndtering
- **Better Auth** - Moderne autentiseringsløsning
- **Zod v4** - Type-sikker validering

### Utviklingsverktøy
- **TypeScript 5.9** - Statisk typing
- **Biome** - Rask linting og formatering
- **Vitest** - Enhetstesting og integrasjonstesting
- **tsup** - Rask bundling med esbuild
- **pnpm** - Effektiv pakkebehandling
- **Docker Compose** - Lokal utviklingsmiljø

## 🚀 Kom i gang

### Forutsetninger

- **Node.js** ≥18
- **pnpm** ≥8.15.6
- **Docker** og **Docker Compose**

### Installasjon

1. **Klon repositoryet**
   ```bash
   git clone <repository-url>
   cd Photon
   ```

2. **Installer avhengigheter**
   ```bash
   pnpm install
   ```

3. **Konfigurer miljøvariabler**

   Kopier eksempelfilen og rediger verdiene:
   ```bash
   cp .env.example .env
   ```

   Nødvendige miljøvariabler:
   ```env
   # Database
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=password
   POSTGRES_DB=photon_db
   DATABASE_URL=postgresql://postgres:password@localhost:5432/photon_db

   # Feide OAuth
   FEIDE_CLIENT_ID=<din-feide-client-id>
   FEIDE_CLIENT_SECRET=<din-feide-client-secret>

   # Seeding (valgfritt)
   SEED_DB=true
   ```
4. **Start utviklingsmiljøet**
   ```bash
   pnpm docker:dev
   ```

   Dette starter automatisk:
   - PostgreSQL på port 5432
   - Redis på port 6379
   - Mailsink på port 1025

5. **Migrer databasen**
   ```bash
   pnpm db:push
   ```

   Dette dytter det nåværende skjemaet til databasen
  
6. **Kjør serveren**
   ```bash
   pnpm dev
   ```

   Dette starter:
   - API-server på `http://localhost:4000/api`
   - Epost-klient på `http://localhost:8025`

## 📦 Prosjektstruktur

```
Photon/
├── src/
│   ├── db/                  # Database-skjemaer og konfigurering
│   │   └── schema/          # Drizzle-skjemadefinisjoner
│   ├── lib/                 # Delte biblioteker og hjelpere
│   │   ├── auth/            # Autentiseringslogikk og RBAC
│   │   ├── cache/           # Redis cache-funksjoner
│   │   ├── email/           # E-postmaler og sending
│   │   └── event/           # Hendelseslogikk
│   ├── routes/              # API-ruter
│   │   └── event/           # Hendelsesrelaterte endpoints
│   ├── middleware/          # Hono-middleware
│   ├── test/                # Test-utilities og konfigurering
│   └── index.ts             # Hovedapplikasjonsfil
├── docker-compose.dev.yml   # Utviklingsmiljø
├── docker-compose.prod.yml  # Produksjonsmiljø
├── Dockerfile               # Container-definisjon
├── drizzle.config.ts        # Drizzle ORM-konfigurasjon
├── tsup.config.ts           # Build-konfigurasjon
└── vitest.config.ts         # Test-konfigurasjon
```

## 🎯 Utviklingskommandoer

### Generelt
```bash
# Start utviklingsserver (med watch-modus)
pnpm dev

# Bygg for produksjon
pnpm build

# Start produksjonsserver
pnpm start

# Typekontroll
pnpm typecheck
```

### Testing
```bash
# Kjør alle tester
pnpm test

# Kjør tester i watch-modus
pnpm test:watch

# Generer dekningsrapport
pnpm coverage
```

### Kodeformatering
```bash
# Sjekk kode med Biome
pnpm lint

# Fiks automatiske problemer
pnpm lint:fix

# Formater kode
pnpm format
```

### Database
```bash
# Push skjema til database (utvikling)
pnpm db:push

# Generer migrasjoner
pnpm db:generate

# Kjør migrasjoner
pnpm db:migrate

# Åpne Drizzle Studio
pnpm db:studio

# Sjekk migrasjonsstatus
pnpm db:check

# Slett migrasjon
pnpm db:drop
```

### E-post
```bash
# Start React Email forhåndsvisning
pnpm email
```

Åpner utviklingsserver på `http://localhost:4001` for å forhåndsvise e-postmaler.

### Docker
```bash
# Start utviklingsmiljø
pnpm docker:dev

# Stopp utviklingsmiljø
pnpm docker:dev:down

# Start produksjonsmiljø
pnpm docker:prod

# Stopp produksjonsmiljø
pnpm docker:prod:down
```

## 🔐 Autentisering

Photon bruker Better Auth med Feide-integrasjon for autentisering.

Normalt sett trengs ikke feide for å benytte APIet, da vi også tilbyr autentisering via epost. Dersom du trenger Feide-credentials for testing, kan du be om dev-nøkler av repo-ansvarlig.

### Oppsett av Feide

For å benytte Feide trenger du følgende miljøvariabler:

```
FEIDE_CLIENT_ID="client_id ..."
FEIDE_CLIENT_SECRET="client_secret ..."
```

### Rollehåndtering (RBAC)

Photon inkluderer role-based access control (RBAC) i `src/lib/auth/rbac/` for finkornet tilgangskontroll.

## 💳 Vipps-integrasjon

Prosjektet har innebygd støtte for Vipps MobilePay. Webhooks konfigureres automatisk ved oppstart av serveren.

Vipps-variabler trengs ikke for å kjøre serveren. Men om du ønsker å teste Vipps må du sette opp følgende miljøvariabler:
```
VIPPS_SUBSCRIPTION_KEY       = "subscription_key ..."
VIPPS_CLIENT_ID              = "client_id ..."
VIPPS_CLIENT_SECRET          = "client_secret ..."
VIPPS_MERCHANT_SERIAL_NUMBER = "merchant_serial_number ..."
VIPPS_TEST_MODE              = "true" # kjører mot test-api (du slipper å faktisk betale)
```

Du trenger også Vipps testing-appen og et fake mobilnummer. Du finner mer info på [Vipps sin dokumentasjon](https://developer.vippsmobilepay.com/docs/knowledge-base/test-environment/).

## 📧 E-postutvikling

E-postmaler utvikles med React Email og støtter full React-komponent-syntaks.

```bash
# Start forhåndsvisning
pnpm email
```

Forhåndsvisning kjører på port 4001.

## 📚 API-dokumentasjon

API-dokumentasjonen genereres automatisk fra OpenAPI-spesifikasjonen og er tilgjengelig når serveren kjører:

- **API Base URL**: `http://localhost:4000/api`
- **OpenAPI Schema**: `http://localhost:4000/openapi`
- **Dokumentasjon**: `http://localhost:4000/docs`

Dokumentasjonen bruker Scalar API Reference og inkluderer både API-ruter og autentiseringsendpoints.

## 🧪 Testing

Photon bruker Vitest for testing med støtte for:

- **Enhetstester** - Rask testing av individuelle funksjoner
- **Integrasjonstester** - Testing med ekte database via Testcontainers
- **Dekningsrapporter** - Generert med @vitest/coverage-v8

### Kjøre tester

```bash
# Alle tester
pnpm test

# Watch-modus
pnpm test:watch

# Med dekning
pnpm coverage
```

Testcontainers starter automatisk PostgreSQL- og Redis-containere for integrasjonstester, så sørg for at Docker kjører når du skal kjøre testene.

Om du ønsker å kjøre flere tester parallellt (fordi du har en beefy PC), kan du justere følgende i `vitest.config.ts`:
```ts
maxWorkers: 1 // sett til hva du vil
```

## 🐳 Docker

Prosjektet inkluderer Docker-oppsett for både utvikling og produksjon.

### Utviklingsmiljø

```bash
pnpm docker:dev
```

Starter:
- PostgreSQL 17
- Redis 7.4
- Mailpit

### Produksjonsmiljø

```bash
pnpm docker:prod
```

Bygger og starter API-serveren sammen med alle nødvendige tjenester.

## 🤝 Bidra

1. Fork repositoryet
2. Opprett en feature branch (`git checkout -b feature/ny-funksjon`)
3. Commit endringene dine (`git commit -m 'Legg til ny funksjon'`)
4. Push til branchen (`git push origin feature/ny-funksjon`)
5. Åpne en Pull Request

### Retningslinjer

- Følg kodestandardene håndhevet av Biome
- Skriv tester for ny funksjonalitet
- Oppdater dokumentasjonen ved behov
- Sørg for at alle tester passerer før du sender inn PR

