import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Separator } from "@tihlde/ui/ui/separator";
import { MarkdownView } from "@tihlde/ui/complex/markdown";
import {
    ArrowLeft,
    Building2,
    CalendarDays,
    CalendarPlus,
    Clock,
    MapPin,
    Mail,
    PencilLine,
    QrCode,
    Tag,
    UsersRound,
} from "lucide-react";

import {
    DetailMetaList,
    type DetailMetaItem,
} from "#/components/detail-meta-list";
import { EventQrDialog } from "#/components/event-qr-dialog";
import { EventRegistrantsDialog } from "#/components/event-registrants-dialog";
import { EventRegistrationCard } from "#/components/event-registration-card";
import { ReactionsBar, type Reaction } from "#/components/reactions-bar";
import { ShareButton } from "#/components/share-button";
import { richRegistry } from "#/components/markdown/directives/presets";
import { getEventBySlug } from "#/data/events";

export const Route = createFileRoute("/_app/arrangementer/$slug")({
    component: EventDetailPage,
    loader: ({ params }) => {
        const event = getEventBySlug(params.slug);
        if (!event) throw notFound();
        return { event };
    },
});

const REACTIONS: Reaction[] = [
    { emoji: "🔥", count: 8, reacted: true },
    { emoji: "🎉", count: 5 },
    { emoji: "🍕", count: 3 },
];

function EventDetailPage() {
    const { event } = Route.useLoaderData();

    const meta: DetailMetaItem[] = [
        { icon: Clock, label: "Fra", value: event.startsAt },
        { icon: Clock, label: "Til", value: event.endsAt },
        { icon: MapPin, label: "Sted", value: event.location },
        { icon: Tag, label: "Hva", value: event.category },
        { icon: Building2, label: "Arrangør", value: event.organizer },
        {
            icon: Mail,
            label: "Kontaktperson",
            value: event.contactPerson,
        },
    ];

    const calendarUrl = buildCalendarUrl(event);

    return (
        <article className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:py-10">
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    render={<Link to="/arrangementer" />}
                >
                    <ArrowLeft />
                    Alle arrangementer
                </Button>
            </div>

            <div className="overflow-hidden rounded-xl">
                <div className="aspect-[16/7] w-full bg-muted">
                    {event.imageUrl ? (
                        <img
                            src={event.imageUrl}
                            alt=""
                            className="size-full object-cover"
                        />
                    ) : null}
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
                <div className="flex flex-col gap-6">
                    <header className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <Badge variant="secondary">{event.category}</Badge>
                            {event.reactionsEnabled ? (
                                <ReactionsBar reactions={REACTIONS} />
                            ) : null}
                        </div>
                        <h1 className="text-3xl md:text-4xl">{event.title}</h1>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <CalendarDays className="size-4" />
                                {event.startsAt}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <MapPin className="size-4" />
                                {event.location}
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                render={
                                    <a
                                        href={calendarUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    />
                                }
                            >
                                <CalendarPlus />
                                Legg til i kalender
                            </Button>
                            <Button variant="outline" size="sm">
                                <PencilLine />
                                Rediger arrangement
                            </Button>
                            <ShareButton label="Del arrangement" />
                        </div>
                    </header>

                    <Separator />

                    <MarkdownView registry={richRegistry} source={event.body} />
                </div>

                <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
                    <Card>
                        <CardHeader>
                            <CardTitle>Detaljer</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DetailMetaList items={meta} />
                        </CardContent>
                    </Card>

                    <EventRegistrationCard
                        registrationState={event.registrationState}
                        registrationOpensAt={event.registrationOpensAt}
                        registrationOpensInLabel={
                            event.registrationOpensInLabel
                        }
                        capacity={event.capacity}
                        registeredCount={event.registeredCount}
                        waitlistCount={event.waitlistCount}
                        isAdmin={event.isAdmin}
                        qrSlot={
                            event.registrationState === "joined" ? (
                                <EventQrDialog
                                    title={event.title}
                                    registrantName="Iver Lindholm"
                                    trigger={
                                        <Button className="w-full">
                                            <QrCode />
                                            Påmeldingsbevis
                                        </Button>
                                    }
                                />
                            ) : null
                        }
                    />

                    {event.isAdmin ? (
                        <EventRegistrantsDialog
                            title={event.title}
                            registrants={event.registrants}
                            trigger={
                                <Button variant="outline" className="w-full">
                                    <UsersRound />
                                    Se alle påmeldte
                                </Button>
                            }
                        />
                    ) : null}
                </aside>
            </div>
        </article>
    );
}

function buildCalendarUrl(event: {
    title: string;
    startsAtIso: string;
    endsAtIso: string;
    location: string;
}) {
    const formatIcs = (iso: string) =>
        iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: event.title,
        dates: `${formatIcs(event.startsAtIso)}/${formatIcs(event.endsAtIso)}`,
        location: event.location,
    });
    return `https://www.google.com/calendar/render?${params.toString()}`;
}
