import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import { isHeicFile } from "@tihlde/ui/lib/heic";
import { compressImageFile } from "@tihlde/ui/lib/image-compression";
import { ArrowLeft, Images } from "lucide-react";

import { authClientWithRedirect } from "#/api/auth";
import { getEventByIdQuery } from "#/api/queries/events";
import {
    fetchMyWrappedPhotoThumb,
    getMyWrappedPhotosQuery,
    getWrappedCameraQuery,
    invalidateMine,
    myWrappedPhotoImagePath,
    uploadWrappedPhotoMutation,
} from "#/api/queries/wrapped";
import {
    WrappedCamera,
    WrappedPhotoSaved,
    type WrappedUploadState,
} from "#/components/wrapped-camera";
import { WrappedCameraSkeleton } from "#/components/wrapped-camera-skeleton";
import { WrappedCameraUnavailable } from "#/components/wrapped-camera-unavailable";
import { WrappedMyPhotosStrip } from "#/components/wrapped-my-photos-strip";
import { useNow } from "#/hooks/use-now";
import { useObjectUrls } from "#/hooks/use-object-urls";
import { formatInOslo } from "#/lib/date";
import { errorStatus } from "#/lib/utils";
import { isDraftWarning } from "#/lib/wrapped";

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
        await Promise.all([
            context.queryClient.ensureQueryData(
                getWrappedCameraQuery(event.id),
            ),
            context.queryClient.ensureQueryData(
                getMyWrappedPhotosQuery(event.id),
            ),
        ]);
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

/** Det API-et tar imot. Alt annet avvises der, så det stoppes her. */
const UPLOADABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Et bilde som er gjort klart, med nøkkelen som følger det i hvert forsøk. */
type PendingPhoto = { file: File; idempotencyKey: string };

/** `setTimeout` regner i 32 bit, og ingen venter et døgn på samme side. */
const MAX_WAIT_MS = 24 * 60 * 60 * 1000;

