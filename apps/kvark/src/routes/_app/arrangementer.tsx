import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { useState } from "react";

import { EventCard, type EventCardProps } from "#/components/event-card";
import {
    EventFilters,
    type EventFiltersValue,
} from "#/components/event-filters";

export const Route = createFileRoute("/_app/arrangementer")({
    component: EventsPage,
});

const CATEGORIES = [
    { value: "all", label: "Alle" },
    { value: "social", label: "Sosialt" },
    { value: "association", label: "Foreningen" },
    { value: "course", label: "Kurs" },
    { value: "jentelunsj", label: "Jentelunsj" },
];

const EVENTS: EventCardProps[] = [
    {
        title: "Generalforsamling med TIHLDE Utveksling",
        startsAt: "Tor 23. apr 18:00",
        location: "TIHLDE Utveksling / Zoom",
        category: "Foreningen",
    },
    {
        title: "Jentelunsj arrangerer spillkveld",
        startsAt: "Lør 25. apr 18:00",
        location: "Hangaren / Sosialt",
        category: "Jentelunsj",
    },
    {
        title: "Lightning Talks",
        startsAt: "Ons 22. apr 17:00",
        location: "Realfagbygget, Aud. S1 / Kurs",
        category: "Kurs",
    },
    {
        title: "Tøddelmåga!",
        startsAt: "Tor 30. apr 20:00",
        location: "TÖDDEL / Sosialt",
        category: "Sosialt",
    },
    {
        title: "Laptoplotteri",
        startsAt: "Fre 02. mai 14:00",
        location: "Hangaren / Sosialt",
        category: "Sosialt",
    },
    {
        title: "Badstua med Jentelunsj",
        startsAt: "Lør 03. mai 17:00",
        location: "Solsiden / Jentelunsj",
        category: "Jentelunsj",
    },
    {
        title: "Piknik med Jentelunsj i Dødens dal",
        startsAt: "Søn 04. mai 14:00",
        location: "Dødens dal / Jentelunsj",
        category: "Jentelunsj",
    },
    {
        title: "Eksamensbenet",
        startsAt: "Man 05. mai 18:00",
        location: "Hangaren / Sosialt",
        category: "Sosialt",
    },
    {
        title: "Beerfund",
        startsAt: "Tir 06. mai 20:00",
        location: "TIHLDE Hybel og PT / Sosialt",
        category: "Sosialt",
    },
    {
        title: "17. mai fest",
        startsAt: "Fre 17. mai 12:00",
        location: "Trondheim / Sosialt",
        category: "Sosialt",
    },
    {
        title: "Utmarkslutningsball 2026",
        startsAt: "Lør 14. jun 18:00",
        location: "TIHLDE / Foreningen",
        category: "Foreningen",
    },
    {
        title: "Summer meet-up",
        startsAt: "Lør 28. jun 17:00",
        location: "Hangaren / Sosialt",
        category: "Sosialt",
    },
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
                                    <li key={event.title}>
                                        <EventCard {...event} />
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
