import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import {
    type CameraFacingMode,
    type CameraViewfinderHandle,
    type CameraViewfinderState,
    CameraControlButton,
} from "@tihlde/ui/ui/camera-viewfinder";
import { toast } from "@tihlde/ui/ui/sonner";
import { Flashlight, FlashlightOff, Images } from "lucide-react";

import { authClientWithRedirect } from "#/api/auth";
import { getEventByIdQuery } from "#/api/queries/events";
import {
    fetchMyWrappedPhotoThumb,
    getMyWrappedPhotosQuery,
    getWrappedCameraQuery,
    invalidateMine,
    myWrappedPhotoImagePath,
} from "#/api/queries/wrapped";
import { WrappedCamera, WrappedPhotoSaved } from "#/components/wrapped-camera";
import { WrappedCameraFallback } from "#/components/wrapped-camera-fallback";
import { WrappedCameraScreen } from "#/components/wrapped-camera-screen";
import { WrappedCameraSkeleton } from "#/components/wrapped-camera-skeleton";
import { WrappedCameraUnavailable } from "#/components/wrapped-camera-unavailable";
import { WrappedMyPhotosStrip } from "#/components/wrapped-my-photos-strip";
import { WrappedShotReceipt } from "#/components/wrapped-shot-receipt";
import { WrappedUploadWaiting } from "#/components/wrapped-upload-waiting";
import { WrappedViewfinder } from "#/components/wrapped-viewfinder";
import { useNow } from "#/hooks/use-now";
import { useObjectUrls } from "#/hooks/use-object-urls";
import { useWrappedUploadQueue } from "#/hooks/use-wrapped-upload-queue";
import { formatInOslo } from "#/lib/date";
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

/** Hvor lenge «Knips!» står før den forsvinner av seg selv. */
const RECEIPT_MS = 2500;

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

    // Kvitteringen for siste bilde, med det som var igjen etter det. Ny
    // nøkkel per bilde, så blitsen og kortet spilles av på nytt hver gang.
    const [receipt, setReceipt] = useState<{
        key: number;
        shotsLeft: number;
    } | null>(null);
    const [flashKey, setFlashKey] = useState<number | null>(null);
    // Det siste bildet tømmer kvoten i samme øyeblikk som det kommer fram,
    // og «ingen bilder igjen»-skjermen må kunne si at det gjorde det.
    const [lastArrived, setLastArrived] = useState(false);

    const queue = useWrappedUploadQueue({
        eventId: event.id,
        onUploaded(result) {
            setLastArrived(true);
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
            void queryClient.invalidateQueries({
                queryKey: cameraQuery.queryKey,
            });
        },
        // 403/409: statusen vi viste var utdatert. Grunnen hentes fra
        // serveren og vises i stedet for en egen feilmelding.
        onStale: () => void refetch(),
        onRejected: (message) =>
            toast.error("Bildet ble ikke lastet opp", { description: message }),
    });
    // Bilder som er trykket, men ikke ferdig fanget fra søkeren ennå. JPEG-en
    // tar et øyeblikk å lage, og kvitteringen skal ikke vente på den.
    const [capturing, setCapturing] = useState(0);
    // Telleren går ned i det utløseren trykkes, ikke når bildet er lastet
    // opp: det serveren har talt, minus det som er på vei. Et svar eller en
    // ny henting kan da aldri dytte tallet opp igjen mens bilder venter.
    const shotsLeft = Math.max(0, camera.shotsLeft - queue.count - capturing);

    useEffect(() => {
        if (!receipt) return;
        const timer = setTimeout(() => setReceipt(null), RECEIPT_MS);
        return () => clearTimeout(timer);
    }, [receipt]);

    const viewfinderRef = useRef<CameraViewfinderHandle>(null);
    const [viewfinderState, setViewfinderState] =
        useState<CameraViewfinderState>("requesting");
    const [facingMode, setFacingMode] =
        useState<CameraFacingMode>("environment");
    const [torchSupported, setTorchSupported] = useState(false);
    const [torch, setTorch] = useState(false);
    const [useSystemCamera, setUseSystemCamera] = useState(false);
    const lastShutterAt = useRef(0);

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

    /** Si fra med en gang, så det aldri er tvil om at bildet ble tatt. */
    function acknowledge() {
        setLastArrived(false);
        navigator.vibrate?.(40);
        const key = Date.now();
        setFlashKey(key);
        setReceipt({ key, shotsLeft: Math.max(0, shotsLeft - 1) });
    }

    /** Fra filfeltet: bildet finnes allerede. */
    function took(file: File) {
        acknowledge();
        queue.enqueue(file);
    }

    async function shoot() {
        const pressedAt = Date.now();
        if (pressedAt - lastShutterAt.current < SHUTTER_COOLDOWN_MS) return;
        if (shotsLeft <= 0) return;
        lastShutterAt.current = pressedAt;

        acknowledge();
        setCapturing((n) => n + 1);
        try {
            const viewfinder = viewfinderRef.current;
            if (!viewfinder) throw new Error("Kameraet er ikke klart ennå.");
            queue.enqueue(await viewfinder.capture());
        } catch (error) {
            console.error("Kunne ikke ta bilde med søkeren", error);
            setReceipt(null);
            toast.error("Fikk ikke tatt bildet", {
                description:
                    error instanceof Error ? error.message : "Prøv igjen.",
            });
        } finally {
            setCapturing((n) => n - 1);
        }
    }

    const waiting =
        queue.waiting && queue.count > 0 ? (
            <WrappedUploadWaiting count={queue.count} onRetry={queue.retry} />
        ) : null;

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
                {waiting}
                {lastArrived && queue.count === 0 ? (
                    <WrappedPhotoSaved />
                ) : null}
                <WrappedCameraUnavailable
                    reason={camera.reason}
                    opensAt={camera.opensAt}
                />
                {myPhotosStrip}
                {organizerLink}
            </WrappedCameraScreen>
        );
    }

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
                    shotsLeft={shotsLeft}
                    shotsPerPerson={camera.shotsPerPerson}
                    onPhoto={took}
                    status={
                        <>
                            {receipt ? (
                                <WrappedShotReceipt
                                    key={receipt.key}
                                    shotsLeft={receipt.shotsLeft}
                                />
                            ) : null}
                            {waiting}
                        </>
                    }
                />
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
                shotsLeft={shotsLeft}
                shotsPerPerson={camera.shotsPerPerson}
                flashKey={flashKey}
                receipt={
                    receipt ? (
                        <WrappedShotReceipt
                            key={receipt.key}
                            shotsLeft={receipt.shotsLeft}
                        />
                    ) : null
                }
                waiting={waiting}
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
                myPhotos={myPhotosStrip}
            />
        </WrappedCameraScreen>
    );
}
