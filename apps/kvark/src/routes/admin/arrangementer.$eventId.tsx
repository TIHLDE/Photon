import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
    createFileRoute,
    Link,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
    CheckCircle2,
    CircleCheckBigIcon,
    ExternalLink,
    PlusIcon,
    UsersIcon,
    WalletIcon,
    XCircle,
} from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { z } from "zod";

import type { Event, UpdateEventSchema } from "@tihlde/sdk";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";

import { Stagger } from "@tihlde/ui/ui/motion";

import { searchAddressQuery } from "#/api/queries/address";
import { useImageUploader } from "#/api/queries/assets";
import {
    createEventFormMutation,
    deleteEventMutation,
    getEventByIdQuery,
    getEventFormsQuery,
    getEventPaymentsQuery,
    getEventRegistrationsQuery,
    refundEventPaymentMutation,
    setAttendanceMutation,
    updateEventMutation,
} from "#/api/queries/events";
import { getGroupMembersQuery, getGroupsQuery } from "#/api/queries/groups";
import { getInstitutesQuery } from "#/api/queries/institutes";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { AdminStatCard } from "#/components/admin-stat-card";
import { ConfirmDeleteDialog } from "#/components/confirm-delete-dialog";
import type { EventFormValues } from "#/components/event-form";
import { ALL_INSTITUTES, EventForm } from "#/components/event-form";
import { poolsForSubmit } from "#/components/priority-pool-editor";
import { usePriorityUserSearch } from "#/hooks/use-priority-user-search";
import type { NewFormValues } from "#/components/new-form-dialog";
import { NewFormDialog } from "#/components/new-form-dialog";
import {
    useAnyScopePermission,
    useCanActForGroup,
    useCanActOnResource,
} from "#/hooks/use-permission";
import { extractErrorMessage } from "#/lib/api-error";
import { isCohortGroupType } from "#/lib/group";
import { useDebounced } from "#/lib/use-debounced";

const TABS = [
    "detaljer",
    "pameldte",
    "oppmote",
    "skjemaer",
    "betalinger",
] as const;
type TabValue = (typeof TABS)[number];

/** The API caps pageSize at 100; asking for more is a 400. */
const MAX_PAGE_SIZE = 100;

/** Module-level so the permission predicate keeps a stable identity. */
const EVENT_UPDATE_PERMISSIONS = ["events:update", "events:manage"] as const;

// Defaulted (not required) so plain links to the page need no search param,
// while the tab stays deep-linkable and survives a bad value.
const searchSchema = z.object({
    fane: z.enum(TABS).default("detaljer").catch("detaljer"),
});

export const Route = createFileRoute("/admin/arrangementer/$eventId")({
    component: EventAdminDetailPage,
    validateSearch: searchSchema,
    loader: async ({ context, params }) => {
        const event = await context.queryClient.ensureQueryData(
            getEventByIdQuery(params.eventId),
        );
        // Varmer cachen til detaljfanen uten å blokkere. Feiler de, tar
        // `DetailsTab` det med sin egen Suspense-grense — men løftet må
        // fanges her, ellers står vi igjen med en ubehandlet avvisning som
        // kan felle SSR-prosessen.
        void context.queryClient
            .ensureQueryData(getGroupsQuery(0))
            .catch(() => {});
        void context.queryClient
            .ensureQueryData(getInstitutesQuery())
            .catch(() => {});
        return { breadcrumbs: event.title };
    },
});

