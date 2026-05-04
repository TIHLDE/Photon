export type NewsItem = {
    slug: string;
    title: string;
    excerpt: string;
    publishedAt: string;
    publishedAtAbsolute: string;
    updatedAt?: string;
    imageUrl?: string;
    body: string;
    reactionsEnabled: boolean;
};

const HOW_TO_NOTION_BODY = `## Hvorfor Notion?

Notion er **arbeidshesten** vår for opplæring og dokumentasjon i undergruppene.
Det gir oss ett sted å samle alt vi trenger for å holde styr på rutiner, vedtak
og prosjekter, og det er enkelt å dele med nye medlemmer.

> Et godt oppsett av Notion sparer dere for mange timer hver semester.

### Det vi bruker Notion til

- **Onboarding** av nye medlemmer
- **Møtereferater** og styresaker
- **Roadmaps** og planlegging
- **Kunnskapsbase** med rutiner og maler

## Anbefalt struktur

Dette er strukturen vi anbefaler for nye undergrupper.

| Side | Innhold | Hvem eier? |
|------|---------|------------|
| Hjem | Lenker til alle viktige sider | Leder |
| Onboarding | Sjekkliste for nye medlemmer | Leder |
| Møter | Referater og innkallinger | Sekretær |
| Prosjekter | Aktive og planlagte prosjekter | Hele gruppen |
| Arkiv | Avsluttede prosjekter | Hele gruppen |

### Tips til møtereferater

1. Bruk en mal slik at alle referater ser like ut
2. Ha en fast plass til vedtak slik at de er enkle å finne
3. Tag personer som har action items

\`\`\`md
# Møtereferat 2026-04-30

## Tilstede
- Person 1
- Person 2

## Saker
1. Sak A — vedtak
2. Sak B — diskusjon
\`\`\`

## Kom i gang

Send en melding i \`#promo\` på Slack om dere ønsker mal-tilgang, så hjelper vi
dere i gang med en gang.`;

const TRIVSEL_BODY = `## TIHLDE Trivselsundersøkelse V26

Det er igjen tid for vår årlige trivselsundersøkelse — og i år er det ekstra
gøy, fordi vi trekker **gavekort på 1 000 kr** blant alle som svarer.

### Hvorfor svare?

Hovedstyret bruker svarene aktivt når vi planlegger neste semester. Det
betyr at innspillene dine går rett inn i:

- Hva slags arrangementer vi prioriterer
- Hvordan vi følger opp undergruppene
- Hva vi løfter til linjeforeningen NTNU sentralt

> Det tar ca. 7 minutter, og du kan svare anonymt.

## Slik svarer du

1. Følg lenken som ble sendt på e-post
2. Svar ærlig — vi leser alt
3. Krysse av om du vil være med i trekningen

:::callout{type=info title="Frist"}
Undersøkelsen stenger **søndag 12. mai 23:59**. Etter det går vi i gang med
analysen.
:::`;

export const NEWS: NewsItem[] = [
    {
        slug: "how-to-notion",
        title: "How to Notion",
        excerpt:
            "Opplæring til Promo? Bruk Notion! Les vår nye guide om hvordan vi bruker Notion i undergrupper.",
        publishedAt: "Oppdatert i går",
        publishedAtAbsolute: "Tor 24. apr 2026, 14:30",
        updatedAt: "Tir 29. apr 2026, 09:12",
        imageUrl:
            "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1600&q=80",
        body: HOW_TO_NOTION_BODY,
        reactionsEnabled: true,
    },
    {
        slug: "trivselsundersokelse-v26",
        title: "TIHLDE Trivselsundersøkelse V26",
        excerpt:
            "Vinn gavekort ved å svare på den årlige trivselsundersøkelsen. Din stemme teller!",
        publishedAt: "3 dager siden",
        publishedAtAbsolute: "Søn 27. apr 2026, 12:00",
        imageUrl:
            "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1600&q=80",
        body: TRIVSEL_BODY,
        reactionsEnabled: true,
    },
    {
        slug: "aten-scholarship",
        title: "Aten Scholarship",
        excerpt:
            "Søk om stipend til å delta på konferanser og workshops gjennom Aten.",
        publishedAt: "4 dager siden",
        publishedAtAbsolute: "Lør 26. apr 2026, 10:00",
        imageUrl:
            "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1600&q=80",
        body: `## Aten Scholarship

Aten støtter studenter som vil dra på relevante konferanser og workshops.

### Hva dekkes?

- Reisekostnader (inntil 5 000 kr)
- Konferanseavgift
- Overnatting

### Hvordan søke?

Send en kort søknad til \`stipend@aten.no\` innen **15. mai**. Beskriv hvorfor
nettopp denne konferansen er relevant for studiet ditt.`,
        reactionsEnabled: false,
    },
    {
        slug: "klatring-i-tihlde",
        title: "Klatring i TIHLDE",
        excerpt:
            "Bli med på klatrekvelder sammen med andre TIHLDE-medlemmer. Alle nivåer velkomne!",
        publishedAt: "1 uke siden",
        publishedAtAbsolute: "Ons 23. apr 2026, 18:00",
        body: `## Klatring i TIHLDE

Vi arrangerer klatrekvelder annenhver onsdag på **Trondheim Klatresenter**.

### Hva trenger du?

- Klatresko (kan leies)
- Sele (kan leies)
- Godt humør

### Påmelding

Meld deg på via Slack-kanalen \`#klatring\`. Vi har plass til 12 personer per
kveld.`,
        reactionsEnabled: true,
    },
    {
        slug: "snart-generalforsamling",
        title: "Snart Generalforsamling",
        excerpt:
            "Generalforsamling for TIHLDE nærmer seg. Les mer om saksliste og hvordan du stemmer.",
        publishedAt: "1 uke siden",
        publishedAtAbsolute: "Tir 22. apr 2026, 09:00",
        body: `## Generalforsamling 2026

Generalforsamlingen er TIHLDEs øverste organ. Det er her vi vedtar budsjett,
velger styre og legger føringer for året som kommer.

### Saksliste

1. Valg av møteleder og referent
2. Godkjenning av innkalling
3. Årsberetning
4. Regnskap
5. Innkomne saker
6. Valg

### Stemmerett

Alle TIHLDE-medlemmer har stemmerett. Du må være registrert som medlem senest
**14 dager** før møtet.`,
        reactionsEnabled: false,
    },
];

export function getNewsBySlug(slug: string) {
    return NEWS.find((n) => n.slug === slug);
}
