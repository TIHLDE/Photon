import { Badge } from "@tihlde/ui/ui/badge";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { CalendarDays } from "lucide-react";

import { EventCard } from "#/components/event-card";
import { formatEventDateTime } from "#/lib/event";

export type ProfileUpcomingEvent = {
    eventId: string;
    title: string;
    slug: string;
    startTime: string;
    location: string | null;
    image: string | null;
    imageAlt: string | null;
    organizer: string | null;
    status: "registered" | "waitlisted" | "pending";
    waitlistPosition: number | null;
};

/**
 * Hva påmeldingen faktisk er verdt: en sikret plass, en ventelisteplass med
 * nummer, eller en påmelding som ennå ikke er avgjort. Uten merket måtte
 * medlemmet åpne hvert arrangement for å finne ut om de har plass.
 */
function statusLabel(event: ProfileUpcomingEvent): string {
    if (event.status === "pending") return "Behandles";
    if (event.status === "waitlisted")
        return event.waitlistPosition !== null
            ? `Venteliste #${event.waitlistPosition}`
            : "Venteliste";
    return "Du har plass";
}

/** Påmeldingene som ikke er over ennå, som arrangementskort. */
export function ProfileUpcomingEvents({
    events,
    isPending,
}: {
    events: ProfileUpcomingEvent[];
    isPending: boolean;
}) {
    if (isPending) {
        return (
            <ul className="flex flex-col gap-3">
                {[0, 1].map((i) => (
                    <li key={i}>
                        {/* Speiler kortet: bilde i 21/9 på mobil, rad på sm+. */}
                        <Skeleton className="h-48 w-full sm:h-28" />
                    </li>
                ))}
            </ul>
        );
    }

    if (events.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <CalendarDays />
                    </EmptyMedia>
                    <EmptyTitle>Ingen kommende arrangementer</EmptyTitle>
                    <EmptyDescription>
                        Påmeldingene dine vises her når du melder deg på et
                        arrangement.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <ul className="flex flex-col gap-3">
            {events.map((event) => (
                <li key={event.eventId}>
                    <EventCard
                        slug={event.slug}
                        title={event.title}
                        startsAt={formatEventDateTime(event.startTime)}
                        location={event.location ?? ""}
                        organizer={event.organizer ?? ""}
                        imageUrl={event.image || undefined}
                        imageAlt={event.imageAlt || undefined}
                        badge={
                            <Badge variant="secondary">
                                {statusLabel(event)}
                            </Badge>
                        }
                    />
                </li>
            ))}
        </ul>
    );
}
