import { createFileRoute } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Separator } from "@tihlde/ui/ui/separator";
import {
    Bell,
    CalendarDays,
    Github,
    HelpCircle,
    LayoutGrid,
    Linkedin,
    LogOut,
    Pencil,
    Plus,
    QrCode,
    Settings,
    ShieldCheck,
    Ticket,
    UserCircle2,
} from "lucide-react";
import { useState, type ReactNode } from "react";

export const Route = createFileRoute("/_app/profil/$id")({
    component: ProfilePage,
});

type ProfileUser = {
    name: string;
    username: string;
    email: string;
    programme: string;
    avatarUrl?: string;
    links: { kind: "github" | "linkedin"; label: string }[];
};

type StatCard = {
    label: string;
    title: string;
    description: string;
};

type UpcomingEvent = {
    title: string;
    meta: string;
    status: string;
    statusVariant: "default" | "secondary" | "outline";
};

type TodoItem = {
    title: string;
    meta: string;
    action: string;
};

type NavKey =
    | "oversikt"
    | "arrangementer"
    | "medlemskap"
    | "prikker"
    | "spørreskjemaer"
    | "innstillinger"
    | "admin";

const USER: ProfileUser = {
    name: "Aleksander Hjortkær Sand Evensen",
    username: "ahevense",
    email: "ahevense@stud.ntnu.no",
    programme: "2. klasse Dataingeniør",
    links: [
        { kind: "github", label: "github" },
        { kind: "linkedin", label: "linkedin" },
    ],
};

const STATS: StatCard[] = [
    {
        label: "NESTE ARRANGEMENT",
        title: "Bedpres · Bekk",
        description: "tor 24. apr · 17:00",
    },
    {
        label: "MEDLEMSKAP",
        title: "Aktiv",
        description: "fornyes 2026-08-01",
    },
    {
        label: "PRIKKER",
        title: "0 aktive",
        description: "alt i orden",
    },
];

const UPCOMING: UpcomingEvent[] = [
    {
        title: "Bedpres · Bekk",
        meta: "tor 24. apr · Realfagbygget R2",
        status: "påmeldt",
        statusVariant: "secondary",
    },
    {
        title: "Fagkveld: AI & produksjon",
        meta: "ons 30. apr · Digs",
        status: "venteliste #3",
        statusVariant: "outline",
    },
];

const TODOS: TodoItem[] = [
    {
        title: "Spørreskjema: Vårfest 2026",
        meta: "utløper om 3 dager",
        action: "Svar",
    },
];

function ProfilePage() {
    const [active, setActive] = useState<NavKey>("oversikt");

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <ProfileHeader user={USER} />

            <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
                <aside>
                    <ProfileSidebar active={active} onSelect={setActive} />
                </aside>

                <section className="flex flex-col gap-6">
                    <OverviewHeader />
                    <StatGrid stats={STATS} />
                    <UpcomingSection events={UPCOMING} />
                    <TodoSection todos={TODOS} />
                </section>
            </div>
        </div>
    );
}

function ProfileHeader({ user }: { user: ProfileUser }) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
                <Avatar size="lg" className="size-16">
                    {user.avatarUrl ? (
                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                    ) : null}
                    <AvatarFallback>
                        {user.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")}
                    </AvatarFallback>
                </Avatar>

                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl">{user.name}</h1>
                    <p className="text-sm text-muted-foreground">
                        {user.username} · {user.email} · {user.programme}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {user.links.map((link) => (
                            <Badge
                                key={link.kind}
                                variant="outline"
                                className="gap-1.5"
                            >
                                {link.kind === "github" ? (
                                    <Github />
                                ) : (
                                    <Linkedin />
                                )}
                                {link.label}
                            </Badge>
                        ))}
                        <Badge variant="secondary" className="gap-1.5">
                            <Plus />
                            add link
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline">
                    <QrCode />
                    Medlemsbevis
                </Button>
                <Button>
                    <Pencil />
                    Rediger bio
                </Button>
            </div>
        </div>
    );
}

type NavItem = {
    key: NavKey;
    label: string;
    icon: ReactNode;
};

