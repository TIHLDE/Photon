import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addHours } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import z from "zod";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { XCircle } from "lucide-react";

import { Stagger } from "@tihlde/ui/ui/motion";

import { searchAddressQuery } from "#/api/queries/address";
import { useImageUploader } from "#/api/queries/assets";
import { createEventMutation } from "#/api/queries/events";
import { getGroupMembersQuery, getGroupsQuery } from "#/api/queries/groups";
import { getInstitutesQuery } from "#/api/queries/institutes";
import { AdminNoAccess } from "#/components/admin-no-access";
import { AdminPageHeader } from "#/components/admin-page-header";
import type { EventFormValues } from "#/components/event-form";
import { ALL_INSTITUTES, EventForm } from "#/components/event-form";
import { poolsForSubmit } from "#/components/priority-pool-editor";
import { usePriorityUserSearch } from "#/hooks/use-priority-user-search";
import {
    useAnyScopePermission,
    useCanActForGroup,
    useLedGroupSlugs,
} from "#/hooks/use-permission";
import { compareGroupHierarchy, isCohortGroupType } from "#/lib/group";
import { nextWholeHour } from "#/lib/date";
import { useDebounced } from "#/lib/use-debounced";

// `?gruppe=<slug>` lar «Nytt arrangement» på en gruppeside sende deg hit med
// gruppa allerede valgt som arrangør, i stedet for å be deg velge den om
// igjen. Slug-er vi ikke får arrangere for hoppes stille over — se under.
const searchSchema = z.object({
    gruppe: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/admin/arrangementer/ny")({
    component: NewEventPage,
    validateSearch: searchSchema,
    loader: async ({ context }) => {
        await Promise.all([
            context.queryClient.ensureQueryData(getGroupsQuery(0)),
            context.queryClient.ensureQueryData(getInstitutesQuery()),
        ]);
        return { breadcrumbs: "Nytt arrangement" };
    },
});

/** Module-level so the permission predicate keeps a stable identity. */
const EVENT_CREATE_PERMISSIONS = ["events:create", "events:manage"] as const;

/** Date -> ISO string, or null when unset */
function toIso(value: Date | null): string | null {
    if (!value) return null;
    return value.toISOString();
}

/**
 * Fornuftige standardverdier for et nytt arrangement: start på neste hele
 * time, slutt to timer senere, og påmelding som lukkes når arrangementet
 * starter.
 */
function eventDateDefaults() {
    const start = nextWholeHour();
    return { start, end: addHours(start, 2), registrationEnd: start };
}

const emptyValues: EventFormValues = {
    priorityPools: [],
    priorityUsers: [],
    onlyAllowPrioritized: false,
    title: "",
    description: "",
    categorySlug: "",
    organizerGroupSlug: "",
    contactPersonUserId: "",
    location: "",
    locationCoords: null,
    start: null,
    end: null,
    requiresSigningUp: true,
    registrationStart: null,
    registrationEnd: null,
    cancellationDeadline: null,
    capacity: "",
    visibility: "public",
    instituteSlug: ALL_INSTITUTES,
    isPaidEvent: false,
    canCauseStrikes: false,
    price: "",
    image: null,
    imageAlt: "",
};

