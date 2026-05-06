import type { ChartConfig } from "@tihlde/ui/ui/chart";

import type { EventCardProps } from "#/components/event-card";

export type Group = {
    name: string;
    description: string;
    contactEmail: string;
    leader: string;
    botSystemPraktisk: string;
    botSjef: string;
};

export type Member = {
    name: string;
    joined: string;
    until?: string;
    role?: string;
};

export type Fine = {
    id: string;
    user: string;
    paragraph: string;
    title: string;
    amount: number;
    approved: boolean;
    paid: boolean;
    createdBy: string;
    date: string;
    reason: string;
};

export type Law = {
    paragraph: string;
    title: string;
    description: string;
    amount: number;
};

export type Form = {
    id: string;
    title: string;
    isOpen: boolean;
};

export const GROUP: Group = {
    name: "Index",
    description:
        "Index jobber smidig med utviklingen av linjeforeningens løsninger, blant annet nettsiden du er inne på akkurat nå.",
    contactEmail: "teknologiminister@tihlde.org",
    leader: "Mathias Strøm",
    botSystemPraktisk: "Skyldig til motsatt bevist. Foreldring på 1 uke",
    botSjef: "Linde Agahd Vrenne",
};

export const STUDY_OVER_TIME = [
    {
        semester: "H22",
        dataingenior: 3,
        forretning: 1,
        infrastruktur: 0,
        transformasjon: 0,
    },
    {
        semester: "V23",
        dataingenior: 5,
        forretning: 3,
        infrastruktur: 1,
        transformasjon: 0,
    },
    {
        semester: "H23",
        dataingenior: 7,
        forretning: 4,
        infrastruktur: 2,
        transformasjon: 1,
    },
    {
        semester: "V24",
        dataingenior: 9,
        forretning: 5,
        infrastruktur: 3,
        transformasjon: 1,
    },
    {
        semester: "H24",
        dataingenior: 10,
        forretning: 7,
        infrastruktur: 4,
        transformasjon: 1,
    },
    {
        semester: "V25",
        dataingenior: 11,
        forretning: 8,
        infrastruktur: 4,
        transformasjon: 1,
    },
    {
        semester: "H25",
        dataingenior: 12,
        forretning: 8,
        infrastruktur: 4,
        transformasjon: 1,
    },
    {
        semester: "V26",
        dataingenior: 12,
        forretning: 9,
        infrastruktur: 4,
        transformasjon: 1,
    },
];

export const studyChartConfig = {
    dataingenior: { label: "Dataingeniør", color: "var(--chart-1)" },
    forretning: {
        label: "Digital forretningsutvikling",
        color: "var(--chart-2)",
    },
    infrastruktur: { label: "Digital infrastruktur", color: "var(--chart-3)" },
    transformasjon: {
        label: "Digital transformasjon",
        color: "var(--chart-4)",
    },
} satisfies ChartConfig;

export const MEMBERS_OVER_TIME = [
    { semester: "H22", medlemmer: 4, fill: "var(--color-h22)" },
    { semester: "V23", medlemmer: 9, fill: "var(--color-v23)" },
    { semester: "H23", medlemmer: 14, fill: "var(--color-h23)" },
    { semester: "V24", medlemmer: 18, fill: "var(--color-v24)" },
    { semester: "H24", medlemmer: 22, fill: "var(--color-h24)" },
    { semester: "V25", medlemmer: 24, fill: "var(--color-v25)" },
    { semester: "H25", medlemmer: 25, fill: "var(--color-h25)" },
    { semester: "V26", medlemmer: 26, fill: "var(--color-v26)" },
];

export const membersChartConfig = {
    medlemmer: { label: "Medlemmer", color: "var(--chart-2)" },
    h22: { label: "H22", color: "var(--chart-1)" },
    v23: { label: "V23", color: "var(--chart-2)" },
    h23: { label: "H23", color: "var(--chart-3)" },
    v24: { label: "V24", color: "var(--chart-4)" },
    h24: { label: "H24", color: "var(--chart-5)" },
    v25: { label: "V25", color: "var(--chart-1)" },
    h25: { label: "H25", color: "var(--chart-2)" },
    v26: { label: "V26", color: "var(--chart-3)" },
} satisfies ChartConfig;

export const STUDY_RADAR = [
    { studie: "Dataingeniør", v26: 12 },
    { studie: "Forretning", v26: 9 },
    { studie: "Infrastruktur", v26: 4 },
    { studie: "Transformasjon", v26: 1 },
];

export const radarChartConfig = {
    v26: { label: "V26", color: "var(--chart-1)" },
} satisfies ChartConfig;

export const LEADER: Member = {
    name: "Mathias Strøm",
    joined: "Lør 14. september 2024",
};

