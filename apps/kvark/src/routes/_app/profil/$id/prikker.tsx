import { requireOwnProfile } from "#/api/auth";
import { getStrikesQuery } from "#/api/queries/events";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Badge } from "@tihlde/ui/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Ticket } from "lucide-react";

import { formatEventDate } from "#/lib/event";

export const Route = createFileRoute("/_app/profil/$id/prikker")({
    component: RouteComponent,
    beforeLoad: ({ location, params }) =>
        requireOwnProfile(params.id, location.href),
});

function RouteComponent() {
    const { id } = Route.useParams();
    // Siden er låst til egen profil (`requireOwnProfile`), og API-et lar alle
    // hente sine egne prikker uten rettigheter. Listen inneholder kun aktive
    // prikker — utløpte filtreres bort av `getStrikeActiveCutoff` server-side.
    const { data, isPending } = useQuery(getStrikesQuery(0, id));
    const strikes = data?.strikes ?? [];
    const total = strikes.reduce((sum, strike) => sum + strike.count, 0);

    if (isPending) {
        return (
            <ul className="flex flex-col gap-3">
                {[0, 1].map((i) => (
                    <li key={i}>
                        <Skeleton className="h-24 w-full" />
                    </li>
                ))}
            </ul>
        );
    }

    if (strikes.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Ticket />
                    </EmptyMedia>
                    <EmptyTitle>Ingen prikker</EmptyTitle>
                    <EmptyDescription>
                        Du har ingen aktive prikker. Alt er i orden.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
                Du har {total} aktive {total === 1 ? "prikk" : "prikker"}. En
                prikk varer i 20 dager, men telleren står stille i eksamens- og
                ferieperiodene.
            </p>

            <ul className="flex flex-col gap-3">
                {strikes.map((strike) => (
                    <li key={strike.id}>
                        <Card size="sm">
                            <CardHeader className="flex-row items-start justify-between gap-3">
                                <CardTitle>
                                    {strike.event ? (
                                        <Link
                                            to="/arrangementer/$slug"
                                            params={{ slug: strike.event.slug }}
                                        >
                                            {strike.event.title}
                                        </Link>
                                    ) : (
                                        "Ukjent arrangement"
                                    )}
                                </CardTitle>
                                <Badge variant="secondary">
                                    {strike.count}{" "}
                                    {strike.count === 1 ? "prikk" : "prikker"}
                                </Badge>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-1">
                                <span className="text-sm">
                                    {strike.reason ?? "Ingen begrunnelse"}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    Gitt {formatEventDate(strike.createdAt)}
                                </span>
                            </CardContent>
                        </Card>
                    </li>
                ))}
            </ul>
        </div>
    );
}
