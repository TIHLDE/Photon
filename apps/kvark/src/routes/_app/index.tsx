import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
    CatchBoundary,
    Link,
    type LinkProps,
    createFileRoute,
} from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { EventCalendar } from "@tihlde/ui/complex/event-calendar";
import { Reveal, Stagger } from "@tihlde/ui/ui/motion";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { Plus } from "lucide-react";
import { type ReactNode, Suspense } from "react";

import { authQueryOptions } from "#/api/auth";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { getEventsQuery } from "#/api/queries/events";
import { getNewsQuery } from "#/api/queries/news";
import { getVisibleBannersQuery } from "#/api/queries/banners";
import { EventCard } from "#/components/event-card";
import { InfoBanner } from "#/components/info-banner";
import { NewsCard } from "#/components/news-card";
import { SectionError } from "#/components/section-error";
import { TihldeLogo } from "#/components/icons/tihlde";
import { HeroSectionBackground } from "#/components/hero-section";
import { formatEventDateTime } from "#/lib/event";
import {
    ACTIVITY_CATEGORIES,
    BEDPRES_CATEGORIES,
    EVENT_CATEGORIES,
} from "#/lib/event-categories";
import { formatNewsDateRelative } from "#/lib/news";

/**
 * Hver type har sin egen liste på forsida. Bedpressene er trukket ut av
 * «Arrangementer», og aktiviteter vises i seksjonen under i stedet.
 * Kalenderen viser arrangementer og bedpresser sammen, men ikke aktiviteter.
 */
const ACTIVITY_SLUGS = ACTIVITY_CATEGORIES.map((category) => category.value);
const BEDPRES_SLUGS = BEDPRES_CATEGORIES.map((category) => category.value);
const CALENDAR_SLUGS = EVENT_CATEGORIES.map((category) => category.value);
const EVENT_SLUGS = CALENDAR_SLUGS.filter(
    (slug) => !BEDPRES_SLUGS.includes(slug),
);

/** Tre i hver spalte — resten ligger på arrangementssida. */
const LIST_PREVIEW_COUNT = 3;

/** Upcoming events, ordered by start time by the API. */
const upcomingEventsQuery = () =>
    getEventsQuery(
        0,
        { expired: false, category: EVENT_SLUGS },
        LIST_PREVIEW_COUNT,
    );

const upcomingBedpresQuery = () =>
    getEventsQuery(
        0,
        { expired: false, category: BEDPRES_SLUGS },
        LIST_PREVIEW_COUNT,
    );

/** Nok arrangementer til å fylle en måned i kalenderen. */
const CALENDAR_PAGE_SIZE = 50;

/**
 * Kalenderen henter sitt eget utvalg. Panelet er avmontert til fanen velges,
 * så spørringen koster ingenting for de som blir stående i lista.
 */
const calendarEventsQuery = () =>
    getEventsQuery(
        0,
        { expired: false, category: CALENDAR_SLUGS },
        CALENDAR_PAGE_SIZE,
    );

/** Seks aktiviteter, fordelt på to spalter. */
const ACTIVITIES_PREVIEW_COUNT = 6;
const upcomingActivitiesQuery = () =>
    getEventsQuery(
        0,
        { expired: false, category: ACTIVITY_SLUGS },
        ACTIVITIES_PREVIEW_COUNT,
    );

/** The three newest news items, ordered by the API. */
const NEWS_PREVIEW_COUNT = 3;
const latestNewsQuery = () => getNewsQuery(0, {}, NEWS_PREVIEW_COUNT);

export const Route = createFileRoute("/_app/")({
    component: Home,
    // Bare arrangementene blokkerer — de er grunnen til at forsida finnes.
    // Bannere og nyheter henter seg selv bak hver sin Suspense- og feilgrense,
    // så et feilende kall der koster oss den seksjonen og ikke hele sida.
    loader: ({ context }) =>
        Promise.all([
            context.queryClient.ensureQueryData(upcomingBedpresQuery()),
            context.queryClient.ensureQueryData(upcomingEventsQuery()),
        ]),
});

