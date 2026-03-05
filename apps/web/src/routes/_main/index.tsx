import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { EventCard } from "~/components/event-card";
import { EventCardSkeleton } from "~/components/event-card-skeleton";
import { Page } from "~/components/layout/page";
import { NewsCard } from "~/components/news-card";
import { NewsCardSkeleton } from "~/components/news-card-skeleton";
import { Button } from "~/components/ui/button";
import { listEventsQuery } from "~/lib/queries/events";
import { listNewsQuery } from "~/lib/queries/news";

export const Route = createFileRoute("/_main/")({
    component: Home,
});

function Home() {
    return (
        <Page>
            <section className="flex flex-col items-center justify-center gap-6 pt-16 text-center md:pt-24">
                <h1 className="font-display text-5xl font-bold uppercase tracking-wider md:text-7xl">
                    TIHLDE
                </h1>
                <p className="max-w-lg text-lg text-muted-foreground">
                    Linjeforeningen for Databehandling, Digital infrastruktur og
                    cybersikkerhet, Digital forretningsutvikling, og Drift av
                    datasystemer og tjenester ved NTNU
                </p>
            </section>

            <section className="mt-16 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-heading text-2xl font-bold">
                        Kommende arrangementer
                    </h2>
                    <a href="/arrangementer">
                        <Button variant="ghost" size="sm">
                            Se alle
                            <ArrowRight className="size-4" />
                        </Button>
                    </a>
                </div>
                <UpcomingEvents />
            </section>

            <section className="mt-16 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-heading text-2xl font-bold">
                        Siste nyheter
                    </h2>
                    <a href="/nyheter">
                        <Button variant="ghost" size="sm">
                            Se alle
                            <ArrowRight className="size-4" />
                        </Button>
                    </a>
                </div>
                <RecentNews />
            </section>
        </Page>
    );
}

function UpcomingEvents() {
    const { data, isLoading } = useQuery(listEventsQuery({ pageSize: 4 }));

    if (isLoading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                    <EventCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (!data?.items.length) {
        return (
            <p className="py-8 text-center text-muted-foreground">
                Ingen kommende arrangementer
            </p>
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.items.slice(0, 4).map((event) => (
                <EventCard key={event.id} event={event} />
            ))}
        </div>
    );
}

function RecentNews() {
    const { data, isLoading } = useQuery(listNewsQuery({ pageSize: 3 }));

    if (isLoading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                    <NewsCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (!data?.items.length) {
        return (
            <p className="py-8 text-center text-muted-foreground">
                Ingen nyheter
            </p>
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.slice(0, 3).map((news) => (
                <NewsCard key={news.id} news={news} />
            ))}
        </div>
    );
}
