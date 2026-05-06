import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { Plus } from "lucide-react";

import { EventCard, type EventCardProps } from "#/components/event-card";
import { NewsCard, type NewsCardProps } from "#/components/news-card";

export const Route = createFileRoute("/_app/")({ component: Home });

const EVENTS: EventCardProps[] = [
    {
        slug: "lightning-talks",
        title: "Lightning Talks",
        startsAt: "Ons 22. apr 17:00",
        location: "Realfagbygget, Aud. S1",
        organizer: "TIHLDE Promo",
        category: "Sosialt",
        capacity: 60,
        registeredCount: 42,
    },
    {
        slug: "generalforsamling-utveksling",
        title: "Generalforsamling med TIHLDE",
        startsAt: "Man 27. apr 18:00",
        location: "Gjøvik, A-bygget",
        organizer: "TIHLDE Hovedstyret",
        category: "Foreningen",
        capacity: 200,
        registeredCount: 87,
    },
    {
        slug: "spillkveld",
        title: "Spillkveld!",
        startsAt: "Fre 24. apr 19:00",
        location: "Hangaren",
        organizer: "TIHLDE Sosialt",
        category: "Sosialt",
        capacity: null,
        registeredCount: 24,
    },
    {
        slug: "jentelunsj-spillkveld",
        title: "Jentelunsj arrangerer spillkveld",
        startsAt: "Lør 25. apr 18:00",
        location: "Hangaren",
        organizer: "Jentelunsj",
        category: "Jentelunsj",
        capacity: 40,
        registeredCount: 12,
    },
    {
        slug: "toddelmaga",
        title: "Tøddelmåga!",
        startsAt: "Tor 30. apr 20:00",
        location: "Hybrid / Trondheim",
        organizer: "TÖDDEL",
        category: "Sosialt",
        capacity: 80,
        registeredCount: 56,
    },
];

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
            <Hero />

            <section className="container mx-auto w-full px-4 py-8">
                <SectionHeader
                    title="Arrangementer"
                    actionLabel="Nytt arrangement"
                />
                <Tabs defaultValue="list" className="mt-4">
                    <TabsList>
                        <TabsTrigger value="list">Liste</TabsTrigger>
                        <TabsTrigger value="calendar">Kalender</TabsTrigger>
                    </TabsList>
                    <TabsContent value="list">
                        <div className="grid gap-4 md:grid-cols-2">
                            {EVENTS.map((event) => (
                                // TODO: replace with a unique id field once wired up to the backend
                                <EventCard key={event.title} {...event} />
                            ))}
                        </div>
                    </TabsContent>
                    <TabsContent value="calendar">
                        <div className="flex min-h-60 items-center justify-center">
                            <p>Kalendervisning kommer</p>
                        </div>
                    </TabsContent>
                </Tabs>
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

function Hero() {
    return (
        <section className="container mx-auto flex w-full flex-col items-center gap-6 px-4 py-16 text-center">
            <div className="flex items-center gap-4">
                <div className="size-20 rounded-2xl bg-muted" aria-hidden />
                <h1 className="text-5xl">TIHLDE</h1>
            </div>
            <p className="max-w-2xl text-balance">
                Linjeforeningen for Dataingeniør, Digital infrastruktur og
                cybersikkerhet, Digital forretningsutvikling, Digital
                transformasjon og Informasjonsbehandling ved NTNU.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="lg">Logg inn</Button>
                <Button size="lg" variant="outline">
                    Opprett bruker
                </Button>
            </div>
        </section>
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