function WrappedCameraContainer({ slug }: { slug: string }) {
    const queryClient = useQueryClient();
    const { data: event } = useSuspenseQuery(getEventByIdQuery(slug));
    const cameraQuery = getWrappedCameraQuery(event.id);
    const { data: camera, refetch } = useSuspenseQuery(cameraQuery);
    const { data: myPhotos } = useSuspenseQuery(
        getMyWrappedPhotosQuery(event.id),
    );
    const uploadPhoto = useMutation(uploadWrappedPhotoMutation);

    // De to nyeste bildene, nyeste først, som miniatyrer i snarveien.
    const newestPaths = useMemo(
        () =>
            myPhotos
                .slice(-2)
                .reverse()
                .map((photo) => myWrappedPhotoImagePath(event.id, photo.id)),
        [myPhotos, event.id],
    );
    const thumbnails = useObjectUrls(newestPaths, fetchMyWrappedPhotoThumb);
    // Klokka tikker fram til kameraet stenger, så varselet om usendte bilder
    // både dukker opp og forsvinner uten at sida lastes på nytt.
    const now = useNow(camera.closesAt);

    const [uploadState, setUploadState] = useState<WrappedUploadState>({
        status: "idle",
    });
    // Det ferdig konverterte bildet holdes i minnet til det er lastet opp, så
    // et dårlig nett ikke koster bildet.
    const [pending, setPending] = useState<PendingPhoto | null>(null);

    // Ingen skal måtte laste sida på nytt når kameraet åpner eller stenger:
    // statusen hentes igjen i det tidspunktet passerer. Når det stenger,
    // forsvinner også utkastene, så Mine bilder hentes på nytt samtidig.
    const waitingUntil =
        camera.reason === "not_open_yet"
            ? camera.opensAt
            : camera.isOpen
              ? camera.closesAt
              : null;
    useEffect(() => {
        if (!waitingUntil) return;
        const delay = new Date(waitingUntil).getTime() - Date.now() + 1000;
        if (delay > MAX_WAIT_MS) return;
        const timer = setTimeout(
            () => void invalidateMine(queryClient, event.id),
            Math.max(delay, 0),
        );
        return () => clearTimeout(timer);
    }, [waitingUntil, queryClient, event.id]);

    async function upload(photo: PendingPhoto) {
        setUploadState({ status: "uploading" });
        try {
            const result = await uploadPhoto.mutateAsync({
                eventId: event.id,
                ...photo,
            });
            if (import.meta.env.DEV) {
                console.info("[wrapped] lastet opp", result.id);
            }
            setPending(null);
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
                setPending(null);
                setUploadState({ status: "idle" });
                await refetch();
                return;
            }
            // Uten statuskode kom vi aldri fram, og 5xx er serverens feil:
            // da kan samme bilde sendes på nytt, og nøkkelen sørger for at
            // det ikke koster et ekstra om det første forsøket likevel kom
            // fram. Alt annet har serveren avvist, og et nytt forsøk med det
            // samme bildet får samme svar.
            const retryable = status === undefined || status >= 500;
            setPending(retryable ? photo : null);
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
        setPending(null);
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
            // Konverterer også HEIC til JPEG før den komprimerer.
            prepared = await compressImageFile(file);
        } catch (error) {
            console.error("Klargjøring av kamerabilde feilet", error);
            setUploadState({
                status: "failed",
                message:
                    error instanceof Error
                        ? error.message
                        : "Fikk ikke lest bildet. Prøv å ta det på nytt.",
            });
            return;
        }

        if (!UPLOADABLE_TYPES.includes(prepared.type)) {
            console.warn("Kamerabilde i et format API-et ikke tar", {
                type: prepared.type,
            });
            setUploadState({
                status: "failed",
                message:
                    "Kameraet tar bare vanlige bilder. Ta et nytt bilde med kameraet på telefonen.",
            });
            return;
        }

        await upload({ file: prepared, idempotencyKey: crypto.randomUUID() });
    }

    // Den som arrangerer kan følge med på bildene mens de kommer inn. De
    // ligger i arrangementsadminen, og dette er veien dit fra telefonen.
    const organizerLink = camera.canManage ? (
        <Button
            variant="outline"
            render={
                <Link
                    to="/admin/arrangementer/$eventId"
                    params={{ eventId: event.id }}
                    search={{ fane: "kamera" }}
                />
            }
        >
            <Images />
            Se bildene som er tatt
        </Button>
    ) : null;

    // Også når kameraet ikke kan brukes: den som har brukt opp bildene sine,
    // må fortsatt kunne sende dem inn.
    const myPhotosStrip =
        myPhotos.length > 0 ? (
            <WrappedMyPhotosStrip
                link={
                    <Link
                        to="/arrangementer/$slug/kamera/mine"
                        params={{ slug }}
                    />
                }
                thumbnails={newestPaths.flatMap(
                    (path) => thumbnails.get(path) ?? [],
                )}
                draftCount={camera.draftCount}
                warningUntil={
                    isDraftWarning(camera.closesAt, camera.draftCount, now)
                        ? formatInOslo(camera.closesAt, "HH:mm")
                        : undefined
                }
            />
        ) : null;

    if (!camera.canShoot && camera.reason) {
        return (
            <>
                {uploadState.status === "done" ? <WrappedPhotoSaved /> : null}
                <WrappedCameraUnavailable
                    reason={camera.reason}
                    opensAt={camera.opensAt}
                />
                {myPhotosStrip}
                {organizerLink}
            </>
        );
    }

    return (
        <>
            <WrappedCamera
                eventTitle={event.title}
                shotsLeft={camera.shotsLeft}
                shotsPerPerson={camera.shotsPerPerson}
                uploadState={uploadState}
                onPhoto={(file) => void handlePhoto(file)}
                onRetry={
                    pending && uploadState.status === "failed"
                        ? () => void upload(pending)
                        : undefined
                }
            />
            {myPhotosStrip}
            {organizerLink}
        </>
    );
}
