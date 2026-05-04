export type EventCategory = "Sosialt" | "Foreningen" | "Kurs" | "Jentelunsj";

export type EventRegistrationState = "not-open" | "open" | "joined";

export type EventRegistrant = {
    id: string;
    name: string;
    studyProgram: string;
    classYear: number;
    onWaitlist?: boolean;
};

export type EventItem = {
    slug: string;
    title: string;
    startsAt: string;
    endsAt: string;
    startsAtIso: string;
    endsAtIso: string;
    location: string;
    category: EventCategory;
    organizer: string;
    contactPerson: string;
    contactEmail: string;
    imageUrl?: string;
    body: string;
    reactionsEnabled: boolean;

    registrationState: EventRegistrationState;
    registrationOpensAt?: string;
    registrationOpensInLabel?: string;
    capacity: number | null;
    registeredCount: number;
    waitlistCount: number;
    registrants: EventRegistrant[];
    isAdmin: boolean;
};

const TODDELMAGA_BODY = `## Velkommen til Tøddelmåga!

Bli med på årets hyggeligste **Tøddelmåga**, hvor vi koser oss med mat,
drikke og lek på TÖDDEL. Det blir både konkurranser, premier og massevis av
god stemning.

### Det blir servert

- Hjemmelaget pizza
- Mineralvann og brus
- Kaffe og te
- Kake til dessert

### Program

| Tidspunkt | Aktivitet |
|-----------|-----------|
| 20:00 | Døra åpner |
| 20:30 | Velkomst og presentasjon |
| 21:00 | Quiz |
| 22:00 | Fri mingling |
| 23:30 | Avslutning |

> Vi gleder oss til å se deg!`;

const GENERAL_BODY = `## Generalforsamling med TIHLDE Utveksling

Vi inviterer til generalforsamling i TIHLDE Utveksling. Det blir gjennomgang
av året som har vært, valg av nytt styre og åpen diskusjon om veien videre.

### Agenda

1. Velkomst
2. Årsberetning
3. Regnskap
4. Innkomne saker
5. Valg av nytt styre

:::callout{type=info title="Hybrid møte"}
Du kan delta på TIHLDE Utveksling sitt kontor eller via **Zoom**. Lenke
sendes ut til påmeldte dagen før.
:::`;

const SKI_BODY = `## Sosial samling i Høyskoleparken

TIHLDE Ski inviterer til en avslappet sosial sammenkomst midt i den fine
vårsola. Ta med deg en pledd og et godt humør, så fikser vi resten.

### Hva skjer?

- Felles oppmøte i Høyskoleparken
- Lett servering
- Spill og mingling
- Mulig avstikker til Samfundet etterpå

### Tips

- Kle deg etter været
- Solbriller anbefales
- Egne snacks er hjertelig velkommen`;

