import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarDaysIcon, EyeIcon, PlusIcon } from "lucide-react";
import { Suspense, startTransition, useState } from "react";

import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Input } from "@tihlde/ui/ui/input";
import { Label } from "@tihlde/ui/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";

import { Stagger } from "@tihlde/ui/ui/motion";

import { requireAdminSection } from "#/lib/admin-access";
import { getEventsQuery } from "#/api/queries/events";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { IconActionButton } from "#/components/icon-action-button";
import { AdminPageHeader } from "#/components/admin-page-header";
import { useDebouncedValue } from "#/hooks/use-debounced-value";
import {
    useAnyScopePermission,
    useCanActOnGroupResource,
} from "#/hooks/use-permission";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

type EventSort = "upcoming" | "newest" | "oldest";

const SORT_OPTIONS: { value: EventSort; label: string }[] = [
    { value: "upcoming", label: "Neste først" },
    { value: "newest", label: "Nyeste til eldste" },
    { value: "oldest", label: "Eldste til nyeste" },
];

const DEFAULT_SORT: EventSort = "upcoming";

/** Module-level so the permission predicate keeps a stable identity. */
const EVENT_UPDATE_PERMISSIONS = ["events:update", "events:manage"] as const;

/**
 * Søk, tidsrom og rekkefølge avgjøres server-side. Listen er paginert, så et
 * klientfilter ville bare skjult treff på siden du står på — og «eldste først»
 * ville gitt det eldste av de nyeste 25.
 */
const toFilters = (search: string, showPast: boolean, sort: EventSort) => ({
    search: search.trim() || undefined,
    ordering: sort,
    ...(showPast ? {} : { expired: false }),
});

export const Route = createFileRoute("/admin/arrangementer/")({
    component: EventsAdminPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "arrangementer");
    },
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(
            getEventsQuery(0, toFilters("", false, DEFAULT_SORT), PAGE_SIZE),
        );
        return { breadcrumbs: "Arrangementer" };
    },
});

function EventsAdminPage() {
    const canCreate = useAnyScopePermission(["events:create", "events:manage"]);
    const [search, setSearch] = useState("");
    const [showPast, setShowPast] = useState(false);
    const [sort, setSort] = useState<EventSort>(DEFAULT_SORT);
    const [page, setPage] = useState(0);

    const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

    // Et filterbytte gjør sidetallet meningsløst — treff nummer 26 med det
    // gamle filteret er sjelden treff nummer 26 med det nye.
    const resetPage = () => setPage(0);

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8" />
            }
        >
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
                            onChange={(e) => {
                                setSearch(e.target.value);
                                resetPage();
                            }}
                        />
                    </div>
                    <div className="flex flex-col gap-2 sm:w-56">
                        <Label htmlFor="event-sort">Sorter</Label>
                        <Select
                            items={SORT_OPTIONS}
                            value={sort}
                            onValueChange={(next) => {
                                setSort((next as EventSort) ?? DEFAULT_SORT);
                                resetPage();
                            }}
                        >
                            <SelectTrigger id="event-sort" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SORT_OPTIONS.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2 sm:pb-2">
                        <Checkbox
                            id="event-show-past"
                            checked={showPast}
                            onCheckedChange={(checked) => {
                                setShowPast(Boolean(checked));
                                resetPage();
                            }}
                        />
                        <Label htmlFor="event-show-past">
                            Vis tidligere arrangementer
                        </Label>
                    </div>
                </CardContent>
            </Card>

            <Suspense fallback={<TableSkeleton />}>
                <EventsTable
                    search={debouncedSearch}
                    showPast={showPast}
                    sort={sort}
                    page={page}
                    onPageChange={setPage}
                />
            </Suspense>
        </Stagger>
    );
}

function EventsTable({
    search,
    showPast,
    sort,
    page,
    onPageChange,
}: {
    search: string;
    showPast: boolean;
    sort: EventSort;
    page: number;
    onPageChange: (page: number) => void;
}) {
    const { data } = useSuspenseQuery(
        getEventsQuery(page, toFilters(search, showPast, sort), PAGE_SIZE),
    );
    // Lista viser alle arrangementer — det er poenget med en oversikt — men
    // bare de du kan arrangere for lar seg redigere. Resten får øyeikonet.
    const canManage = useCanActOnGroupResource(EVENT_UPDATE_PERMISSIONS);

    const events = data.items;

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

    // Sidebytte i en transition, slik at tabellen blir stående mens neste side
    // hentes i stedet for å falle tilbake til skjelettet.
    const goToPage = (next: number) =>
        startTransition(() => onPageChange(next));

    return (
        <>
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
                                            startTime={event.startTime}
                                            endTime={event.endTime}
                                            closed={event.closed}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <EventRowAction
                                            eventId={event.id}
                                            canManage={canManage(
                                                event.organizer?.slug ?? null,
                                                event.createdById,
                                            )}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {data.pages > 1 ? (
                <div className="flex items-center justify-end gap-2">
                    <span>
                        Side {page + 1} av {data.pages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => goToPage(page - 1)}
                    >
                        Forrige
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={data.nextPage == null}
                        onClick={() => goToPage(page + 1)}
                    >
                        Neste
                    </Button>
                </div>
            ) : null}
        </>
    );
}

/**
 * Handlingen på en rad. «Administrer» for arrangementene du kan redigere;
 * for de andre et øyeikon som åpner samme side i lesevisning, slik at man kan
 * se hvordan et arrangement er satt opp uten å kunne endre det.
 */
function EventRowAction({
    eventId,
    canManage,
}: {
    eventId: string;
    canManage: boolean;
}) {
    const link = (
        <Link to="/admin/arrangementer/$eventId" params={{ eventId }} />
    );

    if (!canManage) {
        return (
            <IconActionButton
                icon={EyeIcon}
                label="Se oppsettet – du kan ikke redigere dette arrangementet"
                render={link}
            />
        );
    }

    return (
        <Button variant="outline" size="sm" render={link}>
            Administrer
        </Button>
    );
}

function EventStatusBadge({
    startTime,
    endTime,
    closed,
}: {
    startTime: string;
    endTime: string;
    closed: boolean;
}) {
    const now = Date.now();
    if (new Date(endTime).getTime() < now) {
        return <Badge variant="secondary">Avholdt</Badge>;
    }
    // Et arrangement som er i gang havner øverst i «Neste først» fordi det
    // startet før alt annet som ennå ikke er over — badgen forklarer hvorfor.
    if (new Date(startTime).getTime() <= now) {
        return <Badge>Pågår nå</Badge>;
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