function Home() {
    // Admin-only shortcuts — the API enforces these permissions server-side
    // too. Any-scope: a group-scoped events:create is a real grant, and
    // hiding the shortcut from that user would take away work they may do.
    const canCreateEvent = useAnyScopePermission([
        "events:create",
        "events:manage",
    ]);
    const canCreateNews = useAnyScopePermission(["news:create", "news:manage"]);

    return (
        <>
            {/* Bannerne bor inne i heroen, ikke foran den: de deler
             * førsteskjermen med den i stedet for å skyve den nedover.
             * Bannere er beskjeder vi av og til har. Både mens de lastes og
             * hvis de feiler er riktig svar det samme: ingenting. */}
            <Hero
                banners={
                    <CatchBoundary
                        getResetKey={() => "banners"}
                        errorComponent={() => null}
                    >
                        <Suspense fallback={null}>
                            <BannersSection />
                        </Suspense>
                    </CatchBoundary>
                }
            />

            {/* Én komponent: overskrifta står på linje med fanene og «Nytt
             * arrangement», og de styrer begge spaltene. Lista er to spalter
             * — arrangementer til venstre, bedpres til høyre — og kalenderen
             * ett bilde av alt sammen. */}
            <section className="container mx-auto w-full px-4 py-8">
                <Tabs defaultValue="list">
                    <Reveal
                        render={
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2" />
                        }
                    >
                        <h2 className="min-w-0 text-2xl">Arrangementer</h2>
                        <div className="flex flex-wrap items-center gap-2">
                            {canCreateEvent ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    render={
                                        <Link to="/admin/arrangementer/ny" />
                                    }
                                >
                                    <Plus />
                                    Nytt arrangement
                                </Button>
                            ) : null}
                            <TabsList>
                                <TabsTrigger value="list">Liste</TabsTrigger>
                                <TabsTrigger value="calendar">
                                    Kalender
                                </TabsTrigger>
                            </TabsList>
                        </div>
                    </Reveal>

                    <TabsContent value="list">
                        <div className="mt-4 grid gap-8 lg:grid-cols-2">
                            <Suspense
                                fallback={
                                    <EventListSkeleton
                                        count={LIST_PREVIEW_COUNT}
                                    />
                                }
                            >
                                <EventsSection />
                            </Suspense>

                            <CatchBoundary
                                getResetKey={() => "bedpres"}
                                errorComponent={BedpresUnavailable}
                            >
                                <Suspense
                                    fallback={
                                        <EventListSkeleton
                                            count={LIST_PREVIEW_COUNT}
                                        />
                                    }
                                >
                                    <BedpresSection />
                                </Suspense>
                            </CatchBoundary>
                        </div>
                    </TabsContent>

                    <TabsContent value="calendar">
                        <CatchBoundary
                            getResetKey={() => "calendar"}
                            errorComponent={CalendarUnavailable}
                        >
                            <Suspense fallback={<CalendarSkeleton />}>
                                <EventsCalendarSection />
                            </Suspense>
                        </CatchBoundary>
                    </TabsContent>
                </Tabs>
            </section>

            <section className="container mx-auto w-full px-4 py-8">
                <SectionHeader
                    title="Aktiviteter"
                    actionLabel={canCreateEvent ? "Ny aktivitet" : undefined}
                    actionTo="/admin/arrangementer/ny"
                />
                <CatchBoundary
                    getResetKey={() => "activities"}
                    errorComponent={ActivitiesUnavailable}
                >
                    <Suspense fallback={<ActivitiesSkeleton />}>
                        <ActivitiesSection />
                    </Suspense>
                </CatchBoundary>
            </section>

            <section className="container mx-auto w-full px-4 py-8">
                <SectionHeader
                    title="Nyheter"
                    actionLabel={canCreateNews ? "Ny nyhet" : undefined}
                    actionTo="/admin/nyheter"
                    actionSearch={{ ny: true }}
                />
                <CatchBoundary
                    getResetKey={() => "news"}
                    errorComponent={NewsUnavailable}
                >
                    <Suspense fallback={<NewsSkeleton />}>
                        <NewsSection />
                    </Suspense>
                </CatchBoundary>
            </section>
        </>
    );
}

