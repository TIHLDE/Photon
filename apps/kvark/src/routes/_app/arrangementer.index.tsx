import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { useState } from "react";

import { EventCard } from "#/components/event-card";
import {
    EventFilters,
    type EventFiltersValue,
} from "#/components/event-filters";
import { EVENTS } from "#/data/events";

export const Route = createFileRoute("/_app/arrangementer/")({
    component: EventsPage,
});

const CATEGORIES = [
    { value: "all", label: "Alle" },
    { value: "social", label: "Sosialt" },
    { value: "association", label: "Foreningen" },
    { value: "course", label: "Kurs" },
    { value: "jentelunsj", label: "Jentelunsj" },
];

function EventsPage() {
    const [filters, setFilters] = useState<EventFiltersValue>({
        query: "",
        category: "all",
        showPast: false,
        openRegistration: false,
    });

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Arrangementer</h1>
                <p className="text-muted-foreground">
                    Finn arrangementer for våren 2026
                </p>
            </div>

            <Tabs defaultValue="list">
                <TabsList>
                    <TabsTrigger value="list">Liste</TabsTrigger>
                    <TabsTrigger value="calendar">Kalender</TabsTrigger>
                    <TabsTrigger value="featured">Utendrikkert</TabsTrigger>
                </TabsList>

                <TabsContent value="list">
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
                            <ul className="flex flex-col gap-3">
                                {EVENTS.map((event) => (
                                    <li key={event.slug}>
                                        <EventCard
                                            slug={event.slug}
                                            title={event.title}
                                            startsAt={event.startsAt}
                                            location={event.location}
                                            imageUrl={event.imageUrl}
                                            category={event.category}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>
                </TabsContent>

                <TabsContent value="calendar">
                    <div className="flex min-h-80 items-center justify-center">
                        <p>Kalendervisning kommer</p>
                    </div>
                </TabsContent>

                <TabsContent value="featured">
                    <div className="flex min-h-80 items-center justify-center">
                        <p>Utvalgte arrangementer kommer</p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
