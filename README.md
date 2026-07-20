# Photon

Ny backend for Kvark - en moderne, typesikker API-server bygget med TypeScript og Hono.

![Static Badge](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript)
![Static Badge](https://img.shields.io/badge/Framework-Hono-orange?logo=hono)
![Static Badge](https://img.shields.io/badge/Database-PostgreSQL-blue?logo=postgresql)

## 📖 Om prosjektet

Photon er en komplett backend-løsning for Kvark, bygget med fokus på ytelse, type-sikkerhet og utvikleropplevelse. Serveren tilbyr autentisering via Feide, hendelseshåndtering, betalingsintegrasjon med Vipps MobilePay, og mye mer.

## ✨ Funksjonalitet

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
- **MinIO** - S3-kompatibel objektlagring

### Utviklingsverktøy

- **TypeScript 5.9** - Statisk typing
- **Bun 1.3** - Pakkebehandler og runtime
- **Turborepo** - Monorepo byggeorkestrering
- **Biome** - Rask linting og formatering
- **Vitest** - Enhetstesting og integrasjonstesting
- **Docker Compose** - Lokal utviklingsmiljø

## 🚀 Kom i gang

### Forutsetninger

- **Bun** ≥1.3
- **Docker** og **Docker Compose**

### Installasjon

1. **Klon repositoryet**

    ```bash
    git clone <repository-url>
    cd Photon
    ```

2. **Installer avhengigheter**

    ```bash
    bun install
    ```

3. **Konfigurer miljøvariabler**

    Kopier eksempelfilen og rediger verdiene:

    ```bash
    cp .env.example .env
    ```

    Nødvendige miljøvariabler:

    ```env
    # Database
    DATABASE_URL=postgresql://postgres:password@localhost:5432/photon_db

    # Auth
    BETTER_AUTH_SECRET=<generer-tilfeldig-hemmelighet>
    BETTER_AUTH_URL=http://localhost:4000

    # Feide OAuth
    FEIDE_CLIENT_ID=<din-feide-client-id>
    FEIDE_CLIENT_SECRET=<din-feide-client-secret>

    # Redis
    REDIS_URL=redis://localhost:6379

    # E-post
    SMTP_HOST=localhost
    SMTP_PORT=1025

    # Gjør at du ikke trenger VIPPS-nøkkler
    VIPPS_TEST_MODE=true
    ```

4. **Start utviklingsmiljøet**

    ```bash
    bun dev
    ```

    Dette starter automatisk Docker-tjenestene, pusher databaseskjemaet og kjører serveren.

## 📦 Prosjektstruktur

```
Photon/
├── apps/
│   └── api/                     # Hono API-server (@photon/api)
│       ├── src/
│       │   ├── routes/          # API-rutebehandlere
│       │   ├── middleware/      # Hono-middleware
│       │   ├── lib/             # Forretningslogikk og hjelpere
│       │   ├── db/seed/         # Database-seed-skript
│       │   └── test/            # Integrasjons- og enhetstester
│       └── vitest.config.ts
├── packages/
│   ├── auth/                    # Autentisering og RBAC (@photon/auth)
│   │   └── src/rbac/           # Tillatelsesparser, sjekker, tilganger, roller
│   ├── core/                    # Env-konfig, Redis, BullMQ (@photon/core)
│   ├── db/                      # Drizzle ORM-skjema og migrasjoner (@photon/db)
│   │   ├── src/schema/          # Alle Drizzle-skjemadefinisjoner
│   │   └── drizzle/             # Genererte migrasjoner
│   ├── email/                   # React Email-maler og mailer (@photon/email)
│   │   └── src/template/        # E-postmaler (.tsx)
│   └── tsconfig/                # Delte TypeScript-konfigurasjoner
├── infra/
│   └── docker/                  # Docker Compose-filer og Dockerfile
├── turbo.json                   # Turborepo pipeline-konfig
└── biome.json                   # Linting og formatering
```

## 🎯 Utviklingskommandoer

### Generelt

```bash
# Start utviklingsserver (starter Docker + db:push automatisk)
bun dev

# Bygg for produksjon
bun run build

# Start produksjonsserver
bun start

# Typekontroll
bun run typecheck
```

### Testing

```bash
# Kjør alle tester (krever Docker)
bun run test
```

### Kodeformatering

```bash
# Sjekk kode med Biome
bun lint

# Fiks automatiske problemer
bun lint:fix

# Formater kode
bun format
```

### Database

```bash
# Push skjema til database (utvikling)
bun db:push

# Generer migrasjoner
bun db:generate

# Kjør migrasjoner
bun db:migrate

# Åpne Drizzle Studio
bun db:studio
```

### E-post

```bash
# Start React Email forhåndsvisning
bun email
```

Åpner utviklingsserver på `http://localhost:4001` for å forhåndsvise e-postmaler.

### Docker

```bash
# Start utviklingsmiljø
bun docker:dev

# Stopp utviklingsmiljø
bun docker:dev:down

# Frisk start med rene volumer
bun docker:fresh

# Start produksjonsmiljø
bun docker:prod

# Stopp produksjonsmiljø
bun docker:prod:down
```

## 🔐 Autentisering

Photon bruker Better Auth med Feide-integrasjon for autentisering.

Normalt sett trengs ikke Feide for å benytte APIet, da vi også tilbyr autentisering via e-post. Dersom du trenger Feide-credentials for testing, kan du be om dev-nøkler av repo-ansvarlig.

### Oppsett av Feide

For å benytte Feide trenger du følgende miljøvariabler:

```
FEIDE_CLIENT_ID="client_id ..."
FEIDE_CLIENT_SECRET="client_secret ..."
```

### Rollehåndtering (RBAC)

Photon inkluderer role-based access control (RBAC) i `packages/auth/src/rbac/` for finkornet tilgangskontroll.

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
bun email
```

Forhåndsvisning kjører på port 4001. I utvikling fanges e-poster opp av Mailpit på `http://localhost:8025`.

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

```bash
# Alle tester
bun run test
```

Testcontainers starter automatisk PostgreSQL-, Redis- og MinIO-containere for integrasjonstester, så sørg for at Docker kjører.

Om du ønsker å kjøre flere tester parallellt, kan du justere `MAX_TEST_WORKERS` miljøvariabelen.

## 🐳 Docker

Prosjektet inkluderer Docker-oppsett for både utvikling og produksjon.

### Utviklingsmiljø

```bash
bun docker:dev
```

Starter:

- PostgreSQL 17
- Redis 7.4
- Mailpit
- MinIO

### Produksjonsmiljø

```bash
bun docker:prod
```

Bygger og starter API-serveren sammen med alle nødvendige tjenester.

## 🤝 Bidra

1. Fork repositoryet
2. Opprett en feature branch (`git checkout -b feature/ny-funksjon`)
3. Commit endringene dine (`git commit -m 'feat: legg til ny funksjon'`)
4. Push til branchen (`git push origin feature/ny-funksjon`)
5. Åpne en Pull Request

### Retningslinjer

- Følg kodestandardene håndhevet av Biome
- Skriv tester for ny funksjonalitet
- Oppdater dokumentasjonen ved behov
- Sørg for at alle tester passerer før du sender inn PR
- Følg commit-konvensjonen: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `perf:`