function EventAdminDetailPage() {
    const { eventId } = Route.useParams();
    const { fane } = useSearch({ from: Route.id });
    const navigate = useNavigate({ from: Route.fullPath });
    const { data: event } = useSuspenseQuery(getEventByIdQuery(eventId));

    const canSeePayments = useAnyScopePermission([
        "events:payments:view",
        "events:manage",
        "events:update",
    ]);

    const visibleTabs = useMemo(
        () => [
            { value: "detaljer" as const, label: "Detaljer" },
            { value: "pameldte" as const, label: "Påmeldte" },
            { value: "oppmote" as const, label: "Oppmøte" },
            { value: "skjemaer" as const, label: "Skjemaer" },
            ...(canSeePayments
                ? [{ value: "betalinger" as const, label: "Betalinger" }]
                : []),
        ],
        [canSeePayments],
    );

    // A tab the user cannot see falls back to the first one they can.
    const activeTab: TabValue = visibleTabs.some((t) => t.value === fane)
        ? fane
        : "detaljer";

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title={event.title}
                description={`${formatDateTime(event.startTime)} · ${event.organizer?.name ?? "Ingen arrangør"}`}
                action={
                    <Button
                        variant="outline"
                        size="sm"
                        render={
                            <Link
                                to="/arrangementer/$slug"
                                params={{ slug: event.slug }}
                            />
                        }
                    >
                        <ExternalLink />
                        Se arrangementet
                    </Button>
                }
            />

            <Tabs
                value={activeTab}
                onValueChange={(value) =>
                    navigate({
                        search: { fane: value as TabValue },
                    })
                }
            >
                <TabsList>
                    {visibleTabs.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {activeTab === "detaljer" && <DetailsTab eventId={eventId} />}
            {activeTab === "pameldte" && <RegistrationsTab eventId={eventId} />}
            {activeTab === "oppmote" && <AttendanceTab eventId={eventId} />}
            {activeTab === "skjemaer" && <FormsTab eventId={eventId} />}
            {activeTab === "betalinger" && canSeePayments && (
                <Suspense fallback={<TableSkeleton />}>
                    <PaymentsTab eventId={eventId} />
                </Suspense>
            )}
        </Stagger>
    );
}

/* ------------------------------- Detaljer ------------------------------- */

/** ISO-streng -> Date, eller null når feltet ikke er satt. */
function toDate(iso: string | null | undefined): Date | null {
    return iso ? new Date(iso) : null;
}

/** Fyller skjemaet med arrangementet slik det er lagret i dag. */
function valuesFromEvent(event: Event): EventFormValues {
    const location = event.location ?? "";
    const hasCoords =
        typeof event.locationLat === "number" &&
        typeof event.locationLng === "number";

    return {
        // Arrangementet leverer poolene med hele gruppeobjekter; skjemaet
        // jobber på slugs, som er det API-et tar imot igjen.
        priorityPools: (event.priorityPools ?? []).map((pool) => ({
            groups: pool.groups.map((g) => g.slug),
        })),
        // Navn og bilde er med så lista kan vise hvem det er; bare id-ene
        // sendes tilbake. Feltet er tomt for de som ikke kan redigere
        // arrangementet — API-et deler ikke navngitte personer med andre.
        priorityUsers: event.priorityUsers ?? [],
        onlyAllowPrioritized: event.onlyAllowPrioritized,
        title: event.title,
        description: event.description,
        categorySlug: event.category.slug,
        organizerGroupSlug: event.organizer?.slug ?? "",
        contactPersonUserId: event.contactPerson?.id ?? "",
        location,
        locationCoords:
            hasCoords && location
                ? {
                      label: location,
                      lat: event.locationLat as number,
                      lng: event.locationLng as number,
                  }
                : null,
        start: toDate(event.startTime),
        end: toDate(event.endTime),
        requiresSigningUp: event.requiresSigningUp,
        registrationStart: toDate(event.registrationStart),
        registrationEnd: toDate(event.registrationEnd),
        cancellationDeadline: toDate(event.cancellationDeadline),
        capacity: event.capacity === null ? "" : String(event.capacity),
        visibility: event.visibility === "members" ? "members" : "public",
        instituteSlug: event.restrictedToInstitute?.slug ?? ALL_INSTITUTES,
        isPaidEvent: event.isPaidEvent,
        canCauseStrikes: event.canCauseStrikes,
        // payInfo.price er i øre, mens skjemaet redigerer hele kroner.
        price: event.payInfo
            ? String(Math.round(event.payInfo.price / 100))
            : "",
        image: null,
        imageAlt: event.imageAlt ?? "",
    };
}

