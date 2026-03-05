import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { EventForm } from "~/components/admin/event-form";
import { Skeleton } from "~/components/ui/skeleton";
import { listGroupsQuery } from "~/lib/queries/groups";

export const Route = createFileRoute("/_main/admin/arrangementer/ny")({
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(listGroupsQuery()),
    component: CreateEventPage,
});

function CreateEventPage() {
    return (
        <div className="space-y-4">
            <h1 className="font-heading text-2xl font-bold">
                Nytt arrangement
            </h1>
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <EventForm />
            </Suspense>
        </div>
    );
}
