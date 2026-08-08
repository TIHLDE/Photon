import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addHours } from "date-fns";
import { useEffect, useMemo, useState } from "react";

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
import {
    useAnyScopePermission,
    useCanActForGroup,
} from "#/hooks/use-permission";
import { nextWholeHour } from "#/lib/date";
import { useDebounced } from "#/lib/use-debounced";

export const Route = createFileRoute("/admin/arrangementer/ny")({
    component: NewEventPage,
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
    registrationEnd: null,
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
        () => allGroups.filter((group) => canArrangeFor(group.slug)),
        [allGroups, canArrangeFor],
    );
    const { data: institutes } = useSuspenseQuery(getInstitutesQuery());

    const [values, setValues] = useState<EventFormValues>(emptyValues);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const debouncedLocation = useDebounced(values.location, 250);
    const { data: addressSuggestions, isFetching: isSearchingAddress } =
        useQuery(searchAddressQuery(debouncedLocation));

    // Kontaktpersonen velges blant medlemmene i arrangørgruppen, så lista
    // følger gruppevalget over.
    const { data: organizerMembers } = useQuery({
        ...getGroupMembersQuery(values.organizerGroupSlug, 0),
        enabled: Boolean(values.organizerGroupSlug),
    });

    // Sett standardverdier på klienten for å unngå SSR-hydration-mismatch.
    useEffect(() => {
        const defaults = eventDateDefaults();
        setValues((current) => ({
            ...current,
            start: current.start ?? defaults.start,
            end: current.end ?? defaults.end,
            registrationEnd:
                current.registrationEnd ?? defaults.registrationEnd,
        }));
    }, []);

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
        const registrationEndIso = values.requiresSigningUp
            ? toIso(values.registrationEnd)
            : null;
        if (!startIso || !endIso) return;
        if (values.requiresSigningUp && !registrationEndIso) return;

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
                    registrationStart: null,
                    registrationEnd: registrationEndIso,
                    cancellationDeadline: null,
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
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    canCauseStrikes: values.canCauseStrikes,
                    enforcesPreviousStrikes: values.canCauseStrikes,
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
