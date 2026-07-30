import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
    CircleCheckBigIcon,
    UsersIcon,
    WalletIcon,
    XCircle,
} from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
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

import { searchAddressQuery } from "#/api/queries/address";
import { useImageUploader } from "#/api/queries/assets";
import {
    deleteEventMutation,
    getEventByIdQuery,
    getEventPaymentsQuery,
    getEventRegistrationsQuery,
    refundEventPaymentMutation,
    setAttendanceMutation,
    updateEventMutation,
} from "#/api/queries/events";
import { getGroupsQuery } from "#/api/queries/groups";
import { getInstitutesQuery } from "#/api/queries/institutes";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { AdminStatCard } from "#/components/admin-stat-card";
import type { EventFormValues } from "#/components/event-form";
import { EventForm } from "#/components/event-form";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { useDebounced } from "#/lib/use-debounced";

const TABS = ["detaljer", "pameldte", "oppmote", "betalinger"] as const;
type TabValue = (typeof TABS)[number];

/** The API caps pageSize at 100; asking for more is a 400. */
const MAX_PAGE_SIZE = 100;

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
        void context.queryClient.ensureQueryData(getGroupsQuery(0));
        void context.queryClient.ensureQueryData(getInstitutesQuery());
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
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title={event.title}
                description={`${formatDateTime(event.startTime)} · ${event.organizer?.name ?? "Ingen arrangør"}`}
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
            {activeTab === "betalinger" && canSeePayments && (
                <Suspense fallback={<TableSkeleton />}>
                    <PaymentsTab eventId={eventId} />
                </Suspense>
            )}
        </div>
    );
}

/* ------------------------------- Detaljer ------------------------------- */

function DetailsTab({ eventId }: { eventId: string }) {
    const navigate = useNavigate();
    const { data: event } = useSuspenseQuery(getEventByIdQuery(eventId));
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));
    const { data: institutes } = useSuspenseQuery(getInstitutesQuery());

    const canEdit = useAnyScopePermission(["events:update", "events:manage"]);
    const canDelete = useAnyScopePermission(["events:delete", "events:manage"]);

    const [addressQuery, setAddressQuery] = useState(event.location ?? "");
    const debouncedAddress = useDebounced(addressQuery, 250);
    const { data: addressSuggestions, isFetching: isSearchingAddress } =
        useQuery(searchAddressQuery(debouncedAddress));

    const updateEvent = useMutation(updateEventMutation);
    const removeEvent = useMutation(deleteEventMutation);
    const { uploadImage, isUploading } = useImageUploader();
    const [uploadError, setUploadError] = useState<string | null>(null);

    async function handleSubmit(values: EventFormValues, image: File | null) {
        setUploadError(null);

        let imageUrl: string | null = null;
        if (image) {
            try {
                imageUrl = await uploadImage(image);
            } catch (err) {
                setUploadError(
                    err instanceof Error ? err.message : String(err),
                );
                return;
            }
        }

        updateEvent.mutate({
            eventId,
            data: {
                ...values,
                // Only send an image when a new one was picked, so saving the
                // form never clears an existing cover.
                ...(imageUrl ? { imageUrl, imageAlt: values.imageAlt } : {}),
                registrationStart: null,
                cancellationDeadline: null,
                isRegistrationClosed: event.closed,
                requiresSigningUp: true,
                allowWaitlist: true,
                priorityPools: null,
                onlyAllowPrioritized: event.onlyAllowPrioritized,
                enforcesPreviousStrikes: values.canCauseStrikes,
                paymentGracePeriodMinutes:
                    event.payInfo?.paymentGracePeriodMinutes ?? null,
                contactPersonUserId: null,
                reactionsAllowed: false,
            },
        });
    }

    function handleDelete() {
        if (
            !window.confirm(
                `Slette «${event.title}»? Dette kan ikke angres, og alle påmeldinger forsvinner.`,
            )
        ) {
            return;
        }
        removeEvent.mutate(
            { eventId },
            {
                onSuccess: () => navigate({ to: "/admin/arrangementer" }),
            },
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
        <EventForm
            key={event.updatedAt}
            groups={groups}
            institutes={institutes}
            existingImageUrl={event.image}
            initialValues={{
                title: event.title,
                description: event.description ?? "",
                categorySlug: event.category.slug,
                organizerGroupSlug: event.organizer?.slug ?? "",
                location: event.location ?? "",
                locationLat: event.locationLat ?? null,
                locationLng: event.locationLng ?? null,
                start: event.startTime,
                end: event.endTime,
                registrationEnd: event.registrationEndTime,
                capacity: event.capacity,
                visibility: event.visibility,
                restrictedToInstituteSlug:
                    event.restrictedToInstitute?.slug ?? null,
                isPaidEvent: event.isPaidEvent,
                // payInfo.price is in minor units (øre) while the form — and
                // the update endpoint — work in whole kroner.
                price:
                    event.payInfo?.price != null
                        ? Math.round(event.payInfo.price / 100)
                        : null,
                canCauseStrikes: event.canCauseStrikes,
                imageAlt: event.imageAlt,
            }}
            submitLabel="Lagre endringer"
            submitDisabledLabel="Lagrer …"
            isSubmitting={updateEvent.isPending || isUploading}
            addressSuggestions={addressSuggestions ?? []}
            isSearchingAddress={isSearchingAddress}
            onAddressQueryChange={setAddressQuery}
            onSubmit={handleSubmit}
            actions={
                canDelete ? (
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={removeEvent.isPending}
                    >
                        Slett arrangement
                    </Button>
                ) : null
            }
        >
            {uploadError && (
                <Alert variant="destructive">
                    <XCircle className="size-4" />
                    <AlertTitle>Kunne ikke laste opp bildet</AlertTitle>
                    <AlertDescription>{uploadError}</AlertDescription>
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
