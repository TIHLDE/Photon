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
import { formatNewsDateRelative } from "#/lib/news";

/** Enough events to fill a month in the calendar; the list shows a slice. */
const EVENTS_PAGE_SIZE = 50;

/** Upcoming events, ordered by start time by the API. */
const upcomingEventsQuery = () =>
    getEventsQuery(0, { expired: false }, EVENTS_PAGE_SIZE);

const LIST_PREVIEW_COUNT = 4;

/** The three newest news items, ordered by the API. */
const NEWS_PREVIEW_COUNT = 3;
const latestNewsQuery = () => getNewsQuery(0, {}, NEWS_PREVIEW_COUNT);

export const Route = createFileRoute("/_app/")({
    component: Home,
    // Bare arrangementene blokkerer — de er grunnen til at forsida finnes.
    // Bannere og nyheter henter seg selv bak hver sin Suspense- og feilgrense,
    // så et feilende kall der koster oss den seksjonen og ikke hele sida.
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(upcomingEventsQuery()),
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

            <section className="container mx-auto w-full px-4 py-8">
                <SectionHeader
                    title="Arrangementer"
                    actionLabel={
                        canCreateEvent ? "Nytt arrangement" : undefined
                    }
                    actionTo="/admin/arrangementer/ny"
                />
                <Suspense fallback={<EventsSkeleton />}>
                    <EventsSection />
                </Suspense>
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

function EventsSection() {
    const { data } = useSuspenseQuery(upcomingEventsQuery());
    const events = data.items;

    return (
        <Tabs defaultValue="list" className="mt-4">
            <TabsList>
                <TabsTrigger value="list">Liste</TabsTrigger>
                <TabsTrigger value="calendar">Kalender</TabsTrigger>
            </TabsList>
            <TabsContent value="list">
                <Stagger render={<div className="grid gap-4 md:grid-cols-2" />}>
                    {events.slice(0, LIST_PREVIEW_COUNT).map((event) => (
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
            </TabsContent>
            <TabsContent value="calendar">
                <EventCalendar
                    events={events.map((event) => ({
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
            </TabsContent>
        </Tabs>
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

function EventsSkeleton() {
    return (
        <div className="mt-4 flex flex-col gap-4">
            <Skeleton className="h-9 w-48" />
            <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: LIST_PREVIEW_COUNT }, (_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                ))}
            </div>
        </div>
    );
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
            <HeroSectionBackground className="h-full text-primary -z-50" />
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
