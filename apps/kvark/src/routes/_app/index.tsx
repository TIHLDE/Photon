import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { EventCalendar } from "@tihlde/ui/complex/event-calendar";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { Plus } from "lucide-react";
import { Suspense } from "react";

import { authQueryOptions } from "#/api/auth";
import { getEventsQuery } from "#/api/queries/events";
import { getVisibleBannersQuery } from "#/api/queries/banners";
import { EventCard } from "#/components/event-card";
import { InfoBanner } from "#/components/info-banner";
import { NewsCard, type NewsCardProps } from "#/components/news-card";
import { TihldeLogo } from "#/components/icons/tihlde";
import { HeroSectionBackground } from "#/components/hero-section";
import { formatEventDateTime } from "#/lib/event";

/** Enough events to fill a month in the calendar; the list shows a slice. */
const EVENTS_PAGE_SIZE = 50;

/** Upcoming events, ordered by start time by the API. */
const upcomingEventsQuery = () =>
    getEventsQuery(0, { expired: false }, EVENTS_PAGE_SIZE);

const LIST_PREVIEW_COUNT = 4;

export const Route = createFileRoute("/_app/")({
    component: Home,
    loader: async ({ context }) => {
        await Promise.all([
            context.queryClient.ensureQueryData(upcomingEventsQuery()),
            context.queryClient.ensureQueryData(getVisibleBannersQuery()),
        ]);
    },
});

const NEWS: NewsCardProps[] = [
    {
        slug: "how-to-notion",
        title: "How to Notion",
        excerpt:
            "Opplæring til Promo? Bruk Notion! Les vår nye guide om hvordan vi bruker Notion i undergrupper.",
        publishedAt: "3 dager siden",
    },
    {
        slug: "trivselsundersokelse-v26",
        title: "TIHLDE Trivselsundersøkelse V26",
        excerpt:
            "Vinn gavekort ved å svare på den årlige trivselsundersøkelsen. Din stemme teller!",
        publishedAt: "1 uke siden",
    },
];

function Home() {
    return (
        <>
            {/* Preloaded in the route loader, so the fallback never flashes. */}
            <Suspense fallback={null}>
                <BannersSection />
            </Suspense>

            <Hero />

            <section className="container mx-auto w-full px-4 py-8">
                <SectionHeader
                    title="Arrangementer"
                    actionLabel="Nytt arrangement"
                />
                <Suspense fallback={<EventsSkeleton />}>
                    <EventsSection />
                </Suspense>
            </section>

            <section className="container mx-auto w-full px-4 py-8">
                <SectionHeader title="Nyheter" actionLabel="Ny nyhet" />
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {NEWS.map((item) => (
                        // TODO: replace with a unique id field once wired up to the backend
                        <NewsCard key={item.title} {...item} />
                    ))}
                </div>
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
                <div className="grid gap-4 md:grid-cols-2">
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
                </div>
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

function Hero() {
    return (
        <div className="relative">
            <HeroSectionBackground className="h-full text-primary -z-50" />
            <section className="container mx-auto flex w-full flex-col items-center gap-6 px-4 py-50 text-center">
                <div
                    className="flex items-center gap-1"
                    style={{ color: "var(--color-logo, currentColor)" }}
                >
                    <div className="size-20">
                        <TihldeLogo />
                    </div>
                    <span className="text-5xl font-stretch-condensed font-extrabold">
                        TIHLDE
                    </span>
                </div>
                <p className="max-w-2xl text-balance">
                    Linjeforeningen for Dataingeniør, Digital infrastruktur og
                    cybersikkerhet, Digital forretningsutvikling, Digital
                    transformasjon og Informasjonsbehandling ved NTNU.
                </p>
                <HeroActions />
            </section>
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
                    nativeButton={false}
                    render={<Link to="/profil/$id" params={{ id: "me" }} />}
                >
                    Min profil
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
                size="lg"
                nativeButton={false}
                render={<Link to="/login" />}
            >
                Logg inn
            </Button>
            <Button
                size="lg"
                variant="outline"
                nativeButton={false}
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
}: {
    title: string;
    actionLabel?: string;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl">{title}</h2>
            {actionLabel ? (
                <Button variant="ghost" size="sm">
                    <Plus />
                    {actionLabel}
                </Button>
            ) : null}
        </div>
    );
}
