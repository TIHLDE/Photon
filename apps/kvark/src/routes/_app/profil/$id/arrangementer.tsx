import { requireOwnProfile } from "#/api/auth";
import {
    getFavoriteEventsQuery,
    getMyEventHistoryQuery,
} from "#/api/queries/events";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
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
import { CalendarDays, Star } from "lucide-react";

import { formatEventDate } from "#/lib/event";

export const Route = createFileRoute("/_app/profil/$id/arrangementer")({
    component: RouteComponent,
    beforeLoad: ({ location, params }) =>
        requireOwnProfile(params.id, location.href),
});

function RouteComponent() {
    const { data: favorites, isPending } = useQuery(getFavoriteEventsQuery());

    return (
        <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
                <h3>Favoritter</h3>
                {isPending ? (
                    <ul className="flex flex-col gap-3">
                        {[0, 1].map((i) => (
                            <li key={i}>
                                <Skeleton className="h-16 w-full" />
                            </li>
                        ))}
                    </ul>
                ) : favorites && favorites.length > 0 ? (
                    <ul className="flex flex-col gap-3">
                        {favorites.map((event) => (
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
                                    </div>
                                    <Star className="size-4 shrink-0" />
                                </Card>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <CalendarDays />
                            </EmptyMedia>
                            <EmptyTitle>Ingen favorittarrangementer</EmptyTitle>
                            <EmptyDescription>
                                Arrangementer du markerer som favoritt vises
                                her.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
            </section>

            <PastEventsSection />
        </div>
    );
}

const STATUS_LABELS: Record<string, string> = {
    attended: "Møtte opp",
    no_show: "Ikke møtt",
    registered: "Påmeldt",
};

/** Arrangementene man har vært påmeldt, nyeste først. */
function PastEventsSection() {
    const { data, isPending } = useQuery(getMyEventHistoryQuery(0));
    const events = data?.events ?? [];

    return (
        <section className="flex flex-col gap-3">
            <h3>Tidligere</h3>
            {isPending ? (
                <ul className="flex flex-col gap-3">
                    {[0, 1].map((i) => (
                        <li key={i}>
                            <Skeleton className="h-16 w-full" />
                        </li>
                    ))}
                </ul>
            ) : events.length > 0 ? (
                <ul className="flex flex-col gap-3">
                    {events.map((event) => (
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
                                        {formatEventDate(event.startTime)}
                                    </span>
                                </div>
                                <Badge variant="secondary">
                                    {STATUS_LABELS[event.status] ??
                                        event.status}
                                </Badge>
                            </Card>
                        </li>
                    ))}
                </ul>
            ) : (
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <CalendarDays />
                        </EmptyMedia>
                        <EmptyTitle>Ingen tidligere arrangementer</EmptyTitle>
                        <EmptyDescription>
                            Arrangementer du har vært påmeldt dukker opp her når
                            de er over.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
        </section>
    );
}
