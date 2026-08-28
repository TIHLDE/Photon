import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@tihlde/ui/ui/alert-dialog";
import { Button } from "@tihlde/ui/ui/button";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { Suspense, useState } from "react";

import { authClientWithRedirect } from "#/api/auth";
import {
    deleteMotetidEventMutation,
    getMyMotetidEventsQuery,
} from "#/api/queries/motetid";
import { formatOsloDate } from "#/lib/date";

export const Route = createFileRoute("/_app/motetid/")({
    component: MotetidPage,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getMyMotetidEventsQuery()),
});

function MotetidListSkeleton() {
    return (
        <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
            ))}
        </div>
    );
}

function MotetidEventList() {
    const { data: events } = useSuspenseQuery(getMyMotetidEventsQuery());
    const remove = useMutation(deleteMotetidEventMutation);
    const [pendingDelete, setPendingDelete] = useState<{
        slug: string;
        title: string;
    } | null>(null);

    if (events.length === 0) {
        return (
            <p className="text-muted-foreground">
                Du er ikke med på noen arrangementer ennå.
            </p>
        );
    }

    return (
        <>
            <ul className="flex list-none flex-col gap-2">
                {events.map((event) => (
                    <li
                        key={event.id}
                        className="flex items-stretch gap-2 rounded-lg border border-border"
                    >
                        <Link
                            to="/motetid/$slug"
                            params={{ slug: event.slug }}
                            className="min-w-0 flex-1 px-3 py-2"
                        >
                            <p className="font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground">
                                Opprettet {formatOsloDate(event.createdAt)}
                                {" · "}
                                {event.participantCount}{" "}
                                {event.participantCount === 1
                                    ? "deltaker"
                                    : "deltakere"}
                            </p>
                        </Link>
                        {event.isOwner ? (
                            <div className="flex items-center pr-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Slett ${event.title}`}
                                    onClick={() =>
                                        setPendingDelete({
                                            slug: event.slug,
                                            title: event.title,
                                        })
                                    }
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                        ) : null}
                    </li>
                ))}
            </ul>

            <AlertDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingDelete(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Slett «{pendingDelete?.title}»?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Arrangementet og alle deltakernes svar slettes
                            permanent. Dette kan ikke angres.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pendingDelete) {
                                    remove.mutate({
                                        slug: pendingDelete.slug,
                                    });
                                }
                                setPendingDelete(null);
                            }}
                        >
                            Slett
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function MotetidPage() {
    return (
        <div className="container mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl">Møtetid</h1>
                    <p className="text-muted-foreground">
                        Opprett et arrangement, del en lenke, og la alle fylle
                        inn tilgjengelighet i et dra-vennlig varmegrid.
                    </p>
                </div>
                <Button render={<Link to="/motetid/ny" />}>
                    <Plus />
                    Opprett arrangement
                </Button>
            </div>

            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">Mine arrangementer</h2>
                <Suspense fallback={<MotetidListSkeleton />}>
                    <MotetidEventList />
                </Suspense>
            </section>
        </div>
    );
}