export const MEMBERS: Member[] = [
    {
        name: "Aleksander Hjortkær Sand Evensen",
        joined: "Lør 14. september 2024",
    },
    { name: "Alva Kjærstad Leiner", joined: "Man 8. september 2025" },
    { name: "Anders Morille", joined: "Tir 19. september 2023" },
    { name: "André Skjellevik", joined: "Søn 22. februar" },
    { name: "Anton Tveito", joined: "Tir 19. september 2023" },
    { name: "Conrad Osvik", joined: "Tir 19. september 2023" },
    { name: "Dennis Moe", joined: "Søn 22. februar" },
    { name: "Dev Raj Mathur", joined: "Man 8. september 2025" },
    { name: "Embret Roås", joined: "Tir 19. september 2023" },
    { name: "Frida Bugjerde Kroken", joined: "Tir 19. september 2023" },
    { name: "Gabriel Johan Andersen", joined: "Man 8. september 2025" },
    { name: "Henrik Utistog Hausberg", joined: "Tir 19. september 2023" },
    { name: "Iver Lindholm", joined: "Lør 14. september 2024" },
    { name: "Josefine Huffman", joined: "Lør 14. september 2024" },
    { name: "Linde Agahd Vrenne", joined: "Man 8. september 2025" },
    { name: "Mads Nylund", joined: "Man 30. januar 2023" },
    { name: "Mina Holstad Juliussen", joined: "Man 8. september 2025" },
    { name: "Petra Flores Halvorsen", joined: "Lør 14. september 2024" },
    { name: "Preben Halaas Berntsen", joined: "Man 8. september 2025" },
    { name: "Sander Burud Sundbye", joined: "Man 8. september 2025" },
    { name: "Sofie Sirevåg Tysdal", joined: "Ons 8. oktober 2025" },
    { name: "Stian Closs Walmann", joined: "Lør 14. september 2024" },
    { name: "Stian Solem", joined: "Søn 22. februar" },
    { name: "Storm Aulid", joined: "Lør 14. september 2024" },
    { name: "Tam Minh Le", joined: "Tir 19. september 2023" },
];

export const MEMBER_HISTORY: Member[] = [
    {
        name: "Johannes Aamot-Skeidsvoll",
        joined: "Lør 14. september 2024",
        until: "Man 20. april",
        role: "Medlem",
    },
    {
        name: "Josefine Arntsen",
        joined: "Lør 14. september 2024",
        until: "Man 9. mars",
        role: "Medlem",
    },
    {
        name: "Idun Tokle Larsen",
        joined: "Lør 14. september 2024",
        until: "Man 23. februar",
        role: "Medlem",
    },
    {
        name: "Sofie Fjøsne Bredesen",
        joined: "Søn 15. september 2024",
        until: "Man 16. februar",
        role: "Medlem",
    },
    {
        name: "Yazan Samer Zarka",
        joined: "Lør 14. september 2024",
        until: "Man 2. februar",
        role: "Medlem",
    },
    {
        name: "Mikael Stray Frøyshov",
        joined: "Lør 14. september 2024",
        until: "Man 2. februar",
        role: "Medlem",
    },
    {
        name: "Cecilia Thrane-Steen",
        joined: "Man 8. september 2025",
        until: "Søn 19. oktober 2025",
        role: "Medlem",
    },
    {
        name: "Mathias Strøm",
        joined: "Lør 14. september 2024",
        until: "Ons 1. oktober 2025",
        role: "Medlem",
    },
    {
        name: "Embret Roås",
        joined: "Tir 19. september 2023",
        until: "Ons 1. oktober 2025",
        role: "Leder",
    },
    {
        name: "Frikk Ormestad Larsen",
        joined: "Tir 13. september 2022",
        until: "Man 8. september 2025",
        role: "Medlem",
    },
    {
        name: "Harry Linrui Xu",
        joined: "Tir 13. september 2022",
        until: "Man 8. september 2025",
        role: "Medlem",
    },
    {
        name: "Tini Tran",
        joined: "Man 30. januar 2023",
        until: "Man 8. september 2025",
        role: "Medlem",
    },
    {
        name: "Emil Johnsen",
        joined: "Tir 13. september 2022",
        until: "Man 8. september 2025",
        role: "Medlem",
    },
];

export const USERS: string[] = [
    LEADER.name,
    ...MEMBERS.map((m) => m.name),
].sort((a, b) => a.localeCompare(b));