function DetailsTab({ eventId }: { eventId: string }) {
    const navigate = useNavigate();
    const { data: event } = useSuspenseQuery(getEventByIdQuery(eventId));
    const { data: allGroups } = useSuspenseQuery(getGroupsQuery(0));
    const { data: institutes } = useSuspenseQuery(getInstitutesQuery());

    // Moving the event to another group takes the permission over there too
    // (the API says the same), so only offer the groups that qualify — plus
    // the current one, which must stay selectable.
    const canArrangeFor = useCanActForGroup(EVENT_UPDATE_PERMISSIONS);
    const groups = useMemo(
        () =>
            allGroups.filter(
                (group) =>
                    group.slug === event.organizer?.slug ||
                    (canArrangeFor(group.slug) &&
                        !isCohortGroupType(group.type)),
            ),
        [allGroups, canArrangeFor, event.organizer?.slug],
    );

    // Samme regel som API-et: rettigheten (også gruppescopet), eller å ha
    // opprettet arrangementet selv.
    const canEdit = useCanActOnResource(["events:update", "events:manage"])(
        event.createdById,
    );
    const canDelete = useCanActOnResource(["events:delete", "events:manage"])(
        event.createdById,
    );

    const [values, setValues] = useState<EventFormValues>(() =>
        valuesFromEvent(event),
    );
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const priorityUserSearch = usePriorityUserSearch();

    const debouncedLocation = useDebounced(values.location, 250);
    const { data: addressSuggestions, isFetching: isSearchingAddress } =
        useQuery(searchAddressQuery(debouncedLocation));

    // Kontaktpersonen velges blant medlemmene i arrangørgruppen.
    const { data: organizerMembers } = useQuery({
        ...getGroupMembersQuery(values.organizerGroupSlug, 0),
        enabled: Boolean(values.organizerGroupSlug),
    });
    const contactPersonCandidates = (organizerMembers ?? []).map((member) => ({
        id: member.user.id,
        name: member.user.name,
    }));

    const updateEvent = useMutation(updateEventMutation);
    const removeEvent = useMutation(deleteEventMutation);
    const { uploadImage, isUploading } = useImageUploader();

    function handleChange(patch: Partial<EventFormValues>) {
        setValues((current) => ({ ...current, ...patch }));
    }

    async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
        formEvent.preventDefault();
        setUploadError(null);

        if (!values.start || !values.end) return;
        if (!values.categorySlug) return;
        if (
            values.requiresSigningUp &&
            (!values.registrationStart || !values.registrationEnd)
        ) {
            return;
        }
        // Se skjemaet: datovelgerne begrenser ikke lenger hverandre, så
        // rekkefølgen stoppes her.
        if (
            values.registrationStart &&
            values.registrationEnd &&
            values.registrationStart >= values.registrationEnd
        ) {
            return;
        }

        // Lastes opp først: en feilet opplasting skal ikke lagre resten av
        // endringene med et bilde som mangler.
        let imageUrl: string | undefined;
        if (values.image) {
            try {
                imageUrl = await uploadImage(values.image);
            } catch (err) {
                setUploadError(
                    err instanceof Error ? err.message : String(err),
                );
                return;
            }
        }

        const canCauseStrikes = values.isPaidEvent
            ? false
            : values.canCauseStrikes;

        const data: UpdateEventSchema = {
            title: values.title,
            description: values.description,
            categorySlug: values.categorySlug,
            organizerGroupSlug: values.organizerGroupSlug,
            location: values.location,
            locationLat: values.locationCoords?.lat ?? null,
            locationLng: values.locationCoords?.lng ?? null,
            // Utelatt når ingen ny fil er valgt, slik at det lagrede bildet
            // blir stående.
            ...(imageUrl ? { imageUrl } : {}),
            imageAlt: values.imageAlt || null,
            start: values.start.toISOString(),
            end: values.end.toISOString(),
            // Uten påmelding avviser API-et både frist og kapasitet.
            registrationStart: values.requiresSigningUp
                ? (values.registrationStart?.toISOString() ?? null)
                : null,
            registrationEnd: values.requiresSigningUp
                ? (values.registrationEnd?.toISOString() ?? null)
                : null,
            // Avmeldingsfristen gjelder bare arrangementer med påmelding som
            // ikke er betalte — API-et avviser resten.
            cancellationDeadline:
                values.requiresSigningUp && !values.isPaidEvent
                    ? (values.cancellationDeadline?.toISOString() ?? null)
                    : null,
            capacity:
                values.requiresSigningUp && values.capacity
                    ? Number(values.capacity)
                    : null,
            visibility: values.visibility,
            restrictedToInstituteSlug:
                values.instituteSlug === ALL_INSTITUTES
                    ? null
                    : values.instituteSlug,
            isRegistrationClosed: event.closed,
            requiresSigningUp: values.requiresSigningUp,
            allowWaitlist: values.requiresSigningUp,
            priorityPools: poolsForSubmit(values.priorityPools),
            priorityUserIds: values.priorityUsers.map((user) => user.id),
            onlyAllowPrioritized: values.onlyAllowPrioritized,
            // Betalte arrangementer gir aldri prikker.
            canCauseStrikes: canCauseStrikes,
            enforcesPreviousStrikes: canCauseStrikes,
            isPaidEvent: values.isPaidEvent,
            price:
                values.isPaidEvent && values.price
                    ? Number(values.price)
                    : null,
            paymentGracePeriodMinutes:
                event.payInfo?.paymentGracePeriodMinutes ?? null,
            contactPersonUserId: values.contactPersonUserId || null,
            reactionsAllowed: false,
        };

        updateEvent.mutate({ eventId, data });
    }

    function handleDelete() {
        setConfirmDelete(false);
        removeEvent.mutate(
            { eventId },
            { onSuccess: () => navigate({ to: "/admin/arrangementer" }) },
        );
    }

    if (!canEdit) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={UsersIcon}
                        title="Ingen tilgang"
                        description="Du har ikke tilgang til å redigere dette arrangementet."
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <EventForm
                values={values}
                onChange={handleChange}
                groups={groups}
                poolGroups={allGroups}
                priorityUserSearch={priorityUserSearch}
                institutes={institutes}
                contactPersonCandidates={contactPersonCandidates}
                existingImageUrl={event.image}
                addressSuggestions={addressSuggestions ?? []}
                isSearchingAddress={isSearchingAddress}
                onSubmit={handleSubmit}
                submitLabel={
                    isUploading ? "Laster opp bilde …" : "Lagre endringer"
                }
                isSubmitting={updateEvent.isPending || isUploading}
                secondaryAction={
                    canDelete ? (
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setConfirmDelete(true)}
                            disabled={removeEvent.isPending}
                        >
                            Slett arrangement
                        </Button>
                    ) : undefined
                }
            >
                {uploadError && (
                    <Alert variant="destructive">
                        <XCircle className="size-4" />
                        <AlertTitle>Kunne ikke laste opp bildet</AlertTitle>
                        <AlertDescription>{uploadError}</AlertDescription>
                    </Alert>
                )}
                {updateEvent.isSuccess && (
                    <Alert>
                        <CheckCircle2 className="size-4" />
                        <AlertTitle>Lagret</AlertTitle>
                        <AlertDescription>
                            Endringene ble lagret.
                        </AlertDescription>
                    </Alert>
                )}
                {updateEvent.isError && (
                    <Alert variant="destructive">
                        <XCircle className="size-4" />
                        <AlertTitle>Kunne ikke lagre</AlertTitle>
                        <AlertDescription>
                            {updateEvent.error.message}
                        </AlertDescription>
                    </Alert>
                )}
            </EventForm>

            <ConfirmDeleteDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title={`Slette «${event.title}»?`}
                description="Arrangementet og alle påmeldinger slettes for godt. Dette kan ikke angres."
                confirmLabel="Slett arrangement"
                isPending={removeEvent.isPending}
                onConfirm={handleDelete}
            />
        </div>
    );
}