const PRIMARY_NAV: NavItem[] = [
    { key: "oversikt", label: "Oversikt", icon: <LayoutGrid /> },
    { key: "arrangementer", label: "Arrangementer", icon: <CalendarDays /> },
    { key: "medlemskap", label: "Medlemskap", icon: <UserCircle2 /> },
    { key: "prikker", label: "Prikker", icon: <Ticket /> },
    { key: "spørreskjemaer", label: "Spørreskjemaer", icon: <HelpCircle /> },
];

const SECONDARY_NAV: NavItem[] = [
    { key: "innstillinger", label: "Innstillinger", icon: <Settings /> },
    { key: "admin", label: "Admin", icon: <ShieldCheck /> },
];

function ProfileSidebar({
    active,
    onSelect,
}: {
    active: NavKey;
    onSelect: (key: NavKey) => void;
}) {
    return (
        <nav className="flex flex-col gap-2">
            <ul className="flex flex-col gap-1">
                {PRIMARY_NAV.map((item) => (
                    <SidebarItem
                        key={item.key}
                        item={item}
                        active={active === item.key}
                        onSelect={onSelect}
                    />
                ))}
            </ul>
            <Separator className="my-2" />
            <ul className="flex flex-col gap-1">
                {SECONDARY_NAV.map((item) => (
                    <SidebarItem
                        key={item.key}
                        item={item}
                        active={active === item.key}
                        onSelect={onSelect}
                    />
                ))}
            </ul>
            <Separator className="my-2" />
            <Button variant="ghost" className="justify-start">
                <LogOut />
                Logg ut
            </Button>
        </nav>
    );
}

function SidebarItem({
    item,
    active,
    onSelect,
}: {
    item: NavItem;
    active: boolean;
    onSelect: (key: NavKey) => void;
}) {
    return (
        <li>
            <Button
                variant={active ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => onSelect(item.key)}
            >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
            </Button>
        </li>
    );
}

function OverviewHeader() {
    return (
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl">Oversikt</h2>
                <p className="text-sm text-muted-foreground">
                    Velkommen tilbake, Aleksander
                </p>
            </div>
            <Badge variant="outline" className="gap-1.5">
                <Bell />2 nye varsler
            </Badge>
        </div>
    );
}

function StatGrid({ stats }: { stats: StatCard[] }) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            {stats.map((stat) => (
                <Card key={stat.label} size="sm">
                    <CardContent className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                            {stat.label}
                        </span>
                        <span className="font-medium">{stat.title}</span>
                        <span className="text-sm text-muted-foreground">
                            {stat.description}
                        </span>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function UpcomingSection({ events }: { events: UpcomingEvent[] }) {
    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-xs text-muted-foreground">KOMMENDE</h3>
            <ul className="flex flex-col gap-3">
                {events.map((event) => (
                    <li key={event.title}>
                        <Card size="sm" className="flex-row items-center gap-3">
                            <div
                                className="ml-3 size-10 shrink-0 rounded-md bg-muted"
                                aria-hidden
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-medium">
                                    {event.title}
                                </span>
                                <span className="truncate text-sm text-muted-foreground">
                                    {event.meta}
                                </span>
                            </div>
                            <div className="pr-3">
                                <Badge variant={event.statusVariant}>
                                    {event.status}
                                </Badge>
                            </div>
                        </Card>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function TodoSection({ todos }: { todos: TodoItem[] }) {
    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-xs text-muted-foreground">MÅ GJØRES</h3>
            <ul className="flex flex-col gap-3">
                {todos.map((todo) => (
                    <li key={todo.title}>
                        <Card size="sm" className="flex-row items-center gap-3">
                            <div
                                className="ml-3 flex size-10 shrink-0 items-center justify-center rounded-md bg-muted"
                                aria-hidden
                            >
                                <HelpCircle className="size-5" />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-medium">
                                    {todo.title}
                                </span>
                                <span className="truncate text-sm text-muted-foreground">
                                    {todo.meta}
                                </span>
                            </div>
                            <div className="pr-3">
                                <Button size="sm">{todo.action}</Button>
                            </div>
                        </Card>
                    </li>
                ))}
            </ul>
        </div>
    );
}
