import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { useDeferredValue, useMemo, useState } from "react";

import { getEventsQuery } from "#/api/queries/events";
import { EventCard } from "#/components/event-card";
import {
    type Category,
    DEFAULT_EVENT_FILTERS,
    EventFilters,
    type EventFiltersValue,
} from "#/components/event-filters";
import { useDebouncedValue } from "#/hooks/use-debounced-value";
import { formatEventDateTime } from "#/lib/event";

const SEARCH_DEBOUNCE_MS = 300;

const ALL_CATEGORIES = { value: "all", label: "Alle kategorier" };

const EVENT_CATEGORIES: Category[] = [
    { value: "bedpres", label: "Bedpres" },
    { value: "sosialt", label: "Sosialt" },
    { value: "kurs", label: "Kurs" },
    { value: "fadderuka", label: "Fadderuka" },
    { value: "annet", label: "Annet" },
];

const ACTIVITY_CATEGORIES: Category[] = [
    { value: "aktivitet", label: "Aktivitet" },
];

type EventTab = "arrangementer" | "aktiviteter";

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
};

const toEventListFilters = (
    query: string,
    showPast: boolean,
    category: string[],
) => ({
    search: query.trim() || undefined,
    expired: showPast,
    category,
});

export const Route = createFileRoute("/_app/arrangementer/")({
    component: EventsPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(
            getEventsQuery(
                0,
                toEventListFilters(
                    DEFAULT_EVENT_FILTERS.query,
                    DEFAULT_EVENT_FILTERS.showPast,
                    TAB_SLUGS.arrangementer,
                ),
            ),
        ),
});

function EventsPage() {
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
            ),
        [debouncedQuery, filters.showPast, filters.category, tab],
    );

    // useSuspenseQuery has no placeholderData, so a changed key would otherwise
    // drop the list to a fallback on every search. Deferring keeps the current
    // results on screen until the next ones resolve.
    const deferredFilters = useDeferredValue(listFilters);
    const { data } = useSuspenseQuery(getEventsQuery(0, deferredFilters));
    const events = data.items;

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Arrangementer</h1>
                <p className="text-muted-foreground">
                    Finn arrangementer for våren 2026
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-[20rem_1fr]">
                <aside>
                    <EventFilters
                        value={filters}
                        categories={categories}
                        onChange={setFilters}
                    />
                </aside>

                <section className="flex flex-col gap-3">
                    <Tabs
                        value={tab}
                        onValueChange={(next) => changeTab(next as EventTab)}
                    >
                        <TabsList>
                            {TABS.map((t) => (
                                <TabsTrigger key={t.value} value={t.value}>
                                    {t.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <p className="text-sm text-muted-foreground">
                        {data.totalCount} arrangementer funnet
                    </p>
                    <ul className="flex flex-col gap-4 sm:gap-1">
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
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
