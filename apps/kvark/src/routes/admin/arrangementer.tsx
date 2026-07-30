import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { addHours } from "date-fns";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { CheckCircle2, XCircle } from "lucide-react";

import { searchAddressQuery } from "#/api/queries/address";
import { useImageUploader } from "#/api/queries/assets";
import { createEventMutation } from "#/api/queries/events";
import { getGroupsQuery } from "#/api/queries/groups";
import { getInstitutesQuery } from "#/api/queries/institutes";
import { AdminNoAccess } from "#/components/admin-no-access";
import type { EventFormValues } from "#/components/event-form";
import { ALL_INSTITUTES, EventForm } from "#/components/event-form";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { nextWholeHour } from "#/lib/date";
import { useDebounced } from "#/lib/use-debounced";

export const Route = createFileRoute("/admin/arrangementer")({
    component: EventAdminPage,
    loader: ({ context }) =>
        Promise.all([
            context.queryClient.ensureQueryData(getGroupsQuery(0)),
            context.queryClient.ensureQueryData(getInstitutesQuery()),
        ]),
});

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
    location: "",
    locationCoords: null,
    start: null,
    end: null,
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

function EventAdminPage() {
    const canCreate = useAnyScopePermission(["events:create", "events:manage"]);
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));
    const { data: institutes } = useSuspenseQuery(getInstitutesQuery());

    const [values, setValues] = useState<EventFormValues>(emptyValues);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const debouncedLocation = useDebounced(values.location, 250);
    const { data: addressSuggestions, isFetching: isSearchingAddress } =
        useQuery(searchAddressQuery(debouncedLocation));

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
        const registrationEndIso = toIso(values.registrationEnd);
        if (!startIso || !endIso || !registrationEndIso) return;

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
                    capacity: values.capacity ? Number(values.capacity) : null,
                    visibility: values.visibility,
                    restrictedToInstituteSlug:
                        values.instituteSlug === ALL_INSTITUTES
                            ? null
                            : values.instituteSlug,
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
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
                    contactPersonUserId: null,
                    reactionsAllowed: false,
                },
            },
            {
                onSuccess() {
                    const defaults = eventDateDefaults();
                    setValues({ ...emptyValues, ...defaults });
                },
            },
        );
    }

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Nytt arrangement</h1>
                <p className="text-muted-foreground">
                    Beskrivelsen lagres som markdown og formateringen vises
                    direkte mens du skriver.
                </p>
            </div>

            {!canCreate ? (
                <AdminNoAccess action="opprette arrangementer" />
            ) : null}

            {canCreate ? (
                <EventForm
                    values={values}
                    onChange={handleChange}
                    groups={groups}
                    institutes={institutes}
                    addressSuggestions={addressSuggestions ?? []}
                    isSearchingAddress={isSearchingAddress}
                    onSubmit={handleSubmit}
                    submitLabel={
                        isUploading ? "Laster opp bilde …" : "Publiser"
                    }
                    isSubmitting={createEvent.isPending || isUploading}
                >
                    {uploadError && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke laste opp bildet</AlertTitle>
                            <AlertDescription>{uploadError}</AlertDescription>
                        </Alert>
                    )}
                    {createEvent.isSuccess && (
                        <Alert>
                            <CheckCircle2 className="size-4" />
                            <AlertTitle>Publisert</AlertTitle>
                            <AlertDescription>
                                Arrangementet ble opprettet.
                            </AlertDescription>
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
            ) : null}
        </div>
    );
}