export const EVENTS: EventCardProps[] = [
    {
        slug: "generalforsamling-utveksling",
        title: "Generalforsamling med TIHLDE Utveksling",
        startsAt: "Tor 23. apr 18:00",
        location: "TIHLDE Utveksling / Zoom",
        organizer: "TIHLDE Utveksling",
        category: "Foreningen",
        capacity: null,
        registeredCount: 28,
    },
    {
        slug: "lightning-talks",
        title: "Lightning Talks",
        startsAt: "Ons 22. apr 17:00",
        location: "Realfagbygget, Aud. S1 / Kurs",
        organizer: "TIHLDE Promo",
        category: "Kurs",
        capacity: 60,
        registeredCount: 42,
    },
    {
        slug: "toddelmaga",
        title: "Tøddelmåga!",
        startsAt: "Tor 30. apr 20:00",
        location: "TÖDDEL / Sosialt",
        organizer: "TÖDDEL",
        category: "Sosialt",
        capacity: 80,
        registeredCount: 56,
    },
    {
        slug: "laptoplotteri",
        title: "Laptoplotteri",
        startsAt: "Fre 02. mai 14:00",
        location: "Hangaren / Sosialt",
        organizer: "TIHLDE Sosialt",
        category: "Sosialt",
        capacity: null,
        registeredCount: 12,
    },
];

export const FINES: Fine[] = Array.from({ length: 18 }).map((_, i) => {
    const users = [
        "Conrad Osvik",
        "Iver Lindholm",
        "Mathias Strøm",
        "Stian Closs Walmann",
        "Mads Nylund",
        "Embret Roås",
    ];
    const paragraphs = [
        { p: "§4.00", title: "Skole på Innsjekk" },
        { p: "§1.00", title: "Oppmøte" },
        { p: "§9.00", title: "Navnemareritt i Git" },
        { p: "§3.00", title: "Klodrik" },
        { p: "§14.00", title: "Prod Brenning" },
    ];
    const u = users[i % users.length] ?? "Ukjent";
    const para = paragraphs[i % paragraphs.length] ?? paragraphs[0];
    if (!para) {
        return {
            id: `fine-${i}`,
            user: u,
            paragraph: "§0",
            title: "Ukjent",
            amount: 1,
            approved: false,
            paid: false,
            createdBy: "Mathias Strøm",
            date: "Mandag 27. april 16:30",
            reason: "Sier at han har jobbet på bachelor",
        };
    }
    return {
        id: `fine-${i}`,
        user: u,
        paragraph: para.p,
        title: para.title,
        amount: 1 + (i % 3),
        approved: i % 3 !== 0,
        paid: i % 4 === 0,
        createdBy: "Mathias Strøm",
        date: "Mandag 27. april 16:30",
        reason: "Sier at han har jobbet på bachelor",
    };
});

