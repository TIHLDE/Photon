import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";

import { searchAddressQuery } from "#/api/queries/address";
import { useImageUploader } from "#/api/queries/assets";
import { createEventMutation } from "#/api/queries/events";
import { getGroupsQuery } from "#/api/queries/groups";
import { getInstitutesQuery } from "#/api/queries/institutes";
import { AdminNoAccess } from "#/components/admin-no-access";
import { AdminPageHeader } from "#/components/admin-page-header";
import type { EventFormValues } from "#/components/event-form";
import { EventForm } from "#/components/event-form";
import { useAnyScopePermission } from "#/hooks/use-permission";
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

function NewEventPage() {
    const navigate = useNavigate();
    const canCreate = useAnyScopePermission(["events:create", "events:manage"]);
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));
    const { data: institutes } = useSuspenseQuery(getInstitutesQuery());

    const [addressQuery, setAddressQuery] = useState("");
    const debouncedAddress = useDebounced(addressQuery, 250);
    const { data: addressSuggestions, isFetching: isSearchingAddress } =
        useQuery(searchAddressQuery(debouncedAddress));

    const createEvent = useMutation(createEventMutation);
    const { uploadImage, isUploading } = useImageUploader();
    const [uploadError, setUploadError] = useState<string | null>(null);

    async function handleSubmit(values: EventFormValues, image: File | null) {
        setUploadError(null);

        // Uploaded first: a failed upload must not leave an event behind that
        // silently lost its cover.
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

        createEvent.mutate(
            {
                data: {
                    ...values,
                    imageUrl,
                    imageAlt: imageUrl ? values.imageAlt : null,
                    registrationStart: null,
                    cancellationDeadline: null,
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    enforcesPreviousStrikes: values.canCauseStrikes,
                    paymentGracePeriodMinutes: null,
                    contactPersonUserId: null,
                    reactionsAllowed: false,
                },
            },
            {
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
            <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
                <AdminPageHeader title="Nytt arrangement" />
                <AdminNoAccess action="opprette arrangementer" />
            </div>
        );
    }

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Nytt arrangement"
                description="Beskrivelsen lagres som markdown og formateringen vises direkte mens du skriver."
            />

            <EventForm
                groups={groups}
                institutes={institutes}
                submitLabel="Publiser"
                submitDisabledLabel="Laster opp bilde …"
                isSubmitting={createEvent.isPending || isUploading}
                addressSuggestions={addressSuggestions ?? []}
                isSearchingAddress={isSearchingAddress}
                onAddressQueryChange={setAddressQuery}
                onSubmit={handleSubmit}
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
        </div>
    );
}
