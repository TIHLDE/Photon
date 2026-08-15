import { Link } from "@tanstack/react-router";
import { Badge } from "@tihlde/ui/ui/badge";
import { Card } from "@tihlde/ui/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { CalendarDays } from "lucide-react";

import { formatEventDateTime } from "#/lib/event";

export type ProfileUpcomingEvent = {
    eventId: string;
    title: string;
    slug: string;
    startTime: string;
    status: "registered" | "waitlisted" | "pending";
    waitlistPosition: number | null;
};

/**
 * Påmeldingene som ikke er over ennå. Ventelisteplassen og uavklarte
 * påmeldinger merkes, siden de betyr noe annet enn en sikret plass.
 */
function statusLabel(event: ProfileUpcomingEvent): string | null {
    if (event.status === "pending") return "Behandles";
    if (event.status === "waitlisted")
        return event.waitlistPosition !== null
            ? `Venteliste #${event.waitlistPosition}`
            : "Venteliste";
    return null;
}

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
                        <Skeleton className="h-16 w-full" />
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
            {events.map((event) => {
                const label = statusLabel(event);
                return (
                    <li key={event.eventId}>
                        <Card
                            size="sm"
                            className="flex-row items-center gap-3 px-3"
                            render={
                                <Link
                                    to="/arrangementer/$slug"
                                    params={{ slug: event.slug }}
                                />
                            }
                        >
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-medium">
                                    {event.title}
                                </span>
                                <span className="truncate text-sm text-muted-foreground">
                                    {formatEventDateTime(event.startTime)}
                                </span>
                            </div>
                            {label ? (
                                <Badge variant="secondary">{label}</Badge>
                            ) : null}
                        </Card>
                    </li>
                );
            })}
        </ul>
    );
}
