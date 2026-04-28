import { createFileRoute } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@tihlde/ui/ui/chart";
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxCollection,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
} from "@tihlde/ui/ui/combobox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@tihlde/ui/ui/input-group";
import { Separator } from "@tihlde/ui/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { Textarea } from "@tihlde/ui/ui/textarea";
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    HandCoins,
    ImagePlus,
    Info,
    Mail,
    Pencil,
    Plus,
    Scale,
    Search,
    Share2,
    Trash2,
    TrendingUp,
    User,
    Users,
    X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Dot,
    Line,
    LineChart,
    PolarAngleAxis,
    PolarGrid,
    Radar,
    RadarChart,
    XAxis,
} from "recharts";

import { EventCard, type EventCardProps } from "#/components/event-card";

export const Route = createFileRoute("/_app/grupper/$slug")({
    component: GroupDetailPage,
});

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

type Group = {
    name: string;
    description: string;
    contactEmail: string;
    leader: string;
    botSystemPraktisk: string;
    botSjef: string;
};

const GROUP: Group = {
    name: "Index",
    description:
        "Index jobber smidig med utviklingen av linjeforeningens løsninger, blant annet nettsiden du er inne på akkurat nå.",
    contactEmail: "teknologiminister@tihlde.org",
    leader: "Mathias Strøm",
    botSystemPraktisk: "Skyldig til motsatt bevist. Foreldring på 1 uke",
    botSjef: "Linde Agahd Vrenne",
};

