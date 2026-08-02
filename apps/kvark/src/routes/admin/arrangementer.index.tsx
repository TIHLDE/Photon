import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarDaysIcon, PlusIcon } from "lucide-react";
import { Suspense, useDeferredValue, useMemo, useState } from "react";

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

import { getEventsInfiniteQuery } from "#/api/queries/events";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { LoadMoreButton } from "#/components/load-more-button";
import { useDebouncedValue } from "#/hooks/use-debounced-value";
import { useAnyScopePermission } from "#/hooks/use-permission";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 50;

// Søk og tidsavgrensning gjøres server-side. Tidligere hentet siden bare de
// 100 nyeste arrangementene og filtrerte i klienten, så alt eldre enn det var
// utilgjengelig når «Vis tidligere» var på.
const toEventListFilters = (search: string, showPast: boolean) => ({
    search: search.trim() || undefined,
    // Uten `expired` returnerer API-et både kommende og tidligere.
    ...(showPast ? {} : { expired: false }),
});

export const Route = createFileRoute("/admin/arrangementer/")({
    component: EventsAdminPage,
    loader: async ({ context }) => {
        await context.queryClient.ensureInfiniteQueryData(
            getEventsInfiniteQuery(toEventListFilters("", false), PAGE_SIZE),
        );
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
    const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
    const filters = useMemo(
        () => toEventListFilters(debouncedSearch, showPast),
        [debouncedSearch, showPast],
    );

    // useSuspenseInfiniteQuery har ingen placeholderData, så en endret nøkkel
    // ville ellers droppe tabellen til skjelettet ved hvert tastetrykk.
    const deferredFilters = useDeferredValue(filters);
    const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
        useSuspenseInfiniteQuery(
            getEventsInfiniteQuery(deferredFilters, PAGE_SIZE),
        );

    const events = data.pages.flatMap((page) => page.items);

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
        <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
                Viser {events.length} av {data.pages[0]?.totalCount ?? 0}
            </p>
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
                                                    params={{
                                                        eventId: event.id,
                                                    }}
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
            {hasNextPage && (
                <div className="flex justify-center">
                    <LoadMoreButton
                        onClick={() => fetchNextPage()}
                        isLoading={isFetchingNextPage}
                    />
                </div>
            )}
        </div>
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