function BannersSection() {
    const { data: banners } = useSuspenseQuery(getVisibleBannersQuery());

    if (banners.length === 0) return null;

    return (
        <div className="container mx-auto flex w-full flex-col gap-2 px-4 pt-4">
            {banners.map((banner) => (
                <InfoBanner
                    key={banner.id}
                    title={banner.title}
                    description={banner.description}
                    url={banner.url}
                    linkText={banner.linkText}
                    openInNewTab={banner.openInNewTab}
                />
            ))}
        </div>
    );
}

function BedpresSection() {
    const { data } = useSuspenseQuery(upcomingBedpresQuery());
    const bedpres = data.items;

    if (bedpres.length === 0) return null;

    return (
        <Stagger render={<div className="flex flex-col gap-4" />}>
            {bedpres.map((event) => (
                <EventCard
                    key={event.id}
                    slug={event.slug}
                    title={event.title}
                    startsAt={formatEventDateTime(event.startTime)}
                    location={event.location ?? ""}
                    organizer={event.organizer?.name ?? ""}
                    category={event.category?.label}
                    imageUrl={event.image || undefined}
                    imageAlt={event.imageAlt || undefined}
                />
            ))}
        </Stagger>
    );
}

/** Bedpressene er ikke verdt en feilside — resten av forsida står. */
function BedpresUnavailable() {
    return (
        <SectionError message="Vi fikk ikke lastet bedriftsarrangementene." />
    );
}

function EventsSection() {
    const { data } = useSuspenseQuery(upcomingEventsQuery());
    const events = data.items;

    if (events.length === 0) return null;

    return (
        <Stagger render={<div className="flex flex-col gap-4" />}>
            {events.map((event) => (
                <EventCard
                    key={event.id}
                    slug={event.slug}
                    title={event.title}
                    startsAt={formatEventDateTime(event.startTime)}
                    location={event.location ?? ""}
                    organizer={event.organizer?.name ?? ""}
                    category={event.category?.label}
                    imageUrl={event.image || undefined}
                    imageAlt={event.imageAlt || undefined}
                />
            ))}
        </Stagger>
    );
}

function EventsCalendarSection() {
    const { data } = useSuspenseQuery(calendarEventsQuery());

    return (
        <div className="mt-4">
            <EventCalendar
                events={data.items.map((event) => ({
                    id: event.id,
                    title: event.title,
                    start: event.startTime,
                    render: (
                        <Link
                            to="/arrangementer/$slug"
                            params={{ slug: event.slug }}
                        />
                    ),
                }))}
            />
        </div>
    );
}

/** Kalenderen er én fane av to — lista står selv om denne feiler. */
function CalendarUnavailable() {
    return <SectionError message="Vi fikk ikke lastet kalenderen." />;
}

function ActivitiesSection() {
    const { data } = useSuspenseQuery(upcomingActivitiesQuery());
    const activities = data.items;

    if (activities.length === 0) return null;

    return (
        <Stagger render={<ul className="mt-4 grid gap-8 lg:grid-cols-2" />}>
            {activities.map((activity) => (
                <li key={activity.id}>
                    <EventCard
                        slug={activity.slug}
                        title={activity.title}
                        startsAt={formatEventDateTime(activity.startTime)}
                        location={activity.location ?? ""}
                        organizer={activity.organizer?.name ?? ""}
                        category={activity.category?.label}
                        imageUrl={activity.image || undefined}
                        imageAlt={activity.imageAlt || undefined}
                    />
                </li>
            ))}
        </Stagger>
    );
}

function ActivitiesUnavailable() {
    return <SectionError message="Vi fikk ikke lastet aktivitetene." />;
}

function ActivitiesSkeleton() {
    return (
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
            {Array.from({ length: ACTIVITIES_PREVIEW_COUNT }, (_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
            ))}
        </div>
    );
}

