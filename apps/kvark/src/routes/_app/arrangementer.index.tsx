import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { EventCard } from "#/components/event-card";
import {
    DEFAULT_EVENT_FILTERS,
    EventFilters,
    type EventFiltersValue,
} from "#/components/event-filters";
import { EVENTS } from "#/mock/events";

export const Route = createFileRoute("/_app/arrangementer/")({
    component: EventsPage,
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
    const [filters, setFilters] =
        useState<EventFiltersValue>(DEFAULT_EVENT_FILTERS);

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
                        {EVENTS.length} arrangementer funnet
                    </p>
                    <ul className="flex flex-col gap-4 sm:gap-1">
                        {EVENTS.map((event) => (
                            <li key={event.slug}>
                                <EventCard
                                    slug={event.slug}
                                    title={event.title}
                                    startsAt={event.startsAt}
                                    location={event.location}
                                    organizer={event.organizer}
                                    imageUrl={event.imageUrl}
                                    capacity={event.capacity}
                                    registeredCount={event.registeredCount}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