export const EVENTS: EventItem[] = [
    {
        slug: "ski-sosialt-april",
        title: "Sosial samling med TIHLDE Ski",
        startsAt: "Tor 30. apr 2026, 12:00",
        endsAt: "Tor 30. apr 2026, 12:30",
        startsAtIso: "2026-04-30T12:00:00+02:00",
        endsAtIso: "2026-04-30T12:30:00+02:00",
        location: "Høyskoleparken",
        category: "Sosialt",
        organizer: "TIHLDE Ski",
        contactPerson: "Tiril Tøllefsen Ohr",
        contactEmail: "tiril@tihlde.org",
        imageUrl:
            "https://images.unsplash.com/photo-1465188466887-15c87dc7be86?auto=format&fit=crop&w=1600&q=80",
        body: SKI_BODY,
        reactionsEnabled: true,
        registrationState: "joined",
        capacity: null,
        registeredCount: 12,
        waitlistCount: 0,
        registrants: [
            {
                id: "u1",
                name: "Iver Lindholm",
                studyProgram: "Dataingeniør",
                classYear: 3,
            },
            {
                id: "u2",
                name: "Tiril Tøllefsen Ohr",
                studyProgram: "Digital Forretningsutvikling",
                classYear: 2,
            },
            {
                id: "u3",
                name: "Ola Nordmann",
                studyProgram: "Dataingeniør",
                classYear: 1,
            },
            {
                id: "u4",
                name: "Kari Nordmann",
                studyProgram: "Drift av datasystemer",
                classYear: 2,
            },
            {
                id: "u5",
                name: "Per Hansen",
                studyProgram: "Dataingeniør",
                classYear: 3,
            },
        ],
        isAdmin: true,
    },
    {
        slug: "toddelmaga",
        title: "Tøddelmåga!",
        startsAt: "Tor 30. apr 2026, 20:00",
        endsAt: "Fre 01. mai 2026, 02:00",
        startsAtIso: "2026-04-30T20:00:00+02:00",
        endsAtIso: "2026-05-01T02:00:00+02:00",
        location: "TÖDDEL",
        category: "Sosialt",
        organizer: "TÖDDEL",
        contactPerson: "Mads Henriksen",
        contactEmail: "toddel@tihlde.org",
        imageUrl:
            "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1600&q=80",
        body: TODDELMAGA_BODY,
        reactionsEnabled: true,
        registrationState: "open",
        capacity: 80,
        registeredCount: 56,
        waitlistCount: 4,
        registrants: [
            {
                id: "u10",
                name: "Anna Berg",
                studyProgram: "Dataingeniør",
                classYear: 2,
            },
            {
                id: "u11",
                name: "Henrik Solheim",
                studyProgram: "Drift av datasystemer",
                classYear: 1,
            },
            {
                id: "u12",
                name: "Mia Olsen",
                studyProgram: "Digital Forretningsutvikling",
                classYear: 3,
            },
            {
                id: "u13",
                name: "Sofie Larsen",
                studyProgram: "Dataingeniør",
                classYear: 2,
                onWaitlist: true,
            },
        ],
        isAdmin: false,
    },
    {
        slug: "utmarkslutningsball-2026",
        title: "Utmarkslutningsball 2026",
        startsAt: "Lør 14. jun 2026, 18:00",
        endsAt: "Søn 15. jun 2026, 02:00",
        startsAtIso: "2026-06-14T18:00:00+02:00",
        endsAtIso: "2026-06-15T02:00:00+02:00",
        location: "Britannia Hotel",
        category: "Foreningen",
        organizer: "TIHLDE Hovedstyret",
        contactPerson: "Sondre Eikeland",
        contactEmail: "festkomite@tihlde.org",
        imageUrl:
            "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1600&q=80",
        body: GENERAL_BODY,
        reactionsEnabled: true,
        registrationState: "not-open",
        registrationOpensAt: "Fre 22. mai 2026, 00:00",
        registrationOpensInLabel: "1 time",
        capacity: 200,
        registeredCount: 0,
        waitlistCount: 0,
        registrants: [],
        isAdmin: false,
    },
    {
        slug: "generalforsamling-utveksling",
        title: "Generalforsamling med TIHLDE Utveksling",
        startsAt: "Tor 23. apr 2026, 18:00",
        endsAt: "Tor 23. apr 2026, 20:00",
        startsAtIso: "2026-04-23T18:00:00+02:00",
        endsAtIso: "2026-04-23T20:00:00+02:00",
        location: "TIHLDE Utveksling / Zoom",
        category: "Foreningen",
        organizer: "TIHLDE Utveksling",
        contactPerson: "Jonas Stensrud",
        contactEmail: "utveksling@tihlde.org",
        body: GENERAL_BODY,
        reactionsEnabled: false,
        registrationState: "open",
        capacity: null,
        registeredCount: 28,
        waitlistCount: 0,
        registrants: [
            {
                id: "u20",
                name: "Jonas Stensrud",
                studyProgram: "Dataingeniør",
                classYear: 3,
            },
        ],
        isAdmin: false,
    },
];

export function getEventBySlug(slug: string) {
    return EVENTS.find((e) => e.slug === slug);
}
