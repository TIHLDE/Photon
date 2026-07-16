import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getEventsQuery } from "#/api/queries/events";
import { EventCard } from "#/components/event-card";
import {
    DEFAULT_EVENT_FILTERS,
    EventFilters,
    type EventFiltersValue,
} from "#/components/event-filters";
import { formatEventDateTime } from "#/lib/event";

export const Route = createFileRoute("/_app/arrangementer/")({
    component: EventsPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getEventsQuery(0)),
});

const CATEGORIES = [
    { value: "all", label: "Alle kategorier" },
    { value: "kurs", label: "Kurs" },
    { value: "annet", label: "Annet" },
    { value: "fadderuka", label: "Fadderuka" },
    { value: "bedpres", label: "Bedpres" },
    { value: "sosialt", label: "Sosialt" },
];

function EventsPage() {
    const [filters, setFilters] = useState<EventFiltersValue>(
        DEFAULT_EVENT_FILTERS,
    );

    const { data } = useSuspenseQuery(getEventsQuery(0));
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
                        categories={CATEGORIES}
                        onChange={setFilters}
                        onSubmit={() => {}}
                    />
                </aside>

                <section className="flex flex-col gap-3">
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