/* ------------------------------- Påmeldte ------------------------------- */

const REGISTRATION_STATUS_LABELS: Record<string, string> = {
    registered: "Påmeldt",
    attended: "Møtt",
    no_show: "Ikke møtt",
    waitlisted: "Venteliste",
    cancelled: "Avmeldt",
    pending: "Under behandling",
};

const REGISTRATION_STATUS_VARIANTS: Record<
    string,
    "default" | "secondary" | "outline" | "destructive"
> = {
    registered: "outline",
    attended: "default",
    no_show: "destructive",
    waitlisted: "secondary",
    cancelled: "secondary",
    pending: "secondary",
};

const REGISTRATION_FILTERS = [
    { value: "aktive", label: "Påmeldte", status: undefined },
    { value: "venteliste", label: "Venteliste", status: "waitlisted" },
    { value: "avmeldte", label: "Avmeldte", status: "cancelled,pending" },
] as const;

function RegistrationsTab({ eventId }: { eventId: string }) {
    const [filter, setFilter] =
        useState<(typeof REGISTRATION_FILTERS)[number]["value"]>("aktive");
    const status = REGISTRATION_FILTERS.find((f) => f.value === filter)?.status;

    const { data, isPending } = useQuery(
        getEventRegistrationsQuery(
            eventId,
            0,
            status ? { status } : {},
            MAX_PAGE_SIZE,
        ),
    );

    const participants = data?.registeredUsers ?? [];

    return (
        <div className="flex flex-col gap-4">
            <Tabs
                value={filter}
                onValueChange={(value) =>
                    setFilter(
                        value as (typeof REGISTRATION_FILTERS)[number]["value"],
                    )
                }
            >
                <TabsList>
                    {REGISTRATION_FILTERS.map((f) => (
                        <TabsTrigger key={f.value} value={f.value}>
                            {f.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {isPending ? (
                <TableSkeleton />
            ) : participants.length === 0 ? (
                <Card>
                    <CardContent>
                        <AdminEmptyState
                            icon={UsersIcon}
                            title="Ingen påmeldte"
                            description="Ingen deltakere i denne kategorien."
                        />
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Navn</TableHead>
                                    <TableHead>E-post</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Betaling</TableHead>
                                    <TableHead>Påmeldt</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {participants.map((participant) => {
                                    const participantStatus =
                                        participant.status ?? "registered";
                                    return (
                                        <TableRow key={participant.id}>
                                            <TableCell>
                                                {participant.name}
                                                {participant.waitlistPosition !=
                                                null
                                                    ? ` (#${participant.waitlistPosition})`
                                                    : ""}
                                            </TableCell>
                                            <TableCell>
                                                {participant.email ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        REGISTRATION_STATUS_VARIANTS[
                                                            participantStatus
                                                        ] ?? "outline"
                                                    }
                                                >
                                                    {REGISTRATION_STATUS_LABELS[
                                                        participantStatus
                                                    ] ?? participantStatus}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {participant.payment ? (
                                                    <PaymentStatusBadge
                                                        status={
                                                            participant.payment
                                                                .status
                                                        }
                                                    />
                                                ) : (
                                                    "—"
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {participant.registeredAt
                                                    ? formatDateTime(
                                                          participant.registeredAt,
                                                      )
                                                    : "—"}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/* -------------------------------- Oppmøte -------------------------------- */

function AttendanceTab({ eventId }: { eventId: string }) {
    const canSetAttendance = useAnyScopePermission([
        "events:update",
        "events:manage",
    ]);
    const { data, isPending } = useQuery(
        getEventRegistrationsQuery(eventId, 0, {}, MAX_PAGE_SIZE),
    );
    const setAttendance = useMutation(setAttendanceMutation);

    const participants = data?.registeredUsers ?? [];

    const stats = useMemo(() => {
        const attended = participants.filter(
            (p) => p.status === "attended",
        ).length;
        return { attended, total: participants.length };
    }, [participants]);

    if (isPending) {
        return <TableSkeleton />;
    }

    if (participants.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={CircleCheckBigIcon}
                        title="Ingen påmeldte"
                        description="Dette arrangementet har ingen påmeldte deltakere."
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <Alert>
                <CircleCheckBigIcon className="size-4" />
                <AlertTitle>Slik gis no-show-prikker</AlertTitle>
                <AlertDescription>
                    Huk av dem som møtte opp. Etter at arrangementet er slutt
                    gir systemet automatisk 2 prikker til alle som fortsatt er
                    påmeldt – men kun for arrangementer som kan gi prikker, og
                    kun dersom minst én er huket av.
                </AlertDescription>
            </Alert>

            <div className="grid gap-4 sm:grid-cols-2">
                <AdminStatCard
                    label="Møtt"
                    value={`${stats.attended} / ${stats.total}`}
                    icon={CircleCheckBigIcon}
                />
                <AdminStatCard
                    label="Påmeldte"
                    value={stats.total}
                    icon={UsersIcon}
                />
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Navn</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">
                                    Møtt
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {participants.map((participant) => {
                                const status =
                                    participant.status ?? "registered";
                                return (
                                    <TableRow key={participant.id}>
                                        <TableCell>
                                            {participant.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    REGISTRATION_STATUS_VARIANTS[
                                                        status
                                                    ] ?? "outline"
                                                }
                                            >
                                                {REGISTRATION_STATUS_LABELS[
                                                    status
                                                ] ?? status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end">
                                                <Checkbox
                                                    checked={
                                                        status === "attended"
                                                    }
                                                    disabled={
                                                        !canSetAttendance ||
                                                        setAttendance.isPending
                                                    }
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        setAttendance.mutate({
                                                            eventId,
                                                            userId: participant.id,
                                                            attended:
                                                                Boolean(
                                                                    checked,
                                                                ),
                                                        })
                                                    }
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

/* -------------------------------- Skjemaer ------------------------------- */

/**
 * Påmeldingsskjema og evalueringsskjema for arrangementet.
 *
 * Evalueringen er den som betyr noe i praksis: den kan bare besvares av dem
 * som er markert «Ankommet», og et ubesvart evalueringsskjema sperrer for
 * påmelding til alt annet. Det er slik en bedpres faktisk får svar.
 */
const EVENT_FORM_KINDS = [
    {
        type: "survey" as const,
        label: "Påmeldingsskjema",
        description:
            "Besvares når man melder seg på. Brukes til allergier, ønsker og lignende.",
        dialogTitle: "Nytt påmeldingsskjema",
    },
    {
        type: "evaluation" as const,
        label: "Evalueringsskjema",
        description:
            "Kan bare besvares av dem som er markert «Ankommet». Så lenge det står ubesvart kan deltakeren ikke melde seg på nye arrangementer.",
        dialogTitle: "Nytt evalueringsskjema",
    },
];

function FormsTab({ eventId }: { eventId: string }) {
    const { data: forms, isPending } = useQuery(getEventFormsQuery(eventId));
    const createForm = useMutation(createEventFormMutation);

    const [creating, setCreating] = useState<"survey" | "evaluation" | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);

    const kind = EVENT_FORM_KINDS.find((k) => k.type === creating);

    async function handleCreate(values: NewFormValues) {
        if (!creating) return;
        setError(null);
        try {
            await createForm.mutateAsync({
                eventId,
                data: {
                    event: eventId,
                    type: creating,
                    title: values.title,
                    template: false,
                    ...(values.description
                        ? { description: values.description }
                        : {}),
                    fields: values.questions.map((question, order) => ({
                        title: question.title,
                        type: question.type,
                        required: question.required,
                        order,
                        options:
                            question.type === "text_answer"
                                ? []
                                : question.options.map(
                                      (option, optionOrder) => ({
                                          title: option.title,
                                          order: optionOrder,
                                      }),
                                  ),
                    })),
                },
            });
            setCreating(null);
        } catch (err) {
            setError(await extractErrorMessage(err));
        }
    }

    if (isPending) return <TableSkeleton />;

    return (
        <div className="flex flex-col gap-4">
            {EVENT_FORM_KINDS.map(({ type, label, description }) => {
                const existing = forms?.find((form) => form.type === type);

                return (
                    <Card key={type}>
                        <CardHeader>
                            <CardTitle>{label}</CardTitle>
                            <CardDescription>{description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            {existing ? (
                                <>
                                    <p className="text-sm">{existing.title}</p>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            render={
                                                <Link
                                                    to="/sporreskjema/$id"
                                                    params={{
                                                        id: existing.id,
                                                    }}
                                                />
                                            }
                                        >
                                            Se skjema
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setError(null);
                                            setCreating(type);
                                        }}
                                    >
                                        <PlusIcon className="size-4" />
                                        Opprett {label.toLowerCase()}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}

            <NewFormDialog
                open={creating !== null}
                onOpenChange={(open) => {
                    if (!open) setCreating(null);
                }}
                onSubmit={handleCreate}
                isSubmitting={createForm.isPending}
                error={error}
                title={kind?.dialogTitle ?? "Nytt skjema"}
                description={kind?.description ?? ""}
                submitLabel="Opprett skjema"
                showGroupSettings={false}
            />
        </div>
    );
}

/* ------------------------------ Betalinger ------------------------------ */

const PAYMENT_STATUS_LABELS: Record<string, string> = {
    pending: "Venter",
    paid: "Betalt",
    refunded: "Refundert",
    failed: "Mislyktes",
};

const PAYMENT_STATUS_VARIANTS: Record<
    string,
    "default" | "secondary" | "outline" | "destructive"
> = {
    pending: "outline",
    paid: "default",
    refunded: "secondary",
    failed: "destructive",
};

function PaymentStatusBadge({ status }: { status: string }) {
    return (
        <Badge variant={PAYMENT_STATUS_VARIANTS[status] ?? "outline"}>
            {PAYMENT_STATUS_LABELS[status] ?? status}
        </Badge>
    );
}

function PaymentsTab({ eventId }: { eventId: string }) {
    const { data } = useSuspenseQuery(getEventPaymentsQuery(eventId, 0));
    const canRefund = useAnyScopePermission(["events:payments:refund"]);

    if (data.payments.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={WalletIcon}
                        title="Ingen betalinger"
                        description="Det er ikke registrert noen betalinger for dette arrangementet."
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
                <AdminStatCard
                    label="Betalt"
                    value={data.summary.paidCount}
                    icon={WalletIcon}
                />
                <AdminStatCard
                    label="Venter"
                    value={data.summary.pendingCount}
                    icon={WalletIcon}
                />
                <AdminStatCard
                    label="Sum innbetalt"
                    value={formatAmount(data.summary.totalPaidMinor)}
                    icon={WalletIcon}
                />
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Navn</TableHead>
                                <TableHead>E-post</TableHead>
                                <TableHead>Beløp</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Betalt</TableHead>
                                <TableHead className="text-right">
                                    Handlinger
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.payments.map((payment) => (
                                <TableRow key={payment.id}>
                                    <TableCell>{payment.user.name}</TableCell>
                                    <TableCell>{payment.user.email}</TableCell>
                                    <TableCell>
                                        {formatAmount(payment.amountMinor)}
                                    </TableCell>
                                    <TableCell>
                                        <PaymentStatusBadge
                                            status={payment.status}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {payment.receivedPaymentAt
                                            ? formatDateTime(
                                                  payment.receivedPaymentAt,
                                              )
                                            : "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {canRefund &&
                                        payment.status === "paid" ? (
                                            <RefundAction
                                                eventId={eventId}
                                                paymentId={payment.id}
                                                name={payment.user.name}
                                                amountMinor={
                                                    payment.amountMinor
                                                }
                                            />
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Refunding moves real money, so the first click only reveals a confirmation
 * naming the payer and the amount — the second click executes it.
 */
function RefundAction({
    eventId,
    paymentId,
    name,
    amountMinor,
}: {
    eventId: string;
    paymentId: string;
    name: string;
    amountMinor: number;
}) {
    const [confirming, setConfirming] = useState(false);
    const refund = useMutation(refundEventPaymentMutation);

    if (refund.isError) {
        return (
            <div className="flex flex-col items-end gap-1">
                <span className="text-destructive text-sm">
                    {refund.error.message}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refund.reset()}
                >
                    Prøv igjen
                </Button>
            </div>
        );
    }

    if (!confirming) {
        return (
            <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(true)}
            >
                Refunder
            </Button>
        );
    }

    return (
        <div className="flex flex-col items-end gap-2">
            <span className="text-sm">
                Refundere {formatAmount(amountMinor)} til {name}?
            </span>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirming(false)}
                    disabled={refund.isPending}
                >
                    Avbryt
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    disabled={refund.isPending}
                    onClick={() =>
                        refund.mutate(
                            { eventId, paymentId },
                            { onSuccess: () => setConfirming(false) },
                        )
                    }
                >
                    {refund.isPending ? "Refunderer …" : "Ja, refunder"}
                </Button>
            </div>
        </div>
    );
}

/* -------------------------------- Helpers -------------------------------- */

function formatDateTime(iso: string) {
    return format(new Date(iso), "d. MMM yyyy 'kl.' HH:mm", { locale: nb });
}

/** Minor units (øre) -> "1 234 kr" */
function formatAmount(minor: number) {
    return `${(minor / 100).toLocaleString("nb-NO")} kr`;
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