function NewEventPage() {
    const navigate = useNavigate();
    const canCreate = useAnyScopePermission(["events:create", "events:manage"]);
    const canArrangeFor = useCanActForGroup(EVENT_CREATE_PERMISSIONS);
    const { data: allGroups } = useSuspenseQuery(getGroupsQuery(0));
    // Only offer groups the caller may actually arrange for: a group-scoped
    // grant covers one group, and the API rejects the rest anyway.
    const groups = useMemo(
        () =>
            allGroups.filter(
                (group) =>
                    canArrangeFor(group.slug) && !isCohortGroupType(group.type),
            ),
        [allGroups, canArrangeFor],
    );
    const { data: institutes } = useSuspenseQuery(getInstitutesQuery());

    // Forhåndsvalget fra `?gruppe` godtas bare hvis gruppa faktisk står i
    // lista over. En gammel bokmerket lenke, eller en rettighet som er
    // trukket tilbake, gir ellers et arrangørfelt med en verdi som ikke
    // finnes blant valgene. Da starter vi heller tomt, som vanlig.
    const { gruppe } = Route.useSearch();
    const [values, setValues] = useState<EventFormValues>(() => ({
        ...emptyValues,
        organizerGroupSlug: groups.some((group) => group.slug === gruppe)
            ? (gruppe ?? "")
            : "",
    }));
    const [uploadError, setUploadError] = useState<string | null>(null);
    const priorityUserSearch = usePriorityUserSearch();

    const debouncedLocation = useDebounced(values.location, 250);
    const { data: addressSuggestions, isFetching: isSearchingAddress } =
        useQuery(searchAddressQuery(debouncedLocation));

    // Kontaktpersonen velges blant medlemmene i arrangørgruppen, så lista
    // følger gruppevalget over.
    const { data: organizerMembers } = useQuery({
        ...getGroupMembersQuery(values.organizerGroupSlug, 0),
        enabled: Boolean(values.organizerGroupSlug),
    });

    // Leder man en gruppe, er det nesten alltid den man arrangerer for. Leder
    // man flere, vinner den som sitter høyest i TIHLDE — Hovedstyret før
    // undergruppe før komité.
    const ledGroupSlugs = useLedGroupSlugs();
    const defaultOrganizerSlug = useMemo(() => {
        const led = groups.filter((group) => ledGroupSlugs.has(group.slug));
        if (led.length === 0) return "";
        return [...led].sort(compareGroupHierarchy)[0]?.slug ?? "";
    }, [groups, ledGroupSlugs]);

    // Sett standardverdier på klienten for å unngå SSR-hydration-mismatch.
    // Arrangørgruppa settes her av samme grunn, og bare når feltet står tomt —
    // et eksplisitt `?gruppe=` eller et valg brukeren har rukket å gjøre selv
    // skal ikke overskrives.
    useEffect(() => {
        const defaults = eventDateDefaults();
        setValues((current) => ({
            ...current,
            start: current.start ?? defaults.start,
            end: current.end ?? defaults.end,
            registrationEnd:
                current.registrationEnd ?? defaults.registrationEnd,
            organizerGroupSlug:
                current.organizerGroupSlug || defaultOrganizerSlug,
        }));
    }, [defaultOrganizerSlug]);

    const contactPersonCandidates = (organizerMembers ?? []).map((member) => ({
        id: member.user.id,
        name: member.user.name,
    }));

    const createEvent = useMutation(createEventMutation);
    const { uploadImage, isUploading } = useImageUploader();

    function handleChange(patch: Partial<EventFormValues>) {
        setValues((current) => ({ ...current, ...patch }));
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setUploadError(null);

        const startIso = toIso(values.start);
        const endIso = toIso(values.end);
        // Uten påmelding avviser API-et både frist og kapasitet, så de utelates.
        const registrationStartIso = values.requiresSigningUp
            ? toIso(values.registrationStart)
            : null;
        const registrationEndIso = values.requiresSigningUp
            ? toIso(values.registrationEnd)
            : null;
        if (!startIso || !endIso) return;
        if (!values.categorySlug) return;
        if (
            values.requiresSigningUp &&
            (!registrationStartIso || !registrationEndIso)
        ) {
            return;
        }
        // Datovelgerne begrenser ikke lenger hverandre, så rekkefølgen stoppes
        // her. Skjemaet viser den samme feilen ved feltet.
        if (
            values.registrationStart &&
            values.registrationEnd &&
            values.registrationStart >= values.registrationEnd
        ) {
            return;
        }

        // Uploaded first: a failed upload must not leave an event behind that
        // silently lost its cover.
        let imageUrl: string | null = null;
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

        createEvent.mutate(
            {
                data: {
                    title: values.title,
                    description: values.description,
                    categorySlug: values.categorySlug,
                    organizerGroupSlug: values.organizerGroupSlug,
                    location: values.location,
                    locationLat: values.locationCoords?.lat ?? null,
                    locationLng: values.locationCoords?.lng ?? null,
                    imageUrl,
                    imageAlt: imageUrl ? values.imageAlt || null : null,
                    start: startIso,
                    end: endIso,
                    registrationStart: registrationStartIso,
                    registrationEnd: registrationEndIso,
                    // Avmeldingsfristen gjelder bare arrangementer med
                    // påmelding som ikke er betalte — API-et avviser resten.
                    cancellationDeadline:
                        values.requiresSigningUp && !values.isPaidEvent
                            ? toIso(values.cancellationDeadline)
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
                    isRegistrationClosed: false,
                    requiresSigningUp: values.requiresSigningUp,
                    allowWaitlist: values.requiresSigningUp,
                    priorityPools: poolsForSubmit(values.priorityPools),
                    priorityUserIds: values.priorityUsers.map(
                        (user) => user.id,
                    ),
                    onlyAllowPrioritized: values.onlyAllowPrioritized,
                    // Betalte arrangementer gir aldri prikker.
                    canCauseStrikes: canCauseStrikes,
                    enforcesPreviousStrikes: canCauseStrikes,
                    isPaidEvent: values.isPaidEvent,
                    price:
                        values.isPaidEvent && values.price
                            ? Number(values.price)
                            : null,
                    paymentGracePeriodMinutes: null,
                    contactPersonUserId: values.contactPersonUserId || null,
                    reactionsAllowed: false,
                },
            },
            {
                // Rett til administrasjonssiden for det nye arrangementet, så
                // påmeldte, oppmøte og betalinger er ett klikk unna.
                onSuccess(created) {
                    navigate({
                        to: "/admin/arrangementer/$eventId",
                        params: { eventId: created.eventId },
                    });
                },
            },
        );
    }

    if (!canCreate) {
        return (
            <Stagger
                render={
                    <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" />
                }
            >
                <AdminPageHeader title="Nytt arrangement" />
                <AdminNoAccess action="opprette arrangementer" />
            </Stagger>
        );
    }

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title="Nytt arrangement"
                description="Beskrivelsen lagres som markdown og formateringen vises direkte mens du skriver."
            />

            <EventForm
                values={values}
                onChange={handleChange}
                groups={groups}
                poolGroups={allGroups}
                priorityUserSearch={priorityUserSearch}
                institutes={institutes}
                contactPersonCandidates={contactPersonCandidates}
                addressSuggestions={addressSuggestions ?? []}
                isSearchingAddress={isSearchingAddress}
                onSubmit={handleSubmit}
                submitLabel={isUploading ? "Laster opp bilde …" : "Publiser"}
                isSubmitting={createEvent.isPending || isUploading}
            >
                {uploadError && (
                    <Alert variant="destructive">
                        <XCircle className="size-4" />
                        <AlertTitle>Kunne ikke laste opp bildet</AlertTitle>
                        <AlertDescription>{uploadError}</AlertDescription>
                    </Alert>
                )}
                {createEvent.isError && (
                    <Alert variant="destructive">
                        <XCircle className="size-4" />
                        <AlertTitle>Kunne ikke publisere</AlertTitle>
                        <AlertDescription>
                            {createEvent.error.message}
                        </AlertDescription>
                    </Alert>
                )}
            </EventForm>
        </Stagger>
    );
}
