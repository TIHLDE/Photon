import { Suspense, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import { convertHeicToJpeg, isHeicFile } from "@tihlde/ui/lib/heic";
import { compressImageFile } from "@tihlde/ui/lib/image-compression";
import { ArrowLeft } from "lucide-react";

import { authClientWithRedirect } from "#/api/auth";
import { getEventByIdQuery } from "#/api/queries/events";
import {
    getWrappedCameraQuery,
    uploadWrappedPhotoMutation,
} from "#/api/queries/wrapped";
import {
    WrappedCamera,
    type WrappedUploadState,
} from "#/components/wrapped-camera";
import { WrappedCameraSkeleton } from "#/components/wrapped-camera-skeleton";
import { WrappedCameraUnavailable } from "#/components/wrapped-camera-unavailable";
import { errorStatus } from "#/lib/utils";

/**
 * Engangskameraet for et arrangement: /arrangementer/<slug>/kamera.
 *
 * `$slug_` og ikke `$slug`: detaljsida har ingen `<Outlet />`, så en nøstet
 * rute ville aldri blitt vist.
 */
export const Route = createFileRoute("/_app/arrangementer/$slug_/kamera")({
    component: WrappedCameraPage,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
    loader: async ({ context, params }) => {
        const event = await context.queryClient.ensureQueryData(
            getEventByIdQuery(params.slug),
        );
        await context.queryClient.ensureQueryData(
            getWrappedCameraQuery(event.id),
        );
    },
});

function WrappedCameraPage() {
    const { slug } = Route.useParams();

    return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    render={
                        <Link to="/arrangementer/$slug" params={{ slug }} />
                    }
                >
                    <ArrowLeft />
                    Til arrangementet
                </Button>
            </div>
            <Suspense fallback={<WrappedCameraSkeleton />}>
                <WrappedCameraContainer slug={slug} />
            </Suspense>
        </div>
    );
}

function WrappedCameraContainer({ slug }: { slug: string }) {
    const queryClient = useQueryClient();
    const { data: event } = useSuspenseQuery(getEventByIdQuery(slug));
    const cameraQuery = getWrappedCameraQuery(event.id);
    const { data: camera, refetch } = useSuspenseQuery(cameraQuery);
    const uploadPhoto = useMutation(uploadWrappedPhotoMutation);

    const [uploadState, setUploadState] = useState<WrappedUploadState>({
        status: "idle",
    });
    // Det ferdig konverterte bildet holdes i minnet til det er lastet opp, så
    // et dårlig nett ikke koster bildet.
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    async function upload(file: File) {
        setUploadState({ status: "uploading" });
        try {
            const result = await uploadPhoto.mutateAsync({
                eventId: event.id,
                file,
            });
            if (import.meta.env.DEV) {
                console.info("[wrapped] lastet opp", result.id);
            }
            setPendingFile(null);
            setUploadState({ status: "done" });
            // Svaret har tellerne, så de vises med en gang; statusen hentes
            // likevel på nytt for resten av feltene.
            queryClient.setQueryData(cameraQuery.queryKey, (previous) =>
                previous
                    ? {
                          ...previous,
                          shotsUsed: result.shotsUsed,
                          shotsLeft: result.shotsLeft,
                      }
                    : previous,
            );
            await queryClient.invalidateQueries({
                queryKey: cameraQuery.queryKey,
            });
        } catch (error) {
            console.error("Opplasting av kamerabilde feilet", error);
            const status =
                error instanceof Error ? errorStatus(error.cause) : undefined;
            // 403/409: statusen vi viste var utdatert. Grunnen hentes fra
            // serveren og vises i stedet for en egen feilmelding.
            if (status === 403 || status === 409) {
                setPendingFile(null);
                setUploadState({ status: "idle" });
                await refetch();
                return;
            }
            setPendingFile(file);
            setUploadState({
                status: "failed",
                message:
                    error instanceof Error
                        ? error.message
                        : "Noe gikk galt under opplastingen.",
            });
        }
    }

    async function handlePhoto(file: File) {
        setPendingFile(null);
        // HEIC-filer har ofte tom `type`, så de slippes gjennom på filnavnet.
        if (!file.type.startsWith("image/") && !isHeicFile(file)) {
            setUploadState({
                status: "failed",
                message: "Filen må være et bilde.",
            });
            return;
        }

        setUploadState({ status: "converting" });
        let prepared: File;
        try {
            const jpeg = isHeicFile(file)
                ? await convertHeicToJpeg(file)
                : file;
            prepared = await compressImageFile(jpeg);
        } catch (error) {
            console.error("Klargjøring av kamerabilde feilet", error);
            setUploadState({
                status: "failed",
                message: "Fikk ikke lest bildet. Prøv å ta det på nytt.",
            });
            return;
        }
        await upload(prepared);
    }

    if (!camera.canShoot && camera.reason) {
        return (
            <WrappedCameraUnavailable
                reason={camera.reason}
                opensAt={camera.opensAt}
            />
        );
    }

    return (
        <WrappedCamera
            eventTitle={event.title}
            shotsLeft={camera.shotsLeft}
            shotsPerPerson={camera.shotsPerPerson}
            uploadState={uploadState}
            onPhoto={(file) => void handlePhoto(file)}
            onRetry={
                pendingFile && uploadState.status === "failed"
                    ? () => void upload(pendingFile)
                    : undefined
            }
        />
    );
}
