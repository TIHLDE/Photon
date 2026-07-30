import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarDaysIcon, PlusIcon } from "lucide-react";
import { Suspense, useMemo, useState } from "react";

import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Input } from "@tihlde/ui/ui/input";
import { Label } from "@tihlde/ui/ui/label";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";

import { getEventsQuery } from "#/api/queries/events";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { useAnyScopePermission } from "#/hooks/use-permission";

export const Route = createFileRoute("/admin/arrangementer/")({
    component: EventsAdminPage,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getEventsQuery(0));
        return { breadcrumbs: "Arrangementer" };
    },
});

function EventsAdminPage() {
    const canCreate = useAnyScopePermission(["events:create", "events:manage"]);
    const [search, setSearch] = useState("");
    const [showPast, setShowPast] = useState(false);

    return (
        <div className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Arrangementer"
                description="Alle arrangementer. Velg et for å redigere det, se påmeldte, registrere oppmøte og håndtere betalinger."
                action={
                    canCreate ? (
                        <Button render={<Link to="/admin/arrangementer/ny" />}>
                            <PlusIcon className="size-4" />
                            Nytt arrangement
                        </Button>
                    ) : null
                }
            />

            <Card>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex flex-1 flex-col gap-2">
                        <Label htmlFor="event-search">Søk</Label>
                        <Input
                            id="event-search"
                            type="search"
                            placeholder="Søk etter tittel"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="event-show-past"
                            checked={showPast}
                            onCheckedChange={(checked) =>
                                setShowPast(Boolean(checked))
                            }
                        />
                        <Label htmlFor="event-show-past">
                            Vis tidligere arrangementer
                        </Label>
                    </div>
                </CardContent>
            </Card>

            <Suspense fallback={<TableSkeleton />}>
                <EventsTable search={search} showPast={showPast} />
            </Suspense>
        </div>
    );
}

function EventsTable({
    search,
    showPast,
}: {
    search: string;
    showPast: boolean;
}) {
    const { data } = useSuspenseQuery(getEventsQuery(0, {}, 100));

    const events = useMemo(() => {
        const now = Date.now();
        const term = search.trim().toLowerCase();
        return data.items.filter((event) => {
            if (!showPast && new Date(event.endTime).getTime() < now) {
                return false;
            }
            if (term && !event.title.toLowerCase().includes(term)) {
                return false;
            }
            return true;
        });
    }, [data.items, search, showPast]);

    if (events.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={CalendarDaysIcon}
                        title="Ingen arrangementer"
                        description="Ingen arrangementer passer med filteret. Opprett et nytt, eller vis tidligere arrangementer."
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tittel</TableHead>
                            <TableHead>Dato</TableHead>
                            <TableHead>Arrangør</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">
                                Handlinger
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map((event) => (
                            <TableRow key={event.id}>
                                <TableCell>{event.title}</TableCell>
                                <TableCell>
                                    {formatDateTime(event.startTime)}
                                </TableCell>
                                <TableCell>
                                    {event.organizer?.name ?? "—"}
                                </TableCell>
                                <TableCell>
                                    <EventStatusBadge
                                        endTime={event.endTime}
                                        closed={event.closed}
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        render={
                                            <Link
                                                to="/admin/arrangementer/$eventId"
                                                params={{ eventId: event.id }}
                                            />
                                        }
                                    >
                                        Administrer
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function EventStatusBadge({
    endTime,
    closed,
}: {
    endTime: string;
    closed: boolean;
}) {
    if (new Date(endTime).getTime() < Date.now()) {
        return <Badge variant="secondary">Avholdt</Badge>;
    }
    if (closed) {
        return <Badge variant="secondary">Påmelding stengt</Badge>;
    }
    return <Badge>Kommende</Badge>;
}

function formatDateTime(iso: string) {
    return format(new Date(iso), "d. MMM yyyy 'kl.' HH:mm", { locale: nb });
}

function TableSkeleton() {
    return (
        <Card>
            <CardContent className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                    <Skeleton key={index} className="h-10 w-full" />
                ))}
            </CardContent>
        </Card>
    );
}
