# Photon

Ny backend for Kvark - skrevet i TypeScript.

![Static Badge](https://img.shields.io/badge/Language-Typescript-blue?logo=typescript)
![Static Badge](https://img.shields.io/badge/Website-NextJS-black?logo=nextdotjs)
![Static Badge](https://img.shields.io/badge/Server-Hono-orange?logo=hono)

## 🏗️ Arkitektur

### Prosjektstruktur

```
photon/
├── apps/
│   ├── api/              # Hono API-server
│   └── web/              # Next.js webapplikasjon
├── packages/
│   ├── tsconfig/         # Delte TypeScript-konfigurasjoner
│   └── lepton-migration/ # Databasemigrasjonsverktøy
└── infra/
    └── docker/           # Docker Compose-oppsett
```

### Teknologistack

#### Backend (API)
- **Framework**: Hono v4 - minimalistisk og raskt web-rammeverk
- **Database**: PostgreSQL 17 med Drizzle ORM
- **Cache/Kø**: Redis 7.4 med Bull for jobbhåndtering
- **Autentisering**: Better Auth med Feide OAuth2-integrasjon
- **Validering**: Zod v4 for typesikker skjemavalidering
- **API-dokumentasjon**: OpenAPI med Scalar

#### Frontend (Web)
- **Framework**: Next.js med React 19
- **Styling**: (sjekk webappkonfigurasjon for detaljer)

#### DevOps & Verktøy
- **Monorepo**: Turborepo for rask byggeprosess og caching
- **Pakkebehandler**: pnpm v8
- **Kodeformatering**: Biome for linting og formatering
- **Testing**: Vitest med testcontainers for integrasjonstester
- **Bygging**: tsup med esbuild
- **E-postutvikling**: Mailpit for lokal e-posttesting

## 🚀 Komme i gang

### Forutsetninger

- **Node.js** ≥18
- **pnpm** v8.15.6 eller nyere
- **Docker** og Docker Compose (for lokal utvikling)

### Installasjon

1. **Klon repositoryet**
   ```bash
   git clone <repository-url>
   cd photon
   ```

2. **Installer avhengigheter**
   ```bash
   pnpm install
   ```

3. **Konfigurer miljøvariabler**
   ```bash
   cp .env.example .env
   ```

   Rediger `.env` og fyll inn nødvendige verdier:
   - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - databaseinnlogging
   - `FEIDE_CLIENT_ID`, `FEIDE_CLIENT_SECRET` - Feide OAuth-legitimasjon
   - `DATABASE_URL` - PostgreSQL-tilkoblingsstreng

4. **Start Docker-tjenester**
   ```bash
   pnpm dev
   ```
   Dette starter automatisk:
   - PostgreSQL-database (port 5432)
   - Redis-server (port 6379)
   - Mailpit e-postserver (port 8025 for web UI, 1025 for SMTP)
   - Databaseskjema pushes automatisk

### Utvikling

```bash
# Start alle applikasjoner i dev-modus
pnpm dev

# Start med ren cache
pnpm dev:fresh

# Kjør tester
pnpm test

# Kjør tester i watch-modus
pnpm test:watch

# Linting og formatering
pnpm lint
pnpm lint:fix
pnpm format

# Typekontroll
pnpm typecheck

# Bygg for produksjon
pnpm build
```

## 🗄️ Database

### Vanlige databasekommandoer

```bash
# Push skjemaendringer til database
pnpm db:push

# Generer migrasjoner
pnpm db:generate

# Kjør migrasjoner
pnpm db:migrate

# Åpne Drizzle Studio (database GUI)
pnpm db:studio

# Formater skjemafiler
pnpm db:format

# Tilbakestill database
pnpm db:reset

# Seed database med testdata
pnpm db:seed
```

### Databasemigrasjoner

Prosjektet bruker Drizzle ORM for databasehåndtering. Skjemaer defineres i TypeScript og migrasjoner genereres automatisk.

## 📧 E-postutvikling

E-postmaler utvikles med React Email og kan forhåndsvises lokalt:

```bash
cd apps/api
pnpm email
```

Dette starter en utviklingsserver på `http://localhost:4001` hvor du kan forhåndsvise og teste e-postmaler.

I utviklingsmiljø fanges alle utgående e-poster opp av Mailpit. Åpne `http://localhost:8025` for å se sendte e-poster.

## 🔐 Autentisering

Prosjektet bruker Better Auth med Feide-integrasjon for autentisering. Feide er en norsk føderasjonstjeneste for utdanningssektoren.

For å konfigurere Feide:
1. Registrer applikasjonen din hos Feide
2. Legg til `FEIDE_CLIENT_ID` og `FEIDE_CLIENT_SECRET` i `.env`
3. Konfigurer callback-URL i Feide Dashboard

## 💳 Vipps-integrasjon

Prosjektet inkluderer integrasjon med Vipps MobilePay for betalingshåndtering. Webhook-oppsett konfigureres automatisk ved oppstart.

## 📦 TypeScript-konfigurasjon

Prosjektet tilbyr gjenbrukbare TypeScript-konfigurasjoner for ulike bruksområder:

### Basis
- **`packages/tsconfig/base.json`**
  Delt streng grunnkonfigurasjon. Alle andre preset utvider denne.

### Node.js
- **`packages/tsconfig/node/node.json`**
  For skript, CLI-er eller servere som kjøres direkte av Node/tsx.
  Bruker ESM med `NodeNext`-oppløsning og `types: ["node"]`.

- **`packages/tsconfig/node/bundler.json`**
  For Node-kode som bygges med en bundler (tsup/esbuild).
  Bruker ESM med `Bundler`-oppløsning.

- **`packages/tsconfig/node/library.json`**
  For Node-biblioteker som konsumeres via bundlere.
  Hvis du trenger `.d.ts`-output, legg til en `tsconfig.build.json` som aktiverer deklarasjonsutgivelse.

### Web/Frontend
- **`packages/tsconfig/web/nextjs.json`**
  For Next.js-applikasjoner. Inkluderer `jsx: "preserve"` og Next TypeScript-plugin.

- **`packages/tsconfig/web/react-library.json`**
  For React-komponentbiblioteker. Bruker `jsx: "react-jsx"`.

- **`packages/tsconfig/web/web-library.json`**
  For nettleserbiblioteker som ikke bruker React.

## 🧪 Testing

Prosjektet bruker Vitest for testing med støtte for:
- Enhetstester
- Integrasjonstester med Testcontainers
- Dekningsrapporter med `@vitest/coverage-v8`

```bash
# Kjør alle tester
pnpm test

# Kjør tester i watch-modus
pnpm test:watch

# Generer dekningsrapport
cd apps/api
pnpm coverage
```

## 🐳 Docker & Produksjon

### Lokal utvikling
Docker Compose håndterer alle nødvendige tjenester for lokal utvikling:
- PostgreSQL database
- Redis cache/kø
- Mailpit e-postserver

### Produksjonsutrulling
```bash
# Start produksjonsmiljø
pnpm prod:up

# Stopp produksjonsmiljø
pnpm prod:down
```

## 📚 API-dokumentasjon

API-dokumentasjon genereres automatisk via OpenAPI og er tilgjengelig når API-serveren kjører:
- **API Endpoint**: `http://localhost:3000/api`
- **API-dokumentasjon**: Tilgjengelig via Scalar API Reference

## 🔧 Verktøy & Anbefalt oppsett

- **Editor**: VS Code med anbefalte extensions (sjekk `.vscode/`-mappen)
- **Git Hooks**: Pre-commit hooks for linting og formatering
- **Biome**: Rask linting og formatering på tvers av hele monorepoen

## 🤝 Bidra

1. Fork repositoryet
2. Opprett en feature branch (`git checkout -b feature/ny-funksjon`)
3. Commit endringene dine (`git commit -m 'Legg til ny funksjon'`)
4. Push til branchen (`git push origin feature/ny-funksjon`)
5. Åpne en Pull Request

Følg kodestandardene som håndheves av Biome, og sørg for at alle tester passerer før du sender inn PR.

## 📄 Lisens

[Spesifiser lisens her]

## 📞 Kontakt & Support

[Legg til kontaktinformasjon eller supportressurser]

---

Bygget med ❤️ for norsk utdanningssektor