const STUDY_OVER_TIME = [
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

const studyChartConfig = {
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

const MEMBERS_OVER_TIME = [
    { semester: "H22", medlemmer: 4, fill: "var(--color-h22)" },
    { semester: "V23", medlemmer: 9, fill: "var(--color-v23)" },
    { semester: "H23", medlemmer: 14, fill: "var(--color-h23)" },
    { semester: "V24", medlemmer: 18, fill: "var(--color-v24)" },
    { semester: "H24", medlemmer: 22, fill: "var(--color-h24)" },
    { semester: "V25", medlemmer: 24, fill: "var(--color-v25)" },
    { semester: "H25", medlemmer: 25, fill: "var(--color-h25)" },
    { semester: "V26", medlemmer: 26, fill: "var(--color-v26)" },
];

const membersChartConfig = {
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

const STUDY_RADAR = [
    { studie: "Dataingeniør", v26: 12 },
    { studie: "Forretning", v26: 9 },
    { studie: "Infrastruktur", v26: 4 },
    { studie: "Transformasjon", v26: 1 },
];

const radarChartConfig = {
    v26: { label: "V26", color: "var(--chart-1)" },
} satisfies ChartConfig;

type Member = { name: string; joined: string; until?: string; role?: string };

const LEADER: Member = {
    name: "Mathias Strøm",
    joined: "Lør 14. september 2024",
};

const MEMBERS: Member[] = [
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

const MEMBER_HISTORY: Member[] = [
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

const USERS: string[] = [LEADER.name, ...MEMBERS.map((m) => m.name)].sort(
    (a, b) => a.localeCompare(b),
);

const EVENTS: EventCardProps[] = [
    {
        title: "Generalforsamling med TIHLDE Utveksling",
        startsAt: "Tor 23. apr 18:00",
        location: "TIHLDE Utveksling / Zoom",
        category: "Foreningen",
    },
    {
        title: "Lightning Talks",
        startsAt: "Ons 22. apr 17:00",
        location: "Realfagbygget, Aud. S1 / Kurs",
        category: "Kurs",
    },
    {
        title: "Tøddelmåga!",
        startsAt: "Tor 30. apr 20:00",
        location: "TÖDDEL / Sosialt",
        category: "Sosialt",
    },
    {
        title: "Laptoplotteri",
        startsAt: "Fre 02. mai 14:00",
        location: "Hangaren / Sosialt",
        category: "Sosialt",
    },
];

type Fine = {
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

const FINES: Fine[] = Array.from({ length: 18 }).map((_, i) => {
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

type Law = {
    paragraph: string;
    title: string;
    description: string;
    amount: number;
};

const LAWS: Law[] = [
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

type Form = {
    id: string;
    title: string;
    isOpen: boolean;
};

const FORMS: Form[] = [
    { id: "1", title: "Digitalisering av fadderuka", isOpen: true },
    { id: "2", title: "Opptak", isOpen: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

type TriState = "all" | "yes" | "no";
type GroupingMode = "all" | "per-member";

function fineFilterMatches(fine: Fine, approved: TriState, paid: TriState) {
    if (approved === "yes" && !fine.approved) return false;
    if (approved === "no" && fine.approved) return false;
    if (paid === "yes" && !fine.paid) return false;
    if (paid === "no" && fine.paid) return false;
    return true;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type NavKey =
    | "om"
    | "medlemmer"
    | "arrangementer"
    | "boter"
    | "lovverk"
    | "sporreskjema";

type NavItem = { key: NavKey; label: string; icon: ReactNode };

const NAV_ITEMS: NavItem[] = [
    { key: "om", label: "Om", icon: <Info /> },
    { key: "medlemmer", label: "Medlemmer", icon: <Users /> },
    { key: "arrangementer", label: "Arrangementer", icon: <CalendarDays /> },
    { key: "boter", label: "Bøter", icon: <HandCoins /> },
    { key: "lovverk", label: "Lovverk", icon: <Scale /> },
    { key: "sporreskjema", label: "Spørreskjema", icon: <ClipboardList /> },
];

function GroupDetailPage() {
    const [active, setActive] = useState<NavKey>("om");
    const [fineDialogOpen, setFineDialogOpen] = useState(false);

    function openGiveFine() {
        setActive("boter");
        setFineDialogOpen(true);
    }

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <GroupHeader group={GROUP} onGiveFine={openGiveFine} />

            <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
                <aside>
                    <GroupSidebar active={active} onSelect={setActive} />
                </aside>

                <section className="flex flex-col gap-6">
                    {active === "om" ? <OmTab /> : null}
                    {active === "medlemmer" ? <MembersTab /> : null}
                    {active === "arrangementer" ? <EventsTab /> : null}
                    {active === "boter" ? <FinesTab /> : null}
                    {active === "lovverk" ? <LawsTab /> : null}
                    {active === "sporreskjema" ? <FormsTab /> : null}
                </section>
            </div>

            <GiveFineDialog
                open={fineDialogOpen}
                onOpenChange={setFineDialogOpen}
            />
        </div>
    );
}

function GroupSidebar({
    active,
    onSelect,
}: {
    active: NavKey;
    onSelect: (key: NavKey) => void;
}) {
    return (
        <nav className="flex flex-col gap-2">
            <ul className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                    <li key={item.key}>
                        <Button
                            variant={active === item.key ? "default" : "ghost"}
                            className="w-full justify-start"
                            onClick={() => onSelect(item.key)}
                        >
                            {item.icon}
                            <span className="flex-1 text-left">
                                {item.label}
                            </span>
                        </Button>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function GroupHeader({
    group,
    onGiveFine,
}: {
    group: Group;
    onGiveFine: () => void;
}) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
                <Avatar className="size-16">
                    <AvatarFallback>{initials(group.name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl">{group.name}</h1>
                    <p className="text-sm text-muted-foreground">
                        {group.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="gap-1.5">
                            <User />
                            {group.leader}
                        </Badge>
                        <Badge variant="outline" className="gap-1.5">
                            <Mail />
                            {group.contactEmail}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button onClick={onGiveFine}>
                    <HandCoins />
                    Gi bot
                </Button>
                <EditGroupDialog group={group} />
            </div>
        </div>
    );
}

function GiveFineDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [recipients, setRecipients] = useState<string[]>([]);
    const [law, setLaw] = useState<Law | null>(null);
    const [amount, setAmount] = useState<number>(1);

    function handleLawChange(next: Law | null) {
        setLaw(next);
        if (next) setAmount(next.amount);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Ny bot</DialogTitle>
                    <DialogDescription>
                        Opprett en ny bot for et lovbrudd
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4">
                    <FieldGroup>
                        <Field>
                            <FieldLabel>
                                Hvem har begått et lovbrudd? *
                            </FieldLabel>
                            <UserMultiCombobox
                                value={recipients}
                                onValueChange={setRecipients}
                                placeholder="Velg bruker..."
                            />
                            <p className="text-xs text-muted-foreground">
                                Du kan velge flere personer
                            </p>
                        </Field>

                        <Field>
                            <FieldLabel>Lovbrudd *</FieldLabel>
                            <LawCombobox
                                value={law}
                                onValueChange={handleLawChange}
                            />
                            {law ? (
                                <div className="mt-2 flex gap-3">
                                    <Separator
                                        orientation="vertical"
                                        className="h-auto self-stretch"
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        {law.description}
                                    </p>
                                </div>
                            ) : null}
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="fine-amount">
                                Forslag til antall bøter *
                            </FieldLabel>
                            <Input
                                id="fine-amount"
                                type="number"
                                value={amount}
                                onChange={(e) =>
                                    setAmount(Number(e.target.value))
                                }
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="fine-reason">
                                Begrunnelse *
                            </FieldLabel>
                            <Textarea
                                id="fine-reason"
                                rows={3}
                                placeholder="Skriv en kort begrunnelse..."
                            />
                        </Field>

                        <Field>
                            <FieldLabel>Bilde</FieldLabel>
                            <ImageDropzone />
                        </Field>
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Avbryt
                    </Button>
                    <Button>Opprett bot</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function UserMultiCombobox({
    value,
    onValueChange,
    placeholder,
}: {
    value: string[];
    onValueChange: (next: string[]) => void;
    placeholder?: string;
}) {
    const anchor = useComboboxAnchor();
    return (
        <Combobox
            items={USERS}
            multiple
            value={value}
            onValueChange={onValueChange}
        >
            <ComboboxChips ref={anchor}>
                <ComboboxValue>
                    {(selected: string[]) => (
                        <>
                            {selected.map((name) => (
                                <ComboboxChip key={name}>{name}</ComboboxChip>
                            ))}
                            <ComboboxChipsInput placeholder={placeholder} />
                        </>
                    )}
                </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent anchor={anchor}>
                <ComboboxList>
                    <ComboboxEmpty>Ingen treff</ComboboxEmpty>
                    <ComboboxCollection>
                        {(item: string) => (
                            <ComboboxItem key={item} value={item}>
                                {item}
                            </ComboboxItem>
                        )}
                    </ComboboxCollection>
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

function UserSingleCombobox({
    value,
    onValueChange,
    placeholder,
}: {
    value: string | null;
    onValueChange: (next: string | null) => void;
    placeholder?: string;
}) {
    return (
        <Combobox items={USERS} value={value} onValueChange={onValueChange}>
            <ComboboxInput placeholder={placeholder} />
            <ComboboxContent>
                <ComboboxList>
                    <ComboboxEmpty>Ingen treff</ComboboxEmpty>
                    <ComboboxCollection>
                        {(item: string) => (
                            <ComboboxItem key={item} value={item}>
                                {item}
                            </ComboboxItem>
                        )}
                    </ComboboxCollection>
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

function LawCombobox({
    value,
    onValueChange,
}: {
    value: Law | null;
    onValueChange: (next: Law | null) => void;
}) {
    return (
        <Combobox
            items={LAWS}
            value={value}
            onValueChange={onValueChange}
            itemToStringLabel={(item: Law) =>
                `${item.paragraph} - ${item.title}`
            }
            itemToStringValue={(item: Law) => item.paragraph}
            isItemEqualToValue={(a: Law, b: Law) => a.paragraph === b.paragraph}
        >
            <ComboboxInput placeholder="Velg paragraf..." />
            <ComboboxContent>
                <ComboboxList>
                    <ComboboxEmpty>Ingen treff</ComboboxEmpty>
                    <ComboboxCollection>
                        {(item: Law) => (
                            <ComboboxItem key={item.paragraph} value={item}>
                                <span className="flex flex-1 items-baseline justify-between gap-3">
                                    <span className="min-w-0 flex-1 break-words">
                                        {item.paragraph} - {item.title}
                                    </span>
                                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                                        {item.amount} bøter
                                    </span>
                                </span>
                            </ComboboxItem>
                        )}
                    </ComboboxCollection>
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

function ImageDropzone() {
    return (
        <Button
            type="button"
            variant="outline"
            className="flex h-auto w-full flex-col items-center justify-center gap-2 px-4 py-8"
        >
            <ImagePlus className="size-5" />
            <span>Klikk eller dra et bilde hit for å laste opp</span>
        </Button>
    );
}

function EditGroupDialog({ group }: { group: Group }) {
    return (
        <Dialog>
            <DialogTrigger
                render={
                    <Button variant="outline">
                        <Pencil />
                        Rediger gruppe
                    </Button>
                }
            />
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Rediger gruppen</DialogTitle>
                    <DialogDescription>
                        Her kan du redigere gruppenavn, beskrivelse, bilde og
                        kontaktperson.
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="group-name">
                                Gruppenavn *
                            </FieldLabel>
                            <Input
                                id="group-name"
                                defaultValue={group.name}
                                required
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Valgt bilde</FieldLabel>
                            <div className="flex items-center gap-2">
                                <div className="size-16 rounded-md bg-muted" />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                >
                                    <X />
                                    Fjern bilde
                                </Button>
                            </div>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="group-description">
                                Gruppebeskrivelse
                            </FieldLabel>
                            <Textarea
                                id="group-description"
                                rows={4}
                                defaultValue={group.description}
                            />
                            <p className="text-xs text-muted-foreground">
                                Hvordan formaterer jeg teksten?
                            </p>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="group-email">
                                Kontakt e-post
                            </FieldLabel>
                            <Input
                                id="group-email"
                                type="email"
                                defaultValue={group.contactEmail}
                            />
                        </Field>

                        <Separator />

                        <h3 className="text-sm font-medium">Botsystem</h3>
                        <Field>
                            <FieldLabel htmlFor="botsjef">Botsjef</FieldLabel>
                            <Input id="botsjef" defaultValue={group.botSjef} />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="botsystem">
                                Botsystem praktiske detaljer *
                            </FieldLabel>
                            <Textarea
                                id="botsystem"
                                rows={3}
                                defaultValue={group.botSystemPraktisk}
                            />
                            <p className="text-xs text-muted-foreground">
                                Hvordan formaterer jeg teksten?
                            </p>
                        </Field>
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <Button variant="outline">Avbryt</Button>
                    <Button>Oppdater</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Om
// ---------------------------------------------------------------------------

function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl">{title}</h2>
            {action}
        </div>
    );
}

function OmTab() {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Om" />
            <div className="grid gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-6">
                    <Card className="overflow-hidden p-0">
                        <img
                            src="/index-group.jpg"
                            alt="Index"
                            className="aspect-video size-full object-cover"
                        />
                    </Card>
                    <MembersOverTimeChart />
                    <StudyOverTimeChart />
                </div>

                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                        <h3 className="text-lg font-medium">Hva gjør Index?</h3>
                        <p className="text-sm text-muted-foreground">
                            Index er undergruppen i TIHLDE som drifter og
                            utvikler linjeforeningens digitale plattformer — fra
                            nettsiden du er inne på akkurat nå, til interne
                            verktøy som binder sammen arrangementer, opptak,
                            økonomi og kommunikasjon. Vi jobber smidig i
                            tverrfaglige team, eksperimenterer med moderne
                            verktøy og rammeverk, og prøver å gjøre det enklere
                            å være medlem i TIHLDE. Mye av det vi lager er åpen
                            kildekode, og vi tar gjerne imot bidrag og innspill
                            fra resten av foreningen.
                        </p>
                    </div>
                    <StudyRadarChart />
                </div>
            </div>
        </div>
    );
}

function ChartCell({
    title,
    description,
    children,
    trend,
    className,
}: {
    title: string;
    description?: string;
    children: ReactNode;
    trend?: string;
    className?: string;
}) {
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description ? (
                    <CardDescription>{description}</CardDescription>
                ) : null}
                {trend ? (
                    <CardAction>
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                            {trend}
                            <TrendingUp className="size-4" />
                        </span>
                    </CardAction>
                ) : null}
            </CardHeader>
            <CardContent className="flex-1">{children}</CardContent>
        </Card>
    );
}

function StudyOverTimeChart({ className }: { className?: string }) {
    return (
        <ChartCell
            className={className}
            title="Studieprogram over tid"
            description="H22 - V26"
            trend="+12% siste semester"
        >
            <ChartContainer config={studyChartConfig} className="size-full">
                <BarChart accessibilityLayer data={STUDY_OVER_TIME}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="semester"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                        dataKey="dataingenior"
                        stackId="a"
                        fill="var(--color-dataingenior)"
                        radius={[0, 0, 4, 4]}
                    />
                    <Bar
                        dataKey="forretning"
                        stackId="a"
                        fill="var(--color-forretning)"
                    />
                    <Bar
                        dataKey="infrastruktur"
                        stackId="a"
                        fill="var(--color-infrastruktur)"
                    />
                    <Bar
                        dataKey="transformasjon"
                        stackId="a"
                        fill="var(--color-transformasjon)"
                        radius={[4, 4, 0, 0]}
                    />
                </BarChart>
            </ChartContainer>
        </ChartCell>
    );
}

function MembersOverTimeChart({ className }: { className?: string }) {
    return (
        <ChartCell
            className={className}
            title="Aktive medlemmer"
            description="H22 - V26"
            trend="+4% siste semester"
        >
            <ChartContainer config={membersChartConfig} className="h-32 w-full">
                <LineChart
                    accessibilityLayer
                    data={MEMBERS_OVER_TIME}
                    margin={{ top: 24, left: 24, right: 24 }}
                >
                    <CartesianGrid vertical={false} />
                    <ChartTooltip
                        cursor={false}
                        content={
                            <ChartTooltipContent
                                indicator="line"
                                nameKey="medlemmer"
                                hideLabel
                            />
                        }
                    />
                    <Line
                        dataKey="medlemmer"
                        type="natural"
                        stroke="var(--color-medlemmer)"
                        strokeWidth={2}
                        dot={({ payload, cx, cy }) => (
                            <Dot
                                key={payload.semester}
                                r={5}
                                cx={cx}
                                cy={cy}
                                fill={payload.fill}
                                stroke={payload.fill}
                            />
                        )}
                    />
                </LineChart>
            </ChartContainer>
        </ChartCell>
    );
}

function StudyRadarChart({ className }: { className?: string }) {
    return (
        <ChartCell
            className={className}
            title="Programfordeling"
            description="V26"
        >
            <ChartContainer
                config={radarChartConfig}
                className="aspect-square w-full"
            >
                <RadarChart
                    data={STUDY_RADAR}
                    margin={{ top: 16, bottom: 16, left: 32, right: 32 }}
                    outerRadius="70%"
                >
                    <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="line" />}
                    />
                    <PolarAngleAxis dataKey="studie" />
                    <PolarGrid radialLines={false} />
                    <Radar
                        dataKey="v26"
                        fill="var(--color-v26)"
                        fillOpacity={0.2}
                        stroke="var(--color-v26)"
                        strokeWidth={2}
                    />
                </RadarChart>
            </ChartContainer>
        </ChartCell>
    );
}

// ---------------------------------------------------------------------------
// Medlemmer
// ---------------------------------------------------------------------------

function MembersTab() {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Medlemmer" action={<AddMemberDialog />} />

            <div className="flex flex-col gap-2">
                <h3 className="text-lg">Leder</h3>
                <MemberRow member={LEADER} />
            </div>

            <div className="flex flex-col gap-2">
                <h3 className="text-lg">Medlemmer ({MEMBERS.length})</h3>
                <ul className="flex flex-col gap-2">
                    {MEMBERS.map((m) => (
                        <li key={m.name}>
                            <MemberRow member={m} />
                        </li>
                    ))}
                </ul>
            </div>

            <h3 className="text-lg">Medlemshistorikk</h3>
            <ul className="flex flex-col gap-2">
                {MEMBER_HISTORY.map((m) => (
                    <li key={`${m.name}-${m.until ?? ""}`}>
                        <MemberRow member={m} historic />
                    </li>
                ))}
            </ul>
            <div className="flex justify-center">
                <Button variant="outline">Last inn mer</Button>
            </div>
        </div>
    );
}

function AddMemberDialog() {
    const [user, setUser] = useState<string | null>(null);

    return (
        <Dialog>
            <DialogTrigger
                render={
                    <Button size="sm">
                        <Plus />
                        Legg til
                    </Button>
                }
            />
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Legg til medlem</DialogTitle>
                    <DialogDescription>
                        Brukeren vil motta en epost/varsel om at de er lagt til
                        i gruppen.
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4">
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Søk etter bruker</FieldLabel>
                            <UserSingleCombobox
                                value={user}
                                onValueChange={setUser}
                                placeholder="Søk etter bruker"
                            />
                        </Field>
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <Button>Legg til medlem</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function MemberRow({
    member,
    historic = false,
}: {
    member: Member;
    historic?: boolean;
}) {
    return (
        <Card size="sm" className="flex-row items-center gap-3 px-3 py-2">
            <Avatar className="size-10">
                <AvatarFallback>{initials(member.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{member.name}</span>
                <span className="truncate text-sm text-muted-foreground">
                    {member.joined} → {historic ? member.until : "nå"}
                    {historic && member.role ? ` · ${member.role}` : ""}
                </span>
            </div>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Arrangementer
// ---------------------------------------------------------------------------

function EventsTab() {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Arrangementer" />
            <ul className="flex flex-col gap-3">
                {EVENTS.map((event) => (
                    <li key={event.title}>
                        <EventCard {...event} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Bøter
// ---------------------------------------------------------------------------

function FinesTab() {
    const [grouping, setGrouping] = useState<GroupingMode>("all");
    const [approved, setApproved] = useState<TriState>("all");
    const [paid, setPaid] = useState<TriState>("all");
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const filtered = useMemo(
        () => FINES.filter((f) => fineFilterMatches(f, approved, paid)),
        [approved, paid],
    );

    const grouped = useMemo(() => {
        const map = new Map<string, Fine[]>();
        for (const fine of filtered) {
            const list = map.get(fine.user) ?? [];
            list.push(fine);
            map.set(fine.user, list);
        }
        return map;
    }, [filtered]);

    const stats = useMemo(() => {
        const memberCount = MEMBERS.length;
        const ikkeGodkjent = 59;
        const godkjentIkkeBetalt = 939;
        const betalt = 1254;
        return {
            ikkeGodkjent,
            godkjentIkkeBetalt,
            betalt,
            avgIkkeGodkjent: (ikkeGodkjent / memberCount).toFixed(1),
            avgGodkjentIkkeBetalt: (godkjentIkkeBetalt / memberCount).toFixed(
                1,
            ),
            avgBetalt: (betalt / memberCount).toFixed(1),
        };
    }, []);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Bøter" />

            <div className="grid gap-4 md:grid-cols-3">
                <FineStatCard
                    label="Ikke godkjent"
                    value={stats.ikkeGodkjent}
                    perMember={stats.avgIkkeGodkjent}
                />
                <FineStatCard
                    label="Godkjent, ikke betalt"
                    value={stats.godkjentIkkeBetalt}
                    perMember={stats.avgGodkjentIkkeBetalt}
                />
                <FineStatCard
                    label="Betalt"
                    value={stats.betalt}
                    perMember={stats.avgBetalt}
                />
            </div>

            <div className="flex flex-col gap-3">
                <Tabs
                    value={grouping}
                    onValueChange={(v) => setGrouping(v as GroupingMode)}
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <TabsList>
                            <TabsTrigger value="all">Alle bøter</TabsTrigger>
                            <TabsTrigger value="per-member">
                                Per medlem
                            </TabsTrigger>
                        </TabsList>
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            <TriStateFilter
                                value={approved}
                                onChange={setApproved}
                                options={{
                                    all: "Alle",
                                    yes: "Godkjente",
                                    no: "Ikke godkjente",
                                }}
                            />
                            <TriStateFilter
                                value={paid}
                                onChange={setPaid}
                                options={{
                                    all: "Alle",
                                    yes: "Betalte",
                                    no: "Ikke betalte",
                                }}
                            />
                        </div>
                    </div>
                </Tabs>

                {grouping === "all" ? (
                    <ul className="flex flex-col gap-2">
                        {filtered.map((fine, index) => (
                            <li key={fine.id}>
                                <FineRow
                                    fine={fine}
                                    index={index + 1}
                                    onOpen={() => setOpenIndex(index)}
                                />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {Array.from(grouped.entries()).map(([user, list]) => (
                            <li key={user}>
                                <Card
                                    size="sm"
                                    className="flex-row items-center gap-3 px-3 py-2"
                                    role="button"
                                    onClick={() => {
                                        const i = filtered.findIndex(
                                            (f) => f.id === (list[0]?.id ?? ""),
                                        );
                                        setOpenIndex(i);
                                    }}
                                >
                                    <Avatar className="size-10">
                                        <AvatarFallback>
                                            {initials(user)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate font-medium">
                                            {user}
                                        </span>
                                        <span className="truncate text-sm text-muted-foreground">
                                            {list.length} bøter
                                        </span>
                                    </div>
                                    <ChevronRight />
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <FineDialog
                fines={filtered}
                openIndex={openIndex}
                onOpenChange={setOpenIndex}
            />
        </div>
    );
}

function FineStatCard({
    label,
    value,
    perMember,
}: {
    label: string;
    value: number | string;
    perMember: number | string;
}) {
    return (
        <Card size="sm">
            <CardContent className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-2xl font-medium">{value}</span>
                <span className="text-xs text-muted-foreground">
                    {perMember} per medlem
                </span>
            </CardContent>
        </Card>
    );
}

function TriStateFilter({
    value,
    onChange,
    options,
}: {
    value: TriState;
    onChange: (v: TriState) => void;
    options: Record<TriState, string>;
}) {
    return (
        <Tabs value={value} onValueChange={(v) => onChange(v as TriState)}>
            <TabsList>
                <TabsTrigger value="all">{options.all}</TabsTrigger>
                <TabsTrigger value="yes">{options.yes}</TabsTrigger>
                <TabsTrigger value="no">{options.no}</TabsTrigger>
            </TabsList>
        </Tabs>
    );
}

function FineRow({
    fine,
    index,
    onOpen,
}: {
    fine: Fine;
    index: number;
    onOpen: () => void;
}) {
    return (
        <Card
            size="sm"
            className="flex-row items-center gap-3 px-3 py-2"
            onClick={onOpen}
            role="button"
        >
            <span className="w-6 text-center font-medium">{index}</span>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1 truncate font-medium">
                    {fine.user}
                    {fine.approved ? (
                        <Badge variant="outline">Godkjent</Badge>
                    ) : null}
                    {fine.paid ? (
                        <Badge variant="secondary" className="gap-1">
                            <HandCoins />
                            Betalt
                        </Badge>
                    ) : null}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                    {fine.paragraph} - {fine.title}
                </span>
            </div>
            <ChevronRight />
        </Card>
    );
}

function FineDialog({
    fines,
    openIndex,
    onOpenChange,
}: {
    fines: Fine[];
    openIndex: number | null;
    onOpenChange: (i: number | null) => void;
}) {
    const fine = openIndex !== null ? fines[openIndex] : null;

    function go(delta: number) {
        if (openIndex === null) return;
        const next = openIndex + delta;
        if (next < 0 || next >= fines.length) return;
        onOpenChange(next);
    }

    return (
        <Dialog
            open={fine !== null}
            onOpenChange={(open) => {
                if (!open) onOpenChange(null);
            }}
        >
            <DialogContent className="max-w-lg">
                {fine ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>
                                {fine.paragraph} - {fine.title}
                            </DialogTitle>
                            <DialogDescription>{fine.user}</DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2">
                                <Badge
                                    variant={
                                        fine.approved ? "default" : "outline"
                                    }
                                >
                                    {fine.approved
                                        ? "Godkjent"
                                        : "Ikke godkjent"}
                                </Badge>
                                <Badge
                                    variant={fine.paid ? "default" : "outline"}
                                >
                                    {fine.paid ? "Betalt" : "Ikke betalt"}
                                </Badge>
                            </div>
                            <div className="text-sm">
                                <p>Opprettet av: {fine.createdBy}</p>
                                <p>Dato: {fine.date}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground">
                                    Begrunnelse
                                </span>
                                <p className="text-sm">{fine.reason}</p>
                            </div>
                            <div className="aspect-video w-full rounded-md bg-muted" />
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline">
                                    Merk som godkjent
                                </Button>
                                <Button size="sm" variant="outline">
                                    Merk som betalt
                                </Button>
                                <Button size="sm" variant="outline">
                                    <Pencil />
                                    Rediger bot
                                </Button>
                                <Button size="sm" variant="outline">
                                    <Trash2 />
                                    Slett bot
                                </Button>
                            </div>
                        </div>
                        <DialogFooter className="justify-between sm:justify-between">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => go(-1)}
                                disabled={openIndex === 0}
                            >
                                <ChevronLeft />
                                Forrige
                            </Button>
                            <span className="self-center text-xs text-muted-foreground">
                                {openIndex !== null ? openIndex + 1 : 0} /{" "}
                                {fines.length}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => go(1)}
                                disabled={
                                    openIndex !== null &&
                                    openIndex >= fines.length - 1
                                }
                            >
                                Neste
                                <ChevronRight />
                            </Button>
                        </DialogFooter>
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Lovverk
// ---------------------------------------------------------------------------

function LawsTab() {
    const [editing, setEditing] = useState<Law | null>(null);
    const [creating, setCreating] = useState(false);
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return LAWS;
        return LAWS.filter(
            (law) =>
                law.paragraph.toLowerCase().includes(q) ||
                law.title.toLowerCase().includes(q) ||
                law.description.toLowerCase().includes(q),
        );
    }, [query]);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Lovverk"
                action={
                    <Button onClick={() => setCreating(true)}>
                        <Plus />
                        Ny lovparagraf
                    </Button>
                }
            />

            <InputGroup>
                <InputGroupAddon>
                    <Search />
                </InputGroupAddon>
                <InputGroupInput
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Søk i lovverket..."
                />
            </InputGroup>

            <ol className="flex flex-col">
                {filtered.map((law) => (
                    <li key={law.paragraph}>
                        <LawItem law={law} onEdit={() => setEditing(law)} />
                    </li>
                ))}
            </ol>

            <LawFormDialog
                open={editing !== null || creating}
                law={editing}
                onClose={() => {
                    setEditing(null);
                    setCreating(false);
                }}
            />
        </div>
    );
}

function LawItem({ law, onEdit }: { law: Law; onEdit: () => void }) {
    return (
        <Button
            variant="ghost"
            onClick={onEdit}
            className="flex h-auto w-full flex-col items-stretch gap-3 px-4 py-4 text-left whitespace-normal"
        >
            <div className="flex items-baseline gap-3">
                <h3 className="font-medium">
                    {law.paragraph} - {law.title}
                </h3>
                <span className="text-sm text-muted-foreground">
                    Bøter: {law.amount}
                </span>
            </div>
            <p className="pl-6 text-sm text-muted-foreground">
                {law.description}
            </p>
        </Button>
    );
}

function LawFormDialog({
    open,
    law,
    onClose,
}: {
    open: boolean;
    law: Law | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) onClose();
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {law ? "Rediger lovparagraf" : "Ny lovparagraf"}
                    </DialogTitle>
                    <DialogDescription>
                        {law
                            ? "Oppdater paragrafen for gruppen"
                            : "Opprett en ny lovparagraf for gruppen"}
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="law-paragraph">
                                Paragraf *
                            </FieldLabel>
                            <Input
                                id="law-paragraph"
                                defaultValue={law?.paragraph ?? "1"}
                            />
                            <p className="text-xs text-muted-foreground">
                                Heltall for overskrift. Maks 2 siffer på hver
                                side av komma
                            </p>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="law-title">
                                Tittel *
                            </FieldLabel>
                            <Input
                                id="law-title"
                                defaultValue={law?.title ?? ""}
                                placeholder="Skriv her..."
                            />
                            <p className="text-xs text-muted-foreground">
                                For eks.: Forsentkomming
                            </p>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="law-description">
                                Beskrivelse
                            </FieldLabel>
                            <Textarea
                                id="law-description"
                                rows={4}
                                defaultValue={law?.description ?? ""}
                                placeholder="Skriv her..."
                            />
                            <p className="text-xs text-muted-foreground">
                                La stå tom for å ikke kunne velges ved
                                botgivning
                            </p>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="law-amount">
                                Veiledende antall bøter *
                            </FieldLabel>
                            <Input
                                id="law-amount"
                                type="number"
                                defaultValue={law?.amount ?? 1}
                            />
                            <p className="text-xs text-muted-foreground">
                                Brukes for å forhåndsutfylle antall bøter når
                                det lages en ny
                            </p>
                        </Field>
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Avbryt
                    </Button>
                    <Button>{law ? "Oppdater" : "Opprett"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Spørreskjema
// ---------------------------------------------------------------------------

function FormsTab() {
    const [creating, setCreating] = useState(false);
    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Spørreskjema"
                action={
                    <Button onClick={() => setCreating(true)}>
                        <Plus />
                        Nytt spørreskjema
                    </Button>
                }
            />
            <ul className="flex flex-col gap-3">
                {FORMS.map((form) => (
                    <li key={form.id}>
                        <FormRow form={form} />
                    </li>
                ))}
            </ul>
            <NewFormDialog open={creating} onClose={() => setCreating(false)} />
        </div>
    );
}

function FormRow({ form }: { form: Form }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{form.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {!form.isOpen ? (
                    <p className="text-sm text-muted-foreground">
                        Spørreskjemaet er ikke åpent for innsending av svar. Du
                        må åpne spørreskjemaet for innsending for å kunne svare
                        på og dele skjemaet.
                    </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm">
                        Administrer
                    </Button>
                    <Button variant="outline" size="sm">
                        Svar på/se skjema
                    </Button>
                    <Button variant="outline" size="sm">
                        <Share2 />
                        Del
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function NewFormDialog({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) onClose();
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Nytt spørreskjema</DialogTitle>
                    <DialogDescription>
                        Alle TIHLDE-medlemmer vil kunne svare på skjemaet, flere
                        ganger om de ønsker. Du kan legge til spørsmål etter at
                        du har opprettet skjemaet. Spørsmålene kan endres helt
                        til noen har svart på skjemaet.
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="form-title">
                                Tittel *
                            </FieldLabel>
                            <Input
                                id="form-title"
                                placeholder="Skriv her..."
                                required
                            />
                        </Field>
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Avbryt
                    </Button>
                    <Button>Opprett spørreskjema</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
