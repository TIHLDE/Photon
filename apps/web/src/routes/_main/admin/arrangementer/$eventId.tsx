import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { EventForm } from "~/components/admin/event-form";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import {
    getEventQuery,
    listEventRegistrationsQuery,
} from "~/lib/queries/events";
import { listGroupsQuery } from "~/lib/queries/groups";

export const Route = createFileRoute("/_main/admin/arrangementer/$eventId")({
    loader: ({ context, params }) =>
        Promise.all([
            context.queryClient.ensureQueryData(getEventQuery(params.eventId)),
            context.queryClient.ensureQueryData(listGroupsQuery()),
            context.queryClient.ensureQueryData(
                listEventRegistrationsQuery(params.eventId),
            ),
        ]),
    component: EditEventPage,
});

function EditEventPage() {
    const { eventId } = Route.useParams();
    const { data: event } = useSuspenseQuery(getEventQuery(eventId));

    if (!event) return null;

    const initialData = {
        title: event.title,
        categorySlug: event.category.slug,
        organizerGroupSlug: event.organizer?.slug,
        location: event.location ?? "",
        imageUrl: event.image,
        start: event.startTime,
        end: event.endTime,
        isPaidEvent: event.isPaidEvent,
        price: event.payInfo?.price,
        paymentGracePeriodMinutes: event.payInfo?.paymentGracePeriodMinutes,
    };

    return (
        <div className="space-y-6">
            <h1 className="font-heading text-2xl font-bold">
                Rediger: {event.title}
            </h1>

            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <EventForm eventId={eventId} initialData={initialData} />
            </Suspense>

            <Separator />

            <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                <RegistrationsList eventId={eventId} />
            </Suspense>
        </div>
    );
}

function RegistrationsList({ eventId }: { eventId: string }) {
    const { data } = useSuspenseQuery(listEventRegistrationsQuery(eventId));

    const users = data?.registeredUsers ?? [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Påmeldinger ({data?.totalCount ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
                {users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Ingen påmeldte enda.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Navn</TableHead>
                                <TableHead>ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {user.image ? (
                                                <img
                                                    src={user.image}
                                                    alt={user.name}
                                                    className="size-6 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex size-6 items-center justify-center rounded-full bg-muted text-xs">
                                                    {user.name
                                                        ?.charAt(0)
                                                        ?.toUpperCase()}
                                                </div>
                                            )}
                                            {user.name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        {user.id}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
