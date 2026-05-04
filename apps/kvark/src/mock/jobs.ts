export type JobItem = {
    slug: string;
    title: string;
    company: string;
    companyLogoUrl?: string;
    jobType: string;
    classLevels: string;
    location: string;
    deadline: string;
    deadlineAbsolute: string;
    publishedAt: string;
    imageUrl?: string;
    body: string;
    applyUrl: string;
};

const MATTEHEITEN_BODY = `## Bli en Mattehelten!

**Mattehelten** søker engasjerte studenter som ønsker å gjøre matematikk
morsommere for ungdomsskole- og videregående-elever — alt på nett.

### Om stillingen

Du blir en del av et tverrfaglig team som leverer mattehjelp til hundrevis
av elever hver uke. Du jobber **når det passer deg** og bestemmer selv
arbeidsmengden.

### Hva vi tilbyr

- Konkurransedyktig timelønn
- Fleksibel arbeidstid
- Faglig utvikling og opplæring
- Et hyggelig digitalt miljø

### Vi ser etter deg som

1. Liker å forklare ting på en enkel måte
2. Er strukturert og selvgående
3. Har fullført videregående matematikk (R1/R2 eller tilsvarende)

| Detalj | Beskrivelse |
|--------|-------------|
| Stilling | Deltid |
| Sted | Digitalt |
| Lønn | 220 – 280 kr/t |
| Arbeidsmengde | 4 – 15 timer per uke |

:::callout{type=info title="Slik søker du"}
Send CV og en kort motivasjon til \`jobb@matteheiten.no\`. Vi gjennomfører
løpende intervjuer.
:::`;

const FIKSE_BODY = `## Fullstack Utvikler — Sommerjobb hos Fikse

Bli med på laget i **Fikse** denne sommeren og bygg kvalitetsprodukter sammen
med et team som elsker håndverket.

### Om Fikse

Fikse er en bærekraftig oppstartsbedrift basert i Oslo. Vi bygger plattformer
som forenkler livet for både kunder og bedrifter, og vi har det gøy mens vi
gjør det.

### Stack

- **Frontend**: TypeScript, React, TanStack
- **Backend**: TypeScript, Hono, PostgreSQL
- **Infra**: Docker, Kubernetes, GitHub Actions

### Hvem vi ser etter

- 3.–5. klasse studenter
- Erfaring med moderne webutvikling
- Deg som tør å ta initiativ`;

const SOCIAL_MINDS_BODY = `## Bli SoMe-ekspert hos Social Minds

**Social Minds** søker studenter som vil utvikle seg innen sosiale medier,
markedsføring og innholdsproduksjon.

### Hva du vil jobbe med

- Innholdsplanlegging
- Bildebehandling og video
- Analyse og rapportering

### Om stillingen

Helt digital arbeidsplass med fleksible timer. Perfekt ved siden av studier.`;

export const JOBS: JobItem[] = [
    {
        slug: "matteheiten-deltid",
        title: "Hjelp ungdommer med matteleksjer på nett",
        company: "Mattehelten",
        jobType: "Deltid",
        classLevels: "1. - 2.",
        location: "Digitalt",
        deadline: "Man 15. juni 2026",
        deadlineAbsolute: "Man 15. juni 2026, 23:59",
        publishedAt: "Tor 24. apr 2026",
        body: MATTEHEITEN_BODY,
        applyUrl: "https://matteheiten.no/karriere",
    },
    {
        slug: "fikse-sommer",
        title: "Fullstack Utvikler – Sommerjobb",
        company: "Fikse",
        jobType: "Sommerjobb",
        classLevels: "3. - 5.",
        location: "Oslo",
        deadline: "Fortløpende",
        deadlineAbsolute: "Søknader vurderes fortløpende",
        publishedAt: "Tir 22. apr 2026",
        body: FIKSE_BODY,
        applyUrl: "https://fikse.no/jobs",
    },
    {
        slug: "social-minds",
        title: "Social Minds",
        company: "Social Minds",
        jobType: "Deltid",
        classLevels: "1. - 5.",
        location: "Digitalt",
        deadline: "Fortløpende",
        deadlineAbsolute: "Søknader vurderes fortløpende",
        publishedAt: "Søn 20. apr 2026",
        body: SOCIAL_MINDS_BODY,
        applyUrl: "https://socialminds.no/jobs",
    },
    {
        slug: "borg-cloud",
        title: "Cloud Engineer",
        company: "Borg",
        jobType: "Deltid",
        classLevels: "1. - 5.",
        location: "Trondheim",
        deadline: "Fortløpende",
        deadlineAbsolute: "Søknader vurderes fortløpende",
        publishedAt: "Lør 19. apr 2026",
        body: `## Cloud Engineer hos Borg

Bli med på et erfarent team som drifter store skyløsninger for kunder over
hele landet.

### Krav

- Kjennskap til AWS eller GCP
- Forståelse for nettverk og sikkerhet
- Erfaring med IaC er en fordel`,
        applyUrl: "https://borg.no/karriere",
    },
];

export function getJobBySlug(slug: string) {
    return JOBS.find((j) => j.slug === slug);
}
