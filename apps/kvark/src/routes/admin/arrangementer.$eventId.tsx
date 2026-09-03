import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useSuspenseInfiniteQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import {
    createFileRoute,
    Link,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import {
    BanknoteArrowDownIcon,
    BanknoteIcon,
    CheckCircle2,
    CircleCheckBigIcon,
    ExternalLink,
    EyeIcon,
    FilterIcon,
    PlusIcon,
    TriangleAlertIcon,
    CheckIcon,
    CircleHelpIcon,
    CopyIcon,
    ShieldQuestionMarkIcon,
    UsersIcon,
    UtensilsCrossedIcon,
    WalletIcon,
    XCircle,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import type { Event, EventPaymentAdmin, UpdateEventSchema } from "@tihlde/sdk";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@tihlde/ui/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@tihlde/ui/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";

import { Stagger } from "@tihlde/ui/ui/motion";

import { requireAdminSection } from "#/lib/admin-access";
import { searchAddressQuery } from "#/api/queries/address";
import { useImageUploader } from "#/api/queries/assets";
import {
    createEventFormMutation,
    deleteEventMutation,
    getEventByIdQuery,
    getEventFormsQuery,
    getEventAllergiesQuery,
    getEventPaymentsInfiniteQuery,
    getEventRegistrationsInfiniteQuery,
    refundEventPaymentMutation,
    setAttendanceMutation,
    updateEventMutation,
} from "#/api/queries/events";
import { getGroupMembersQuery, getGroupsQuery } from "#/api/queries/groups";
import { getInstitutesQuery } from "#/api/queries/institutes";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AttendanceScannerDialog } from "#/components/attendance-scanner-dialog";
import { AdminPageHeader } from "#/components/admin-page-header";
import { AdminStatCard } from "#/components/admin-stat-card";
import { ConfirmDeleteDialog } from "#/components/confirm-delete-dialog";
import type { EventFormValues } from "#/components/event-form";
import { ALL_INSTITUTES, EventForm } from "#/components/event-form";
import {
    allowedPoolKeys,
    poolsForSubmit,
    toFormPool,
} from "#/components/priority-pool-editor";
import { usePriorityUserSearch } from "#/hooks/use-priority-user-search";
import type { NewFormValues } from "#/components/new-form-dialog";
import { NewFormDialog } from "#/components/new-form-dialog";
import {
    useAnyScopePermission,
    useCanActForGroup,
    useCanActOnGroupResource,
} from "#/hooks/use-permission";
import { extractErrorMessage } from "#/lib/api-error";
import {
    classLevelBucket,
    classLevelBucketLabel,
    cn,
    formatStudyLabel,
} from "#/lib/utils";
import { EVENT_FORM_ERRORS } from "#/lib/event";
import { isCohortGroupType } from "#/lib/group";
import { useDebounced } from "#/lib/use-debounced";
import { formatInOslo } from "#/lib/date";

const TABS = [
    "detaljer",
    "pameldte",
    "oppmote",
    "skjemaer",
    "betalinger",
    "allergier",
] as const;
type TabValue = (typeof TABS)[number];

/** Module-level so the permission predicates keep a stable identity. */
const EVENT_UPDATE_PERMISSIONS = ["events:update", "events:manage"] as const;
const EVENT_DELETE_PERMISSIONS = ["events:delete", "events:manage"] as const;
const EVENT_PAYMENT_VIEW_PERMISSIONS = [
    "events:payments:view",
    "events:manage",
    "events:update",
] as const;

// Defaulted (not required) so plain links to the page need no search param,
// while the tab stays deep-linkable and survives a bad value.
const searchSchema = z.object({
    fane: z.enum(TABS).default("detaljer").catch("detaljer"),
});

export const Route = createFileRoute("/admin/arrangementer/$eventId")({
    component: EventAdminDetailPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "arrangementer");
    },
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

    const organizerSlug = event.organizer?.slug ?? null;

    // Rettigheten må gjelde arrangørgruppa — det er det API-et spør om. Uten
    // den er sida en lesevisning: du ser hva som står i feltene, ingenting
    // mer. Se `useCanActOnGroupResource`.
    const canManage = useCanActOnGroupResource(EVENT_UPDATE_PERMISSIONS)(
        organizerSlug,
        event.createdById,
    );
    const canSeePayments = useCanActOnGroupResource(
        EVENT_PAYMENT_VIEW_PERMISSIONS,
    )(organizerSlug, event.createdById);

    // Påmeldte, oppmøte og skjemaer er administrasjon av arrangementet, og
    // endepunktene bak dem svarer bare den som kan det. Uten tilgang står
    // detaljfanen igjen alene, i lesemodus.
    const visibleTabs = useMemo(
        () => [
            { value: "detaljer" as const, label: "Detaljer" },
            ...(canManage
                ? [
                      { value: "pameldte" as const, label: "Påmeldte" },
                      { value: "oppmote" as const, label: "Oppmøte" },
                      { value: "skjemaer" as const, label: "Skjemaer" },
                  ]
                : []),
            ...(canSeePayments
                ? [{ value: "betalinger" as const, label: "Betalinger" }]
                : []),
            ...(canManage
                ? [{ value: "allergier" as const, label: "Allergier" }]
                : []),
        ],
        [canManage, canSeePayments],
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
            {activeTab === "allergier" && canManage && (
                <Suspense fallback={<TableSkeleton />}>
                    <AllergiesTab eventId={eventId} />
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

/**
 * Fyller skjemaet med arrangementet slik det er lagret i dag.
 *
 * `allowedKeys` er kriteriene velgeren faktisk tilbyr for dette arrangementet;
 * alt annet i `priorityPools` faller bort — se `toFormPool`.
 */
function valuesFromEvent(
    event: Event,
    allowedKeys: ReadonlySet<string>,
): EventFormValues {
    const location = event.location ?? "";
    const hasCoords =
        typeof event.locationLat === "number" &&
        typeof event.locationLng === "number";

    return {
        // Arrangementet leverer poolene med hele gruppeobjekter; skjemaet
        // jobber på slugs, som er det API-et tar imot igjen. Kriterier som
        // ikke kan vises lenger faller bort her og telles av
        // `droppedPoolCount`, som sier fra i grensesnittet.
        priorityPools: (event.priorityPools ?? [])
            .map((pool) => toFormPool(pool, allowedKeys))
            .filter((pool) => pool !== null),
        // Navn og bilde er med så lista kan vise hvem det er; bare id-ene
        // sendes tilbake. Feltet er tomt for de som ikke kan redigere
        // arrangementet — API-et deler ikke navngitte personer med andre.
        priorityUsers: event.priorityUsers ?? [],
        onlyAllowPrioritized: event.onlyAllowPrioritized,
        openToAlumni: event.openToAlumni,
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

    // Samme regel som API-et: rettigheten for arrangørgruppa, eller å ha
    // opprettet arrangementet selv. Any-scope holdt ikke — den ga
    // redigeringsskjemaet for andre gruppers arrangementer også.
    const canEdit = useCanActOnGroupResource(EVENT_UPDATE_PERMISSIONS)(
        event.organizer?.slug ?? null,
        event.createdById,
    );
    const canDelete = useCanActOnGroupResource(EVENT_DELETE_PERMISSIONS)(
        event.organizer?.slug ?? null,
        event.createdById,
    );

    const allowedKeys = useMemo(
        () => allowedPoolKeys(allGroups, event.organizer?.slug ?? null),
        [allGroups, event.organizer?.slug],
    );

    const [values, setValues] = useState<EventFormValues>(() =>
        valuesFromEvent(event, allowedKeys),
    );
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const priorityUserSearch = usePriorityUserSearch();

    /**
     * Kriterier fra det gamle systemet som ikke lar seg vise — et kull som er
     * ferdigutdannet, eller en gruppe som ikke kan velges lenger. De ligger
     * fortsatt i databasen og virker, men lagring skriver poolene på nytt, så
     * da forsvinner de. Brukeren skal vite det før de trykker lagre.
     */
    const droppedPoolCount = useMemo(
        () =>
            (event.priorityPools ?? []).filter(
                (pool) => toFormPool(pool, allowedKeys) === null,
            ).length,
        [event.priorityPools, allowedKeys],
    );

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
        setFormError(null);

        // Hver vakt sier fra. Uten dette avbrøt de i stillhet, så «Lagre
        // endringer» så død ut på ethvert arrangement uten påmeldingsstart.
        const fail = (message: string) => setFormError(message);
        if (!values.start || !values.end) {
            return fail(EVENT_FORM_ERRORS.missingTime);
        }
        if (!values.categorySlug) {
            return fail(EVENT_FORM_ERRORS.missingCategory);
        }
        // Bare fristen er påkrevd. Påmeldingsstart kan stå tom: API-et lar
        // påmeldingen åpne med én gang når den er `null`.
        if (values.requiresSigningUp && !values.registrationEnd) {
            return fail(EVENT_FORM_ERRORS.missingRegistrationEnd);
        }
        // Se skjemaet: datovelgerne begrenser ikke lenger hverandre, så
        // rekkefølgen stoppes her.
        if (
            values.registrationStart &&
            values.registrationEnd &&
            values.registrationStart >= values.registrationEnd
        ) {
            return fail(EVENT_FORM_ERRORS.registrationOrder);
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
            // Uten påmelding er det ingenting å åpne for alumni.
            openToAlumni: values.requiresSigningUp && values.openToAlumni,
            // Betalte arrangementer gir aldri prikker.
            canCauseStrikes: canCauseStrikes,
            enforcesPreviousStrikes: canCauseStrikes,
            isPaidEvent: values.isPaidEvent,
            price:
                values.isPaidEvent && values.price
                    ? Number(values.price)
                    : null,
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

    return (
        <div className="flex flex-col gap-4">
            {/*
             * Lesevisning: du kom hit fra øyeikonet i lista, på et arrangement
             * en annen gruppe eier. Skjemaet vises som det er, låst — så man
             * kan se hvordan arrangementet er satt opp uten å kunne endre det.
             */}
            {canEdit ? null : (
                <Alert>
                    <EyeIcon className="size-4" />
                    <AlertTitle>Lesevisning</AlertTitle>
                    <AlertDescription>
                        {event.organizer
                            ? `Arrangementet eies av ${event.organizer.name}. Du kan se hvordan det er satt opp, men ikke endre det.`
                            : "Du kan se hvordan arrangementet er satt opp, men ikke endre det."}
                    </AlertDescription>
                </Alert>
            )}
            {canEdit && droppedPoolCount > 0 ? (
                <Alert variant="destructive">
                    <AlertTitle>
                        {droppedPoolCount === 1
                            ? "Ett prioriteringskriterium kan ikke vises"
                            : `${droppedPoolCount} prioriteringskriterier kan ikke vises`}
                    </AlertTitle>
                    <AlertDescription>
                        De er fra det gamle systemet og virker fortsatt, men de
                        fjernes hvis du lagrer arrangementet.
                    </AlertDescription>
                </Alert>
            ) : null}
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
                readOnly={!canEdit}
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
                {formError && (
                    <Alert variant="destructive">
                        <XCircle className="size-4" />
                        <AlertTitle>Kunne ikke lagre</AlertTitle>
                        <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                )}
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
] as const;

/**
 * Kullet og studiet til de påmeldte, som klikkbare tall.
 *
 * Bøttene regnes ut i nettleseren fra `studyProgram` og `studyStartYear` på
 * hver påmelding — arrangøren laster allerede hele lista for å kunne søke i
 * den, så et eget statistikk-endepunkt ville bare telt de samme radene en gang
 * til.
 */
type RegistrationFacets = {
    /** Klassetrinn-bøtte, se `classLevelBucket`. */
    classLevel: string | null;
    /** Studieprogram etter navn, eller `NO_STUDY` for dem uten. */
    study: string | null;
};

const NO_FACETS: RegistrationFacets = { classLevel: null, study: null };

/** Bøtte for den som ikke har noe studieprogram registrert. */
const NO_STUDY = "__none__";

type BreakdownParticipant = {
    studyProgram?: string | null;
    studyStartYear?: number | null;
};

function studyBucket(participant: BreakdownParticipant): string {
    return participant.studyProgram ?? NO_STUDY;
}

/**
 * Klassetrinnet til studielinja i tabellen, eller null for alumni og dem vi
 * ikke vet nok om — da står studiet alene, uten et årstall som antyder at de
 * fortsatt går der.
 */
function classYearOf(participant: BreakdownParticipant): number | null {
    const bucket = levelBucket(participant);
    const year = Number.parseInt(bucket, 10);
    return Number.isFinite(year) ? year : null;
}

function levelBucket(participant: BreakdownParticipant): string {
    return classLevelBucket(
        participant.studyProgram,
        participant.studyStartYear,
    );
}

/**
 * Teller opp en bøtte og sorterer den slik den skal leses: klassetrinnene
 * stigende, så alumni, så de vi ikke vet noe om. Studiene sorteres på antall,
 * med «ukjent studie» sist uansett hvor mange de er.
 */
function countBuckets(
    participants: BreakdownParticipant[],
    bucketOf: (participant: BreakdownParticipant) => string,
    rank: (bucket: string, count: number) => [number, number, string],
): Array<{ bucket: string; count: number }> {
    const counts = new Map<string, number>();
    for (const participant of participants) {
        const bucket = bucketOf(participant);
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }

    return [...counts.entries()]
        .map(([bucket, count]) => ({ bucket, count }))
        .sort((a, b) => {
            const rankA = rank(a.bucket, a.count);
            const rankB = rank(b.bucket, b.count);
            return (
                rankA[0] - rankB[0] ||
                rankA[1] - rankB[1] ||
                rankA[2].localeCompare(rankB[2], "nb-NO")
            );
        });
}

function rankClassLevel(bucket: string): [number, number, string] {
    if (bucket === "alumni") return [1, 0, bucket];
    if (bucket === "unknown") return [2, 0, bucket];
    return [0, Number.parseInt(bucket, 10), bucket];
}

function rankStudy(bucket: string, count: number): [number, number, string] {
    return [bucket === NO_STUDY ? 1 : 0, -count, bucket];
}

/**
 * Ett tall i fordelingen. Hele kortet er knappen som slår filteret av og på.
 *
 * `size="sm"` er hele poenget: `Card` har sin egen `py-4`, og et `CardContent`
 * med padding oppå ga kortet dobbelt sett luft — fire bøtter dekket to rader
 * av halve skjermen uten å si mer enn de gjør nå.
 */
function BreakdownCard({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <Card
            size="sm"
            render={<button type="button" />}
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                "cursor-pointer text-left transition-colors",
                active
                    ? "bg-primary/10 ring-primary"
                    : "hover:ring-foreground/20",
            )}
        >
            <CardContent className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <span
                        className={cn(
                            "truncate text-sm",
                            active
                                ? "font-medium text-primary"
                                : "text-muted-foreground",
                        )}
                    >
                        {label}
                    </span>
                    <span className="text-2xl leading-none tabular-nums">
                        {count}
                    </span>
                </div>
                {active ? (
                    <CheckIcon className="size-4 shrink-0 text-primary" />
                ) : null}
            </CardContent>
        </Card>
    );
}

function BreakdownSection({
    title,
    buckets,
    active,
    labelOf,
    onToggle,
}: {
    title: string;
    buckets: Array<{ bucket: string; count: number }>;
    active: string | null;
    labelOf: (bucket: string) => string;
    onToggle: (bucket: string) => void;
}) {
    if (buckets.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
                {title}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {buckets.map(({ bucket, count }) => (
                    <BreakdownCard
                        key={bucket}
                        label={labelOf(bucket)}
                        count={count}
                        active={active === bucket}
                        onClick={() => onToggle(bucket)}
                    />
                ))}
            </div>
        </div>
    );
}

function RegistrationsTab({ eventId }: { eventId: string }) {
    const [filter, setFilter] =
        useState<(typeof REGISTRATION_FILTERS)[number]["value"]>("aktive");
    const status = REGISTRATION_FILTERS.find((f) => f.value === filter)?.status;
    const [search, setSearch] = useState("");
    const [facets, setFacets] = useState<RegistrationFacets>(NO_FACETS);

    const registrationsQuery = useInfiniteQuery(
        getEventRegistrationsInfiniteQuery(eventId, status ? { status } : {}),
    );
    useLoadAllPages(registrationsQuery);

    const participants = useMemo(() => {
        const rows =
            registrationsQuery.data?.pages.flatMap(
                (page) => page.registeredUsers,
            ) ?? [];
        // Ventelista leses ovenfra og ned: den som står øverst er den som får
        // plassen når noen melder seg av. Lista kommer nyeste først fra API-et,
        // som er riktig for påmeldte, men snur ventelista på hodet.
        if (status !== "waitlisted") {
            return rows;
        }
        return [...rows].sort(
            (a, b) =>
                (a.waitlistPosition ?? Number.MAX_SAFE_INTEGER) -
                (b.waitlistPosition ?? Number.MAX_SAFE_INTEGER),
        );
    }, [registrationsQuery.data, status]);
    const isPending = registrationsQuery.isPending;

    /**
     * Tallene på kortene teller alle påmeldte, men hver fordeling ser bort fra
     * sitt eget filter og respekterer det andre: står du på «2. klasse», viser
     * studiekortene hvor mange andreklassinger som går hvert studie. Ellers
     * ville kortet sagt 12 og tabellen vist 3.
     */
    const classLevelBuckets = useMemo(
        () =>
            countBuckets(
                participants.filter(
                    (p) =>
                        facets.study === null ||
                        studyBucket(p) === facets.study,
                ),
                levelBucket,
                rankClassLevel,
            ),
        [participants, facets.study],
    );

    const studyBuckets = useMemo(
        () =>
            countBuckets(
                participants.filter(
                    (p) =>
                        facets.classLevel === null ||
                        levelBucket(p) === facets.classLevel,
                ),
                studyBucket,
                rankStudy,
            ),
        [participants, facets.classLevel],
    );

    const hasFacet = facets.classLevel !== null || facets.study !== null;

    const facetedParticipants = useMemo(
        () =>
            participants.filter(
                (participant) =>
                    (facets.classLevel === null ||
                        levelBucket(participant) === facets.classLevel) &&
                    (facets.study === null ||
                        studyBucket(participant) === facets.study),
            ),
        [participants, facets.classLevel, facets.study],
    );

    const query = search.trim().toLowerCase();
    const visibleParticipants = useMemo(
        () =>
            facetedParticipants.filter((participant) =>
                matchesQuery([participant.name, participant.email], query),
            ),
        [facetedParticipants, query],
    );

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

            {participants.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <BreakdownSection
                        title="Kull"
                        buckets={classLevelBuckets}
                        active={facets.classLevel}
                        labelOf={classLevelBucketLabel}
                        onToggle={(bucket) =>
                            setFacets((current) => ({
                                ...current,
                                classLevel:
                                    current.classLevel === bucket
                                        ? null
                                        : bucket,
                            }))
                        }
                    />
                    <BreakdownSection
                        title="Studie"
                        buckets={studyBuckets}
                        active={facets.study}
                        labelOf={(bucket) =>
                            bucket === NO_STUDY ? "Ukjent studie" : bucket
                        }
                        onToggle={(bucket) =>
                            setFacets((current) => ({
                                ...current,
                                study: current.study === bucket ? null : bucket,
                            }))
                        }
                    />
                </div>
            ) : null}

            {hasFacet ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm">
                    <FilterIcon className="size-4 shrink-0 text-primary" />
                    <span>
                        Viser {facetedParticipants.length} av{" "}
                        {participants.length} påmeldte:
                    </span>
                    {facets.classLevel !== null ? (
                        <Badge variant="secondary">
                            {classLevelBucketLabel(facets.classLevel)}
                        </Badge>
                    ) : null}
                    {facets.study !== null ? (
                        <Badge variant="secondary">
                            {facets.study === NO_STUDY
                                ? "Ukjent studie"
                                : facets.study}
                        </Badge>
                    ) : null}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => setFacets(NO_FACETS)}
                    >
                        Nullstill
                    </Button>
                </div>
            ) : null}

            {participants.length > 0 ? (
                <SearchField
                    id="registrations-search"
                    value={search}
                    onChange={setSearch}
                />
            ) : null}

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
            ) : visibleParticipants.length === 0 ? (
                <Card>
                    <CardContent>
                        <AdminEmptyState
                            icon={UsersIcon}
                            title="Ingen treff"
                            description={
                                query
                                    ? `Ingen påmeldte matcher «${search.trim()}».`
                                    : "Ingen påmeldte i utvalget du har filtrert på."
                            }
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
                                    <TableHead>Studie</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Betaling</TableHead>
                                    <TableHead>Påmeldt</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleParticipants.map((participant) => {
                                    const participantStatus =
                                        participant.status ?? "registered";
                                    return (
                                        <TableRow key={participant.id}>
                                            <TableCell>
                                                {participant.waitlistPosition !=
                                                null ? (
                                                    <span className="text-muted-foreground mr-2 tabular-nums">
                                                        {
                                                            participant.waitlistPosition
                                                        }
                                                        .
                                                    </span>
                                                ) : null}
                                                {participant.name}
                                            </TableCell>
                                            <TableCell>
                                                {participant.email ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center gap-1.5">
                                                    {formatStudyLabel({
                                                        programme:
                                                            participant.studyProgram,
                                                        classYear:
                                                            classYearOf(
                                                                participant,
                                                            ),
                                                    }) ?? "—"}
                                                    <StudyVerificationMark
                                                        verification={
                                                            participant.studyVerification
                                                        }
                                                    />
                                                </span>
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
    const registrations = useInfiniteQuery(
        getEventRegistrationsInfiniteQuery(eventId),
    );
    useLoadAllPages(registrations);
    const setAttendance = useMutation(setAttendanceMutation);
    const [search, setSearch] = useState("");

    const participants = useMemo(
        () =>
            registrations.data?.pages.flatMap((page) => page.registeredUsers) ??
            [],
        [registrations.data],
    );
    const isPending = registrations.isPending;

    const stats = useMemo(() => {
        const attended = participants.filter(
            (p) => p.status === "attended",
        ).length;
        return { attended, total: participants.length };
    }, [participants]);

    const query = search.trim().toLowerCase();
    const visibleParticipants = useMemo(
        () =>
            participants.filter((participant) =>
                matchesQuery([participant.name, participant.email], query),
            ),
        [participants, query],
    );

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

            {canSetAttendance ? (
                <div className="flex justify-end">
                    <AttendanceScannerDialog eventId={eventId} />
                </div>
            ) : null}

            <SearchField
                id="attendance-search"
                value={search}
                onChange={setSearch}
            />

            {visibleParticipants.length === 0 ? (
                <Card>
                    <CardContent>
                        <AdminEmptyState
                            icon={UsersIcon}
                            title="Ingen treff"
                            description={`Ingen påmeldte matcher «${search.trim()}».`}
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
                                    <TableHead>Status</TableHead>
                                    {/* pr-3 møter avkryssingsboksens usynlige
                                        trykkflate (::after, 12px utenfor
                                        boksen). Den ga tabellen vannrett
                                        rulling og dyttet boksen ut av lodd med
                                        denne overskriften. */}
                                    <TableHead className="pr-3 text-right">
                                        Møtt
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleParticipants.map((participant) => {
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
                                                <div className="flex justify-end pr-3">
                                                    <Checkbox
                                                        checked={
                                                            status ===
                                                            "attended"
                                                        }
                                                        disabled={
                                                            !canSetAttendance ||
                                                            setAttendance.isPending
                                                        }
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            setAttendance.mutate(
                                                                {
                                                                    eventId,
                                                                    userId: participant.id,
                                                                    attended:
                                                                        Boolean(
                                                                            checked,
                                                                        ),
                                                                },
                                                            )
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
            )}
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

/**
 * Merket som sier at studiet bak en prioritering ikke er bekreftet av Feide.
 *
 * Studiegruppa er det prioriteringen leser, og den fjernes aldri av seg selv:
 * den som byttet studium eller ble ferdig står der til de logger inn med Feide
 * igjen. Arrangøren så ingen forskjell på et studium NTNU har bekreftet denne
 * måneden og ett som ble skrevet inn på et fadderuke-skjema i 2024.
 *
 * Vises bare når det er noe å si. Er studiet bekreftet, er raden ren — et
 * grønt merke på tre av fire deltakere hadde vært støy, og det er avviket
 * arrangøren skal kunne få øye på.
 */
function StudyVerificationMark({
    verification,
}: {
    verification?: "verified" | "stale" | "unverified";
}) {
    if (!verification || verification === "verified") return null;

    const explanation =
        verification === "stale"
            ? "Feide har bekreftet studiet, men ikke på over et semester. Medlemmet kan ha byttet studium eller blitt ferdig uten at vi vet det."
            : "Studiet er aldri bekreftet av Feide. Det kommer fra Lepton-importen, fadderuke-påmeldingen eller en manuell retting, og sier ingenting om at medlemmet faktisk går der nå.";

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <span
                        className="text-muted-foreground inline-flex"
                        aria-label={explanation}
                    >
                        <ShieldQuestionMarkIcon className="size-3.5" />
                    </span>
                }
            />
            <TooltipContent className="max-w-72">{explanation}</TooltipContent>
        </Tooltip>
    );
}

function PaymentStatusBadge({ status }: { status: string }) {
    return (
        <Badge variant={PAYMENT_STATUS_VARIANTS[status] ?? "outline"}>
            {PAYMENT_STATUS_LABELS[status] ?? status}
        </Badge>
    );
}

const PAYMENT_FLAG_LABELS: Record<string, string> = {
    provider_unreachable: "Vipps svarte ikke",
    paid_without_spot: "Betalt uten plass",
};

const PAYMENT_FLAG_HINTS: Record<string, string> = {
    provider_unreachable:
        "Betalingsfristen gikk ut mens Vipps ikke kunne nås. Sjekk i Vipps om betalingen faktisk gikk gjennom.",
    paid_without_spot:
        "Betalingen gikk gjennom, men personen har ikke plass på arrangementet. Vurder om den skal refunderes.",
};

function PaymentFlagBadge({ flag }: { flag: string }) {
    return (
        <Badge
            variant="destructive"
            title={PAYMENT_FLAG_HINTS[flag] ?? undefined}
        >
            {PAYMENT_FLAG_LABELS[flag] ?? flag}
        </Badge>
    );
}

/**
 * One person can leave a trail of payment attempts behind — a started Vipps
 * payment that expired, a retry, the one that finally went through. Listing
 * them flat buries the person in their own attempts, so each accordion is one
 * payer and the attempts live inside it.
 */
type PaymentGroup = {
    userId: string;
    user: EventPaymentAdmin["user"];
    /** Newest attempt first. */
    payments: EventPaymentAdmin[];
    /** What the payer's situation is, across every attempt. */
    status: EventPaymentAdmin["status"];
    /** Paid total, or the newest attempt's amount when nothing is paid. */
    amountMinor: number;
    flags: NonNullable<EventPaymentAdmin["flag"]>[];
};

/** The state an organiser should read off the closed accordion, in priority order. */
const PAYMENT_STATUS_PRIORITY: EventPaymentAdmin["status"][] = [
    "paid",
    "pending",
    "refunded",
    "failed",
];

function groupPaymentsByUser(payments: EventPaymentAdmin[]): PaymentGroup[] {
    const groups = new Map<string, EventPaymentAdmin[]>();
    for (const payment of payments) {
        const existing = groups.get(payment.userId);
        if (existing) existing.push(payment);
        else groups.set(payment.userId, [payment]);
    }

    return Array.from(groups.values())
        .map((userPayments) => {
            const sorted = [...userPayments].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime(),
            );
            const statuses = new Set(sorted.map((payment) => payment.status));
            const status =
                PAYMENT_STATUS_PRIORITY.find((candidate) =>
                    statuses.has(candidate),
                ) ?? sorted[0].status;
            const paid = sorted.filter((payment) => payment.status === "paid");
            const amountMinor =
                paid.length > 0
                    ? paid.reduce(
                          (sum, payment) => sum + payment.amountMinor,
                          0,
                      )
                    : sorted[0].amountMinor;

            return {
                userId: sorted[0].userId,
                user: sorted[0].user,
                payments: sorted,
                status,
                amountMinor,
                flags: Array.from(
                    new Set(
                        sorted
                            .map((payment) => payment.flag)
                            .filter(
                                (
                                    flag,
                                ): flag is NonNullable<
                                    EventPaymentAdmin["flag"]
                                > => Boolean(flag),
                            ),
                    ),
                ),
            };
        })
        .sort((a, b) => a.user.name.localeCompare(b.user.name, "nb"));
}

function PaymentsTab({ eventId }: { eventId: string }) {
    const paymentsQuery = useSuspenseInfiniteQuery(
        getEventPaymentsInfiniteQuery(eventId),
    );
    useLoadAllPages(paymentsQuery);
    const canRefund = useAnyScopePermission(["events:payments:refund"]);
    const [search, setSearch] = useState("");

    const payments = useMemo(
        () => paymentsQuery.data.pages.flatMap((page) => page.payments),
        [paymentsQuery.data],
    );
    // Summen dekker hele arrangementet, ikke bare siden, så første side holder.
    const summary = paymentsQuery.data.pages[0].summary;

    const groups = useMemo(() => groupPaymentsByUser(payments), [payments]);

    const query = search.trim().toLowerCase();
    const visibleGroups = useMemo(
        () =>
            groups.filter((group) =>
                matchesQuery([group.user.name, group.user.email], query),
            ),
        [groups, query],
    );

    if (payments.length === 0) {
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
                    value={summary.paidCount}
                    icon={WalletIcon}
                />
                <AdminStatCard
                    label="Venter"
                    value={summary.pendingCount}
                    icon={WalletIcon}
                />
                <AdminStatCard
                    label="Sum innbetalt"
                    value={formatAmount(summary.totalPaidMinor)}
                    icon={WalletIcon}
                />
            </div>

            {summary.flaggedCount > 0 ? (
                <Card className="border-destructive/50">
                    <CardContent className="flex items-center gap-3 py-4 text-sm">
                        <TriangleAlertIcon className="size-4 shrink-0 text-destructive" />
                        <span>
                            {summary.flaggedCount === 1
                                ? "1 betaling trenger gjennomgang."
                                : `${summary.flaggedCount} betalinger trenger gjennomgang.`}{" "}
                            Se merkelappene på personene under.
                        </span>
                    </CardContent>
                </Card>
            ) : null}

            <SearchField
                id="payments-search"
                value={search}
                onChange={setSearch}
            />

            {visibleGroups.length === 0 ? (
                <Card>
                    <CardContent>
                        <AdminEmptyState
                            icon={WalletIcon}
                            title="Ingen treff"
                            description={`Ingen betalinger matcher «${search.trim()}».`}
                        />
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Accordion>
                            {visibleGroups.map((group) => (
                                <AccordionItem
                                    key={group.userId}
                                    value={group.userId}
                                    className="px-4"
                                >
                                    {/* Standardtriggeren toppstiller innholdet;
                                        her er raden to linjer høy, så pila
                                        skal stå midt i den. */}
                                    <AccordionTrigger className="items-center hover:no-underline">
                                        <div className="flex flex-1 flex-col gap-2 pr-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex flex-col">
                                                <span>{group.user.name}</span>
                                                <span className="text-muted-foreground text-xs font-normal">
                                                    {group.user.email}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {group.flags.map((flag) => (
                                                    <PaymentFlagBadge
                                                        key={flag}
                                                        flag={flag}
                                                    />
                                                ))}
                                                <span className="text-muted-foreground text-xs font-normal">
                                                    {group.payments.length === 1
                                                        ? "1 hendelse"
                                                        : `${group.payments.length} hendelser`}
                                                </span>
                                                <PaymentHealthIcon
                                                    group={group}
                                                />
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <ul className="flex flex-col gap-3">
                                            {group.payments.map((payment) => (
                                                <li
                                                    key={payment.id}
                                                    className="flex flex-col gap-2 rounded-lg border p-3"
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            <PaymentStatusBadge
                                                                status={
                                                                    payment.status
                                                                }
                                                            />
                                                            {payment.flag ? (
                                                                <PaymentFlagBadge
                                                                    flag={
                                                                        payment.flag
                                                                    }
                                                                />
                                                            ) : null}
                                                        </div>
                                                        <span className="tabular-nums">
                                                            {formatAmount(
                                                                payment.amountMinor,
                                                            )}
                                                        </span>
                                                    </div>

                                                    <dl className="grid gap-x-6 gap-y-1 text-muted-foreground text-xs sm:grid-cols-2">
                                                        <PaymentDetail
                                                            term="Opprettet"
                                                            value={formatDateTime(
                                                                payment.createdAt,
                                                            )}
                                                        />
                                                        {payment.receivedPaymentAt ? (
                                                            <PaymentDetail
                                                                term="Betalt"
                                                                value={formatDateTime(
                                                                    payment.receivedPaymentAt,
                                                                )}
                                                            />
                                                        ) : null}
                                                        {payment.expiresAt ? (
                                                            <PaymentDetail
                                                                term="Frist"
                                                                value={formatDateTime(
                                                                    payment.expiresAt,
                                                                )}
                                                            />
                                                        ) : null}
                                                        {payment.providerPaymentId ? (
                                                            <PaymentDetail
                                                                term="Referanse"
                                                                value={
                                                                    payment.providerPaymentId
                                                                }
                                                            />
                                                        ) : null}
                                                    </dl>

                                                    {canRefund &&
                                                    payment.status ===
                                                        "paid" ? (
                                                        <div className="flex justify-end">
                                                            <RefundAction
                                                                eventId={
                                                                    eventId
                                                                }
                                                                paymentId={
                                                                    payment.id
                                                                }
                                                                name={
                                                                    group.user
                                                                        .name
                                                                }
                                                                amountMinor={
                                                                    payment.amountMinor
                                                                }
                                                            />
                                                        </div>
                                                    ) : null}
                                                </li>
                                            ))}
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/**
 * Fargen bærer statusen, så raden slipper en pille ved siden av: grønn når
 * pengene er inne, rød når en betaling feilet, oransje når noe er flagget for
 * gjennomgang, gult seddel-med-pil-ned når den er refundert, og nedtonet så
 * lenge det står tomt. Beløpene ligger på hvert forsøk inne i raden.
 */
function PaymentHealthIcon({ group }: { group: PaymentGroup }) {
    const { Icon, className, label } = paymentHealth(group);

    return (
        <span title={label} className="flex">
            <Icon
                aria-label={label}
                className={cn("size-5 shrink-0", className)}
            />
        </span>
    );
}

function paymentHealth(group: PaymentGroup) {
    // Et flagg betyr at en arrangør må se på den, og går foran alt annet –
    // også en betaling som gikk gjennom.
    if (group.flags.length > 0) {
        return {
            Icon: BanknoteIcon,
            className: "text-amber-600 dark:text-amber-500",
            label: "Trenger gjennomgang",
        };
    }

    switch (group.status) {
        case "paid":
            return {
                Icon: BanknoteIcon,
                className: "text-emerald-600 dark:text-emerald-500",
                label: `Betalt – ${formatAmount(group.amountMinor)}`,
            };
        case "failed":
            return {
                Icon: BanknoteIcon,
                className: "text-destructive",
                label: "Betalingen feilet",
            };
        case "refunded":
            return {
                Icon: BanknoteArrowDownIcon,
                className: "text-yellow-600 dark:text-yellow-500",
                label: "Refundert",
            };
        default:
            return {
                Icon: BanknoteIcon,
                className: "text-muted-foreground/40",
                label: "Ikke betalt",
            };
    }
}

function PaymentDetail({ term, value }: { term: string; value: string }) {
    return (
        <div className="flex justify-between gap-2 sm:justify-start">
            <dt>{term}</dt>
            <dd className="text-foreground">{value}</dd>
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

/**
 * Lists here are held in memory in full, so the search filters locally. On an
 * event with hundreds of participants that is the difference between finding
 * one person and scrolling for the name.
 */
function SearchField({
    id,
    value,
    onChange,
    placeholder = "Søk etter navn eller e-post…",
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <Card>
            <CardContent>
                <div className="flex flex-col gap-2">
                    <Label htmlFor={id}>Søk</Label>
                    <Input
                        id={id}
                        type="search"
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Pulls the remaining pages in as soon as one lands. The admin tabs group and
 * search their lists locally, and a filter that only sees page one quietly
 * hides people.
 */
function useLoadAllPages({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
}: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
}) {
    useEffect(() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
}

/** Case-insensitive match across the fields a person is searched by. */
function matchesQuery(fields: (string | null | undefined)[], query: string) {
    if (!query) return true;
    return fields.some((field) => field?.toLowerCase().includes(query));
}

function formatDateTime(iso: string) {
    return formatInOslo(iso, "d. MMM yyyy 'kl.' HH:mm");
}

/** Minor units (øre) -> "1 234 kr" */
/** Beløp i kroner, med norsk tusenskille — `Intl` gir samme utfall uansett hvor koden kjører. */
const NOK_AMOUNT = new Intl.NumberFormat("nb-NO");

function formatAmount(minor: number) {
    return `${NOK_AMOUNT.format(minor / 100)} kr`;
}

/* ------------------------------- Allergier ------------------------------ */

/**
 * Allergiene blant de påmeldte, satt opp for den som skal bestille maten.
 *
 * Summen øverst er det som faktisk sendes videre til kjøkkenet; personlista
 * under er for å slå opp hvem det gjelder. Egen fane framfor en kolonne i
 * Påmeldte, fordi fritekst ikke får plass i en tabellcelle — og fordi
 * helseopplysninger ikke bør stå framme for alle som blar i deltakerlista.
 */
function AllergiesTab({ eventId }: { eventId: string }) {
    const { data } = useSuspenseQuery(getEventAllergiesQuery(eventId));
    const [search, setSearch] = useState("");
    const [hasCopied, setHasCopied] = useState(false);

    const query = search.trim().toLowerCase();
    const visibleParticipants = useMemo(
        () =>
            data.participants.filter((participant) =>
                matchesQuery(
                    [participant.name, ...participant.customAllergies],
                    query,
                ),
            ),
        [data.participants, query],
    );

    async function handleCopy() {
        const lines = [
            ...data.summary.map((entry) => `${entry.label}: ${entry.count}`),
            "",
            ...data.participants.map((participant) => {
                const all = [
                    ...participant.allergies.map((a) => a.label),
                    ...participant.customAllergies,
                ];
                return `${participant.name}: ${all.join(", ")}`;
            }),
        ];

        await navigator.clipboard.writeText(lines.join("\n"));
        setHasCopied(true);
        window.setTimeout(() => setHasCopied(false), 2000);
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
                <AdminStatCard
                    label="Har oppgitt allergier"
                    value={data.withAllergies}
                    icon={UtensilsCrossedIcon}
                />
                <AdminStatCard
                    label="Bekreftet ingen"
                    value={data.confirmedNone}
                    icon={CheckIcon}
                />
                <AdminStatCard
                    label="Har ikke svart"
                    value={data.notAnswered}
                    icon={CircleHelpIcon}
                    hint={
                        data.notAnswered > 0
                            ? "Vi vet ikke om disse har allergier."
                            : undefined
                    }
                />
            </div>

            {data.participants.length > 0 ? (
                <SearchField
                    id="allergies-search"
                    value={search}
                    onChange={setSearch}
                />
            ) : null}

            {data.participants.length === 0 ? (
                <Card>
                    <CardContent>
                        <AdminEmptyState
                            icon={UsersIcon}
                            title="Ingen registrerte allergier"
                            description={
                                data.notAnswered > 0
                                    ? `Ingen av de ${data.totalParticipants} påmeldte har oppgitt allergier, men ${data.notAnswered} har ikke svart på spørsmålet.`
                                    : "Alle påmeldte har bekreftet at de ikke har allergier."
                            }
                        />
                    </CardContent>
                </Card>
            ) : visibleParticipants.length === 0 ? (
                <Card>
                    <CardContent>
                        <AdminEmptyState
                            icon={UsersIcon}
                            title="Ingen treff"
                            description={`Ingen påmeldte matcher «${search.trim()}».`}
                        />
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Deltakere med allergier</CardTitle>
                        <CardAction>
                            {/* Sammendraget per allergi ligger fortsatt i
                                teksten som kopieres — det er det kjøkkenet
                                trenger — men det tar ikke plass på skjermen. */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopy}
                            >
                                <CopyIcon />
                                {hasCopied ? "Kopiert" : "Kopier oversikten"}
                            </Button>
                        </CardAction>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Navn</TableHead>
                                    <TableHead>Allergier</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleParticipants.map((participant) => (
                                    <TableRow key={participant.userId}>
                                        <TableCell>
                                            {participant.name}
                                        </TableCell>
                                        <TableCell>
                                            <ul className="flex flex-wrap gap-1">
                                                {participant.allergies.map(
                                                    (allergy) => (
                                                        <li key={allergy.slug}>
                                                            <Badge variant="secondary">
                                                                {allergy.label}
                                                            </Badge>
                                                        </li>
                                                    ),
                                                )}
                                                {participant.customAllergies.map(
                                                    (entry) => (
                                                        <li key={entry}>
                                                            <Badge variant="outline">
                                                                {entry}
                                                            </Badge>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* «Ikke svart» er ikke det samme som «ingen allergier», og den
                forskjellen må stå tydelig: kjøkkenet skal ikke lese en tom
                rad som en garanti. */}
            <p className="text-sm text-muted-foreground">
                {data.totalParticipants} påmeldte totalt.{" "}
                {data.notAnswered > 0
                    ? `${data.notAnswered} har ikke svart på allergispørsmålet ennå — det er ikke det samme som at de ikke har allergier.`
                    : "Alle har svart på allergispørsmålet."}
            </p>
        </div>
    );
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