function NewsSection() {
    const { data } = useSuspenseQuery(latestNewsQuery());
    const news = data.items;

    if (news.length === 0) return null;

    return (
        <Stagger
            render={
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
            }
        >
            {news.map((item) => (
                <li key={item.id}>
                    <NewsCard
                        slug={item.id}
                        title={item.title}
                        excerpt={item.header ?? ""}
                        publishedAt={formatNewsDateRelative(item.createdAt)}
                        imageUrl={item.imageUrl || undefined}
                    />
                </li>
            ))}
        </Stagger>
    );
}

/** Nyhetene er ikke verdt en feilside — vi sier fra og lar resten stå. */
function NewsUnavailable() {
    return <SectionError message="Vi fikk ikke lastet nyhetene." />;
}

function NewsSkeleton() {
    return (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: NEWS_PREVIEW_COUNT }, (_, i) => (
                <Skeleton key={i} className="h-64 w-full" />
            ))}
        </div>
    );
}

function EventListSkeleton({ count }: { count: number }) {
    return (
        <div className="flex flex-col gap-4">
            {Array.from({ length: count }, (_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
            ))}
        </div>
    );
}

function CalendarSkeleton() {
    return <Skeleton className="mt-4 h-96 w-full" />;
}

function Hero({ banners }: { banners?: ReactNode }) {
    // The hero fills exactly the space the first screen actually offers, so its
    // content lands on the optical centre on every device instead of drifting
    // low: 100svh (stable while mobile browser chrome hides and shows) minus
    // the 3.5rem header, and below lg also the fixed bottom bar with its
    // safe-area inset. The padding is the floor for short viewports, where the
    // content is taller than the space available.
    //
    // Bannerne står øverst i den samme kolonna og tar høyden de trenger;
    // seksjonen under er `flex-1` og sentrerer seg i det som er igjen. Da blir
    // heroen like høy med og uten bannere — de spiser av plassen inni den i
    // stedet for å skyve den ned — og de kan aldri legge seg oppå innholdet.
    return (
        <div className="relative flex min-h-[calc(100svh_-_3.5rem_-_4rem_-_env(safe-area-inset-bottom))] flex-col lg:min-h-[calc(100svh_-_3.5rem)]">
            <HeroSectionBackground className="text-primary -z-50" />
            {banners}
            {/* Logo, blurb and actions are the section's three direct children,
             * so Stagger walks them in that reading order on its own. */}
            <Stagger
                render={
                    <section className="container mx-auto flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center" />
                }
            >
                <div
                    className="flex items-center"
                    style={{ color: "var(--color-logo, currentColor)" }}
                >
                    <TihldeLogo variant="full" className="h-14 w-auto" />
                </div>
                <p className="max-w-2xl text-balance">
                    Linjeforeningen for Dataingeniør, Digital infrastruktur og
                    cybersikkerhet, Digital forretningsutvikling, Digital
                    transformasjon og Informasjonsbehandling ved NTNU.
                </p>
                <HeroActions />
            </Stagger>
        </div>
    );
}

function HeroActions() {
    const { data: session } = useQuery(authQueryOptions);

    if (session?.user) {
        return (
            <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                    size="lg"
                    render={<Link to="/profil/$id" params={{ id: "me" }} />}
                >
                    Min profil
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="lg" render={<Link to="/login" />}>
                Logg inn
            </Button>
            <Button
                size="lg"
                variant="outline"
                render={<Link to="/register" />}
            >
                Opprett bruker
            </Button>
        </div>
    );
}

function SectionHeader({
    title,
    actionLabel,
    actionTo,
    actionSearch,
}: {
    title: string;
    actionLabel?: string;
    /** Målruta for handlingsknappen. Uten den rendres ingen knapp. */
    actionTo?: LinkProps["to"];
    /** Søkeparametre til målruta, f.eks. `{ ny: true }` for en dialog. */
    actionSearch?: LinkProps["search"];
}) {
    return (
        <Reveal
            render={
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2" />
            }
        >
            <h2 className="min-w-0 text-2xl">{title}</h2>
            {actionLabel && actionTo ? (
                <Button
                    variant="ghost"
                    size="sm"
                    render={<Link to={actionTo} search={actionSearch} />}
                >
                    <Plus />
                    {actionLabel}
                </Button>
            ) : null}
        </Reveal>
    );
}
