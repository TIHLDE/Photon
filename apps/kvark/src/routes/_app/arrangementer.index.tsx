import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import { Stagger } from "@tihlde/ui/ui/motion";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { PlusIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import z from "zod";

import { getEventsInfiniteQuery } from "#/api/queries/events";
import { EventCalendar } from "#/components/event-calendar";
import { EventCard } from "#/components/event-card";
import {
    type Category,
    DEFAULT_EVENT_FILTERS,
    EventFilters,
    type EventFiltersValue,
} from "#/components/event-filters";
import { LoadMoreButton } from "#/components/load-more-button";
import { PageHeader } from "#/components/page-header";
import { useDebouncedValue } from "#/hooks/use-debounced-value";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { formatEventDateTime } from "#/lib/event";
import {
    ACTIVITY_CATEGORIES,
    BEDPRES_CATEGORIES,
    EVENT_CATEGORIES,
} from "#/lib/event-categories";

const SEARCH_DEBOUNCE_MS = 300;

/** Module-level so the permission lookup keeps a stable identity. */
const EVENT_CREATE_PERMISSIONS = ["events:create", "events:manage"] as const;

const ALL_CATEGORIES = { value: "all", label: "Alle kategorier" };

type EventTab = "arrangementer" | "aktiviteter" | "bedpres";

const TABS: { value: EventTab; label: string; categories: Category[] }[] = [
    {
        value: "arrangementer",
        label: "Arrangementer",
        categories: EVENT_CATEGORIES,
    },
    {
        value: "aktiviteter",
        label: "Aktiviteter",
        categories: ACTIVITY_CATEGORIES,
    },
    {
        value: "bedpres",
        label: "Bedpres",
        categories: BEDPRES_CATEGORIES,
    },
];

// Slugs a tab covers when no single category is picked. The events tab also
// claims "uncategorized" so those events stay reachable rather than falling
// between the two tabs; it is deliberately not offered in the dropdown.
const TAB_SLUGS: Record<EventTab, string[]> = {
    arrangementer: [
        ...EVENT_CATEGORIES.map((category) => category.value),
        "uncategorized",
    ],
    aktiviteter: ACTIVITY_CATEGORIES.map((category) => category.value),
    bedpres: BEDPRES_CATEGORIES.map((category) => category.value),
};

const toEventListFilters = (
    query: string,
    showPast: boolean,
    category: string[],
    openRegistration: boolean,
) => ({
    search: query.trim() || undefined,
    expired: showPast,
    category,
    // Utelatt når den er av, slik `search` er: API-et filtrerer bare på
    // `true`, og en tom boks skal ikke legge igjen en parameter i
    // spørringsnøkkelen.
    openSignUp: openRegistration || undefined,
});

const VIEWS = [
    { value: "liste", label: "Liste" },
    { value: "kalender", label: "Kalender" },
] as const;

type EventView = (typeof VIEWS)[number]["value"];

const searchSchema = z.object({
    visning: z.enum(["liste", "kalender"]).default("liste").catch("liste"),
});

// Kalenderen viser en hel måned om gangen, så den trenger flere arrangementer
// per side enn listen for ikke å ha hull i rutenettet.
const CALENDAR_PAGE_SIZE = 100;

export const Route = createFileRoute("/_app/arrangementer/")({
    component: EventsPage,
    validateSearch: searchSchema,
    loader: ({ context }) =>
        context.queryClient.ensureInfiniteQueryData(
            getEventsInfiniteQuery(
                toEventListFilters(
                    DEFAULT_EVENT_FILTERS.query,
                    DEFAULT_EVENT_FILTERS.showPast,
                    TAB_SLUGS.arrangementer,
                    DEFAULT_EVENT_FILTERS.openRegistration,
                ),
            ),
        ),
});

function EventsPage() {
    const { visning } = Route.useSearch();
    const navigate = useNavigate();
    const [tab, setTab] = useState<EventTab>("arrangementer");
    const [filters, setFilters] = useState<EventFiltersValue>(
        DEFAULT_EVENT_FILTERS,
    );

    const categories = useMemo(
        () => [
            ALL_CATEGORIES,
            ...(TABS.find((t) => t.value === tab)?.categories ?? []),
        ],
        [tab],
    );

    // A category picked on one tab never exists on the other, so keeping it
    // would leave the new tab showing nothing.
    const changeTab = (next: EventTab) => {
        setTab(next);
        setFilters((current) => ({
            ...current,
            category: ALL_CATEGORIES.value,
        }));
    };

    const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
    const listFilters = useMemo(
        () =>
            toEventListFilters(
                debouncedQuery,
                filters.showPast,
                filters.category === ALL_CATEGORIES.value
                    ? TAB_SLUGS[tab]
                    : [filters.category],
                filters.openRegistration,
            ),
        [
            debouncedQuery,
            filters.showPast,
            filters.category,
            filters.openRegistration,
            tab,
        ],
    );

    // useSuspenseQuery has no placeholderData, so a changed key would otherwise
    // drop the list to a fallback on every search. Deferring keeps the current
    // results on screen until the next ones resolve.
    const deferredFilters = useDeferredValue(listFilters);
    const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
        useSuspenseInfiniteQuery(
            getEventsInfiniteQuery(
                deferredFilters,
                visning === "kalender" ? CALENDAR_PAGE_SIZE : undefined,
            ),
        );
    const events = data.pages.flatMap((page) => page.items);
    // Any-scope: scopet er ukjent på en offentlig liste, og et gruppe-scopet
    // events:create er en ekte tilgang. API-et avviser uansett den enkelte
    // forespørselen som ikke treffer.
    const canCreateEvent = useAnyScopePermission(EVENT_CREATE_PERMISSIONS);

    const changeView = (next: EventView) => {
        navigate({
            to: "/arrangementer",
            search: { visning: next },
            replace: true,
        });
    };

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <PageHeader
                title="Arrangementer"
                description="Finn arrangementer for våren 2026"
                action={
                    canCreateEvent ? (
                        <Button render={<Link to="/admin/arrangementer/ny" />}>
                            <PlusIcon className="size-4" />
                            Nytt arrangement
                        </Button>
                    ) : null
                }
            />

            <div className="grid gap-6 md:grid-cols-[20rem_minmax(0,1fr)]">
                <aside>
                    <EventFilters
                        value={filters}
                        categories={categories}
                        onChange={setFilters}
                    />
                </aside>

                <section className="flex min-w-0 flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <Tabs
                            value={tab}
                            onValueChange={(next) =>
                                changeTab(next as EventTab)
                            }
                        >
                            <TabsList>
                                {TABS.map((t) => (
                                    <TabsTrigger key={t.value} value={t.value}>
                                        {t.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                        <Tabs
                            className="ml-auto"
                            value={visning}
                            onValueChange={(next) =>
                                changeView(next as EventView)
                            }
                        >
                            <TabsList>
                                {VIEWS.map((view) => (
                                    <TabsTrigger
                                        key={view.value}
                                        value={view.value}
                                    >
                                        {view.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>
                    {visning === "kalender" ? (
                        <EventCalendar
                            events={events.map((event) => ({
                                id: event.id,
                                slug: event.slug,
                                title: event.title,
                                startTime: event.startTime,
                                category: event.category?.label,
                            }))}
                        />
                    ) : (
                        <Stagger
                            render={<ul className="flex flex-col gap-3" />}
                        >
                            {events.map((event) => (
                                <li key={event.id}>
                                    <EventCard
                                        slug={event.slug}
                                        title={event.title}
                                        startsAt={formatEventDateTime(
                                            event.startTime,
                                        )}
                                        location={event.location ?? ""}
                                        organizer={event.organizer?.name ?? ""}
                                        category={event.category?.label}
                                        imageUrl={event.image || undefined}
                                        imageAlt={event.imageAlt || undefined}
                                    />
                                </li>
                            ))}
                        </Stagger>
                    )}
                    {hasNextPage && (
                        <div className="flex justify-center pt-2">
                            <LoadMoreButton
                                onClick={() => fetchNextPage()}
                                isLoading={isFetchingNextPage}
                            />
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
