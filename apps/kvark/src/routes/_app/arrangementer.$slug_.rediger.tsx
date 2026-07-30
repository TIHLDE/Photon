import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { ArrowLeft, XCircle } from "lucide-react";
import type { Event, UpdateEventSchema } from "@tihlde/sdk";

import { searchAddressQuery } from "#/api/queries/address";
import { useImageUploader } from "#/api/queries/assets";
import { getEventByIdQuery, updateEventMutation } from "#/api/queries/events";
import { getGroupsQuery } from "#/api/queries/groups";
import { getInstitutesQuery } from "#/api/queries/institutes";
import { AdminNoAccess } from "#/components/admin-no-access";
import type { EventFormValues } from "#/components/event-form";
import { ALL_INSTITUTES, EventForm } from "#/components/event-form";
import { useCanActOnResource } from "#/hooks/use-permission";
import { useDebounced } from "#/lib/use-debounced";

export const Route = createFileRoute("/_app/arrangementer/$slug_/rediger")({
    component: EditEventPage,
    loader: ({ context, params }) =>
        Promise.all([
            context.queryClient.ensureQueryData(getEventByIdQuery(params.slug)),
            context.queryClient.ensureQueryData(getGroupsQuery(0)),
            context.queryClient.ensureQueryData(getInstitutesQuery()),
        ]),
});

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
        title: event.title,
        description: event.description,
        categorySlug: event.category.slug,
        organizerGroupSlug: event.organizer?.slug ?? "",
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
        registrationEnd: toDate(event.registrationEnd),
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

function EditEventPage() {
    const { slug } = Route.useParams();
    const navigate = useNavigate();

    const { data: event } = useSuspenseQuery(getEventByIdQuery(slug));
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));
    const { data: institutes } = useSuspenseQuery(getInstitutesQuery());

    // Samme regel som API-et: rettigheten (også gruppescopet), eller å ha
    // opprettet arrangementet selv.
    const canEdit = useCanActOnResource(["events:update", "events:manage"])(
        event.createdById,
    );

    const [values, setValues] = useState<EventFormValues>(() =>
        valuesFromEvent(event),
    );
    const [uploadError, setUploadError] = useState<string | null>(null);

    const debouncedLocation = useDebounced(values.location, 250);
    const { data: addressSuggestions, isFetching: isSearchingAddress } =
        useQuery(searchAddressQuery(debouncedLocation));

    const updateEvent = useMutation(updateEventMutation);
    const { uploadImage, isUploading } = useImageUploader();

    function handleChange(patch: Partial<EventFormValues>) {
        setValues((current) => ({ ...current, ...patch }));
    }

    async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
        formEvent.preventDefault();
        setUploadError(null);

        if (!values.start || !values.end || !values.registrationEnd) return;

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
            registrationEnd: values.registrationEnd.toISOString(),
            capacity: values.capacity ? Number(values.capacity) : null,
            visibility: values.visibility,
            restrictedToInstituteSlug:
                values.instituteSlug === ALL_INSTITUTES
                    ? null
                    : values.instituteSlug,
            canCauseStrikes: values.canCauseStrikes,
            enforcesPreviousStrikes: values.canCauseStrikes,
            isPaidEvent: values.isPaidEvent,
            price:
                values.isPaidEvent && values.price
                    ? Number(values.price)
                    : null,
            // Beholdes som den er — API-et krever at feltet er med når
            // arrangementet er betalt.
            paymentGracePeriodMinutes:
                event.payInfo?.paymentGracePeriodMinutes || null,
        };

        updateEvent.mutate(
            { eventId: event.id, data },
            {
                onSuccess(result) {
                    // Tittelendring gir ny slug, så vi navigerer til den
                    // API-et faktisk lagret.
                    navigate({
                        to: "/arrangementer/$slug",
                        params: { slug: result.slug },
                    });
                },
            },
        );
    }

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={
                        <Link
                            to="/arrangementer/$slug"
                            params={{ slug: event.slug }}
                        />
                    }
                >
                    <ArrowLeft />
                    Tilbake til arrangementet
                </Button>
            </div>

            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Rediger arrangement</h1>
                <p className="text-muted-foreground">
                    Endringene vises på arrangementssiden så snart du lagrer.
                </p>
            </div>

            {!canEdit ? (
                <AdminNoAccess action="redigere dette arrangementet" />
            ) : (
                <EventForm
                    values={values}
                    onChange={handleChange}
                    groups={groups}
                    institutes={institutes}
                    addressSuggestions={addressSuggestions ?? []}
                    isSearchingAddress={isSearchingAddress}
                    existingImageUrl={event.image}
                    onSubmit={handleSubmit}
                    submitLabel={
                        isUploading ? "Laster opp bilde …" : "Lagre endringer"
                    }
                    isSubmitting={updateEvent.isPending || isUploading}
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
            )}
        </div>
    );
}