export const LAWS: Law[] = [
    {
        paragraph: "§1",
        title: "Oppmøte",
        description:
            "Ved ingen oppmøte og ingen beskjed gis 3 bøter. Ved beskjed 24 timer før om at en ikke kan møte, får man ikke bøter. (Jf. §1.02) Ved beskjed under 24 timer før om man kan møte eller ikke, er det 1 bot.",
        amount: 3,
    },
    {
        paragraph: "§1.01",
        title: "Sent oppmøte",
        description:
            "Ved for sent oppmøte (1 sekund etter oppsatt tid) tildeles 1 bot. Er det mer enn 5 min sen 2 bøter. Ved god grunn til forskinelse kan bøter bli vurdert",
        amount: 1,
    },
    {
        paragraph: "§1.02",
        title: "Sen melding",
        description:
            "Ved melding om at man ikke kommer eller kommer for sent under 24 timer blir en bot gitt. Unntak ved akutt sykdom.",
        amount: 3,
    },
    {
        paragraph: "§1.03",
        title: "Straffeunnvikelse",
        description: "Kommer ikke på botfest?? Uten gyldig grunn??",
        amount: 5,
    },
    {
        paragraph: "§2",
        title: "Jantelov",
        description:
            "Hvis man skryter av seg selv eller gjennomfører annen overdreven fremming av eget selvbilde, bøtelegges man med én (1) til tre (3) enheter.",
        amount: 1,
    },
    {
        paragraph: "§3",
        title: "Klodrik",
        description: "Ikke vær en klodrik",
        amount: 1,
    },
    {
        paragraph: "§4",
        title: "Skole på Innsjekk",
        description:
            "Ved snakk om skole på innsjekk koster det 1 bot (gjelder ikke om det er teknisk)",
        amount: 1,
    },
    {
        paragraph: "§4.01",
        title: "Dårlig innsjekk",
        description: "Ved å levere en dårlig innsjekk.",
        amount: 1,
    },
    {
        paragraph: "§5",
        title: "Quisling",
        description: "Bedrager!",
        amount: 1,
    },
    {
        paragraph: "§6",
        title: "Ikke overholdt arbeidsoppgave",
        description: "Ikke gjort det man skal.",
        amount: 1,
    },
    {
        paragraph: "§6.01",
        title: "En leders arbeidsoppgaver",
        description:
            "Om en leder bryter med sine arbeidsoppgaver, dvs. det går lengre perioder (min 2 uker) der deler av gruppa ikke har noe å gjøre/mangler oppfølging",
        amount: 2,
    },
    {
        paragraph: "§7",
        title: "Kommunalt Arbeid",
        description:
            "Ved arbeid på noe som ikke har med index å gjøre koster det 1 bot",
        amount: 1,
    },
    {
        paragraph: "§8",
        title: "Buzzman",
        description: "Ved overdreven bruk av Buzzwords",
        amount: 1,
    },
    {
        paragraph: "§9",
        title: "Navnemareritt i Git",
        description:
            "Hvis man navngir en branch feil. Ved gjentakende forseelser straffes man hardere. type(scope)/small-description",
        amount: 1,
    },
    {
        paragraph: "§10",
        title: "Ekstraordinær hendelse",
        description: "Ved en ekstraordinær hendelse",
        amount: 1,
    },
    {
        paragraph: "§10.01",
        title: "Yes, da var det intro",
        description: "Ny i Index krever bonus",
        amount: 5,
    },
    {
        paragraph: "§11",
        title: "Flink pike",
        description:
            "Hvis man har under 8 bøter innen rettsaken, vil man bli tilegnet bøter til man har 8 bøter.",
        amount: 8,
    },
    {
        paragraph: "§11.01",
        title: "Englebarn",
        description:
            "Om man får 0 bøter et semester blir det automatisk 12 bøter.",
        amount: 12,
    },
    {
        paragraph: "§12",
        title: "Nylund-paragrafen",
        description: "Være ufyselig",
        amount: 3,
    },
    {
        paragraph: "§12.01",
        title: "Spylund-paragrafen",
        description: "Spy på vors/fest",
        amount: 1,
    },
    {
        paragraph: "§13",
        title: "Mened",
        description:
            "Ved lyving i rettsak vil den tiltalte bli tildelt opp til 3 bøter gitt alvorlighet",
        amount: 2,
    },
    {
        paragraph: "§14",
        title: "Prod Brenning",
        description:
            "Hvis tiltalte har gjort en endring slik at produksjonsmiljøet (tihlde.org) går i fyr og flamme.",
        amount: 3,
    },
    {
        paragraph: "§15",
        title: "God Insj",
        description:
            "Ved et bra insj, f.eks hoste, kan hosten gi ut 1 bot til valgfri person.",
        amount: 1,
    },
    {
        paragraph: "§16",
        title: "Meldeplikt",
        description:
            "Om en person ved rettsak ikke har meldt en eneste sak på en av sine med-edb'er så vil personen bli tildelt 2 bøter",
        amount: 2,
    },
    {
        paragraph: "§17",
        title: "Slem gutt",
        description:
            "Den personen som har flest bøter ved slutten av en rettsak kan gi ut totalt 8 bøter, maks 2 per pers.",
        amount: 1,
    },
    {
        paragraph: "§18",
        title: "Sikkerhetshull",
        description:
            "Om en person pusher noe til prod som ender som et stort sikkerhetshull vi personen bli tildelt opp til 5 bøter gitt alvorligheten.",
        amount: 3,
    },
    {
        paragraph: "§19",
        title: "Maktmisbruk",
        description:
            "Om en person benytter sin makt i index til noe uetisk vil personen få 10 bøter!",
        amount: 10,
    },
    {
        paragraph: "§20",
        title: "Den glemte historien: Kode uten Kart og Kompott",
        description:
            "Ved opprettelse eller endring av endepunkt for Lepton, uten å oppdatere Codex dokumentasjon.",
        amount: 1,
    },
    {
        paragraph: "§21",
        title: "Rævslikker",
        description: "Rævslikker sjefen",
        amount: 3,
    },
    {
        paragraph: "§22",
        title: "10x dev",
        description:
            "Den som gjør ferdig en bug eller idé på bug-siden får lov å trekkes fra inntil 1 bot.",
        amount: -1,
    },
    {
        paragraph: "§22.01",
        title: "Tror du at du er bedre en sjefen??",
        description:
            "Om 50 bugs eller idéer løses i løpet av ett semester, blir 10 bøter lagt til hos leder.",
        amount: 10,
    },
];

export const FORMS: Form[] = [
    { id: "1", title: "Digitalisering av fadderuka", isOpen: true },
    { id: "2", title: "Opptak", isOpen: false },
];
