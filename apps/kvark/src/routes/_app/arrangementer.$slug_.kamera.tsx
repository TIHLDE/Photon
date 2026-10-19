import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import {
    type CameraFacingMode,
    type CameraViewfinderHandle,
    type CameraViewfinderState,
    CameraControlButton,
} from "@tihlde/ui/ui/camera-viewfinder";
import { convertHeicToJpeg, isHeicFile } from "@tihlde/ui/lib/heic";
import { compressImageFile } from "@tihlde/ui/lib/image-compression";
import { Flashlight, FlashlightOff, Images } from "lucide-react";

import { authClientWithRedirect } from "#/api/auth";
import { getEventByIdQuery } from "#/api/queries/events";
import {
    fetchMyWrappedPhotoThumb,
    getMyWrappedPhotosQuery,
    getWrappedCameraQuery,
    invalidateMine,
    myWrappedPhotoImagePath,
    uploadWrappedPhotoMutation,
    type WrappedPhotoSource,
} from "#/api/queries/wrapped";
import {
    WrappedCamera,
    WrappedPhotoSaved,
    type WrappedUploadState,
} from "#/components/wrapped-camera";
import {
    WrappedCameraRollConfirm,
    WrappedCameraRollInput,
} from "#/components/wrapped-camera-roll";
import { WrappedCameraFallback } from "#/components/wrapped-camera-fallback";
import { WrappedCameraScreen } from "#/components/wrapped-camera-screen";
import { WrappedCameraSkeleton } from "#/components/wrapped-camera-skeleton";
import { WrappedCameraUnavailable } from "#/components/wrapped-camera-unavailable";
import { WrappedMyPhotosStrip } from "#/components/wrapped-my-photos-strip";
import { WrappedViewfinder } from "#/components/wrapped-viewfinder";
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
 *
 * Sida eier hele skjermen (`immersive`): uten topplinje, bunnlinje og footer,
 * med en egen X tilbake til arrangementet.
 */
export const Route = createFileRoute("/_app/arrangementer/$slug_/kamera")({
    component: WrappedCameraPage,
    staticData: { immersive: true },
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
        <Suspense
            fallback={
                <WrappedCameraScreen slug={slug} title="">
                    <WrappedCameraSkeleton />
                </WrappedCameraScreen>
            }
        >
            <WrappedCameraContainer slug={slug} />
        </Suspense>
    );
}

/**
 * Hvor lenge et nytt trykk på utløseren ignoreres. Et dobbelttrykk — gjerne
 * sent på kvelden — skal ikke koste to bilder.
 */
const SHUTTER_COOLDOWN_MS = 600;

/** Det API-et tar imot. Alt annet avvises der, så det stoppes her. */
const UPLOADABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Et bilde som er gjort klart, med nøkkelen som følger det i hvert forsøk. */
type PendingPhoto = {
    file: File;
    idempotencyKey: string;
    source: WrappedPhotoSource;
};

/**
 * Bildet fra kamerarullen som venter på «Legg til». `src` er null mens et
 * HEIC-bilde gjøres om til JPEG — Chrome kan ikke vise HEIC.
 */
