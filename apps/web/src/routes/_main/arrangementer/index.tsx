import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { Suspense, useCallback } from "react";
import { z } from "zod";
import { EmptyState } from "~/components/empty-state";
import { EventCard } from "~/components/event-card";
import { EventCardSkeleton } from "~/components/event-card-skeleton";
import { Page } from "~/components/layout/page";
import { SearchInput } from "~/components/search-input";
import { listEventsQuery } from "~/lib/queries/events";

const searchSchema = z.object({
    search: z.string().optional().catch(undefined),
    expired: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/_main/arrangementer/")({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }) =>
        context.queryClient.ensureQueryData(listEventsQuery(deps)),
    component: EventsPage,
});

function EventsPage() {
    const { search, expired } = Route.useSearch();
    const navigate = useNavigate({ from: Route.fullPath });

    const setSearch = useCallback(
        (value: string) =>
            navigate({
                search: (prev) => ({
                    ...prev,
                    search: value || undefined,
                }),
            }),
        [navigate],
    );

    const toggleExpired = useCallback(
        () =>
            navigate({
                search: (prev) => ({
                    ...prev,
                    expired: prev.expired ? undefined : true,
                }),
            }),
        [navigate],
    );

    return (
        <Page>
            <div className="space-y-6">
                <div>
                    <h1 className="font-heading text-3xl font-bold">
                        Arrangementer
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Se kommende og tidligere arrangementer
                    </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex-1">
                        <SearchInput
                            value={search ?? ""}
                            onChange={setSearch}
                            placeholder="Søk etter arrangementer..."
                        />
                    </div>
                    <button
                        type="button"
                        onClick={toggleExpired}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                            expired
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Vis tidligere
                    </button>
                </div>

                <Suspense fallback={<EventsListSkeleton />}>
                    <EventsList search={search} expired={expired} />
                </Suspense>
            </div>
        </Page>
    );
}

function EventsList({
    search,
    expired,
}: { search?: string; expired?: boolean }) {
    const { data } = useSuspenseQuery(listEventsQuery({ search, expired }));

    if (!data || data.items.length === 0) {
        return (
            <EmptyState
                icon={Calendar}
                title="Ingen arrangementer funnet"
                description={
                    search
                        ? "Prøv å endre søket ditt"
                        : "Det er ingen arrangementer å vise akkurat nå"
                }
            />
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((event) => (
                <EventCard key={event.id} event={event} />
            ))}
        </div>
    );
}

function EventsListSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <EventCardSkeleton key={i} />
            ))}
        </div>
    );
}
