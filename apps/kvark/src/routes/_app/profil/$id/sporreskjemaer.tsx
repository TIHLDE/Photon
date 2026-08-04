import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { HelpCircle } from "lucide-react";
import { Suspense } from "react";

import { requireOwnProfile } from "#/api/auth";
import { getUnansweredEvaluationsQuery } from "#/api/queries/user";
import { formatEventDate } from "#/lib/event";

export const Route = createFileRoute("/_app/profil/$id/sporreskjemaer")({
    component: RouteComponent,
    beforeLoad: ({ location, params }) =>
        requireOwnProfile(params.id, location.href),
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getUnansweredEvaluationsQuery()),
});

function RouteComponent() {
    return (
        <Suspense fallback={<EvaluationsSkeleton />}>
            <Evaluations />
        </Suspense>
    );
}

/**
 * Evalueringene du skylder svar på.
 *
 * De er ikke valgfrie: så lenge én står ubesvart nekter API-et deg påmelding
 * til nye arrangementer, så denne lista er stedet du finner ut hvorfor.
 */
function Evaluations() {
    const { data: evaluations } = useSuspenseQuery(
        getUnansweredEvaluationsQuery(),
    );

    if (evaluations.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <HelpCircle />
                    </EmptyMedia>
                    <EmptyTitle>Ingen spørreskjemaer</EmptyTitle>
                    <EmptyDescription>
                        Spørreskjemaer du må svare på vil dukke opp her.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
                Du må svare på disse før du kan melde deg på flere
                arrangementer.
            </p>
            <ul className="flex flex-col gap-3">
                {evaluations.map((evaluation) => (
                    <li key={evaluation.formId}>
                        <Card>
                            <CardHeader>
                                <CardTitle>{evaluation.eventTitle}</CardTitle>
                                <CardDescription>
                                    {formatEventDate(evaluation.eventEndTime)}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    nativeButton={false}
                                    render={
                                        <Link
                                            to="/sporreskjema/$id"
                                            params={{ id: evaluation.formId }}
                                        />
                                    }
                                >
                                    Svar på evaluering
                                </Button>
                            </CardContent>
                        </Card>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function EvaluationsSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                <Skeleton key={index} className="h-32 w-full" />
            ))}
        </div>
    );
}