type PickedPhoto = { file: File; src: string } | { file: null; src: null };

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

    const viewfinderRef = useRef<CameraViewfinderHandle>(null);
    const [viewfinderState, setViewfinderState] =
        useState<CameraViewfinderState>("requesting");
    const [facingMode, setFacingMode] =
        useState<CameraFacingMode>("environment");
    const [torchSupported, setTorchSupported] = useState(false);
    const [torch, setTorch] = useState(false);
    const [useSystemCamera, setUseSystemCamera] = useState(false);
    const lastShutterAt = useRef(0);

    const cameraRollRef = useRef<HTMLInputElement>(null);
    const [picked, setPicked] = useState<PickedPhoto | null>(null);
    // Hvert valg får et nummer, så et HEIC-bilde som blir ferdig konvertert
    // etter at noen trykket avbryt eller valgte et annet, ikke dukker opp.
    const pickId = useRef(0);
    // Forhåndsvisningen er en lokal URL som holder bildet i minnet til den
    // slippes.
    const pickedSrc = picked?.src;
    useEffect(() => {
        if (!pickedSrc) return;
        return () => URL.revokeObjectURL(pickedSrc);
    }, [pickedSrc]);

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
            setUploadState({
                status: "done",
                fromCameraRoll: photo.source === "camera_roll",
            });
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

    async function handlePhoto(
        file: File,
        source: WrappedPhotoSource = "camera",
    ) {
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

        await upload({
            file: prepared,
            idempotencyKey: crypto.randomUUID(),
            source,
        });
    }

    async function pickFromCameraRoll(file: File) {
        const id = ++pickId.current;
        // Komprimeringen ville flatet ut en GIF til ett bilde, og API-et tar
        // uansett bare stillbilder.
        if (file.type === "image/gif" || file.type.startsWith("video/")) {
            setPicked(null);
            setUploadState({
                status: "failed",
                message:
                    "GIF-er og videoer støttes ikke. Velg et vanlig bilde.",
            });
            return;
        }
        // HEIC-filer har ofte tom `type`, så de slippes gjennom på filnavnet.
        if (!file.type.startsWith("image/") && !isHeicFile(file)) {
            setPicked(null);
            setUploadState({
                status: "failed",
                message: "Filen må være et bilde.",
            });
            return;
        }

        setPicked({ file: null, src: null });
        try {
            const readable = await convertHeicToJpeg(file);
            if (id !== pickId.current) return;
            setPicked({ file: readable, src: URL.createObjectURL(readable) });
        } catch (error) {
            if (id !== pickId.current) return;
            console.error(
                "Klargjøring av bilde fra kamerarullen feilet",
                error,
            );
            setPicked(null);
            setUploadState({
                status: "failed",
                message:
                    error instanceof Error
                        ? error.message
                        : "Fikk ikke lest bildet. Velg et annet.",
            });
        }
    }

    function cancelPick() {
        pickId.current++;
        setPicked(null);
    }

    function confirmPick() {
        if (!picked?.file) return;
        const { file } = picked;
        cancelPick();
        void handlePhoto(file, "camera_roll");
    }

    const openCameraRoll = () => cameraRollRef.current?.click();
    const cameraRollInput = (
        <WrappedCameraRollInput
            ref={cameraRollRef}
            onPick={(file) => void pickFromCameraRoll(file)}
        />
    );

    async function shoot() {
        const pressedAt = Date.now();
        if (pressedAt - lastShutterAt.current < SHUTTER_COOLDOWN_MS) return;
        lastShutterAt.current = pressedAt;

        let file: File;
        try {
            const viewfinder = viewfinderRef.current;
            if (!viewfinder) throw new Error("Kameraet er ikke klart ennå.");
            file = await viewfinder.capture();
        } catch (error) {
            console.error("Kunne ikke ta bilde med søkeren", error);
            setUploadState({
                status: "failed",
                message:
                    error instanceof Error
                        ? error.message
                        : "Fikk ikke tatt bildet. Prøv igjen.",
            });
            return;
        }
        await handlePhoto(file);
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
            <WrappedCameraScreen slug={slug} title={event.title}>
                {uploadState.status === "done" ? <WrappedPhotoSaved /> : null}
                <WrappedCameraUnavailable
                    reason={camera.reason}
                    opensAt={camera.opensAt}
                />
                {myPhotosStrip}
                {organizerLink}
            </WrappedCameraScreen>
        );
    }

    if (picked) {
        return (
            <>
                <WrappedCameraRollConfirm
                    src={picked.src}
                    shotsLeft={camera.shotsLeft}
                    onCancel={cancelPick}
                    onConfirm={confirmPick}
                    onPickAnother={openCameraRoll}
                />
                {cameraRollInput}
            </>
        );
    }

    const busy =
        uploadState.status === "converting" ||
        uploadState.status === "uploading";

    const retry =
        pending && uploadState.status === "failed"
            ? () => void upload(pending)
            : undefined;

    // Uten søker — nektet tilgang, eller en nettleser som ikke har kamera —
    // står telefonens eget kamera igjen, gjennom et filfelt.
    if (
        useSystemCamera ||
        viewfinderState === "denied" ||
        viewfinderState === "unavailable"
    ) {
        return (
            <WrappedCameraScreen slug={slug} title={event.title}>
                {viewfinderState === "denied" ||
                viewfinderState === "unavailable" ? (
                    <WrappedCameraFallback reason={viewfinderState} />
                ) : null}
                <WrappedCamera
                    eventTitle={event.title}
                    shotsLeft={camera.shotsLeft}
                    shotsPerPerson={camera.shotsPerPerson}
                    uploadState={uploadState}
                    onPhoto={(file) => void handlePhoto(file)}
                    onRetry={retry}
                />
                <Button
                    variant="outline"
                    disabled={busy || camera.shotsLeft === 0}
                    onClick={openCameraRoll}
                >
                    <Images />
                    Velg fra kamerarullen
                </Button>
                {cameraRollInput}
                {myPhotosStrip}
                {organizerLink}
            </WrappedCameraScreen>
        );
    }

    return (
        <WrappedCameraScreen
            slug={slug}
            title={event.title}
            action={
                torchSupported ? (
                    <CameraControlButton
                        aria-label="Lommelykt"
                        aria-pressed={torch}
                        onClick={() => setTorch((on) => !on)}
                    >
                        {torch ? <Flashlight /> : <FlashlightOff />}
                    </CameraControlButton>
                ) : null
            }
        >
            <WrappedViewfinder
                viewfinderRef={viewfinderRef}
                facingMode={facingMode}
                torch={torch}
                viewfinderState={viewfinderState}
                shotsLeft={camera.shotsLeft}
                shotsPerPerson={camera.shotsPerPerson}
                uploadState={uploadState}
                onStateChange={setViewfinderState}
                onTorchSupportChange={(supported) => {
                    setTorchSupported(supported);
                    if (!supported) setTorch(false);
                }}
                onShutter={() => void shoot()}
                onSwitchCamera={() =>
                    setFacingMode((mode) =>
                        mode === "environment" ? "user" : "environment",
                    )
                }
                onUseSystemCamera={() => setUseSystemCamera(true)}
                onPickFromCameraRoll={openCameraRoll}
                onRetry={retry}
                myPhotos={myPhotosStrip}
            />
            {cameraRollInput}
        </WrappedCameraScreen>
    );
}
