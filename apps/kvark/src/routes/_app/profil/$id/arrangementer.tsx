import { getFavoriteEventsQuery } from "#/api/queries/events";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_app/profil/$id/arrangementer")({
    component: RouteComponent,
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
        </div>
    );
}
