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
import { convertHeicToJpeg, isHeicFile } from "@tihlde/ui/lib/heic";
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
    type WrappedPhotoSource,
} from "#/api/queries/wrapped";
import { WrappedCamera } from "#/components/wrapped-camera";
import {
    WrappedCameraRollConfirm,
    WrappedCameraRollInput,
} from "#/components/wrapped-camera-roll";
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
        fromCameraRoll: boolean;
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

    /**
     * Si fra med en gang, så det aldri er tvil om at bildet ble tatt. Blitsen
     * hører til søkeren; et bilde fra kamerarullen får kortet og vibrasjonen.
     */
    function acknowledge(source: WrappedPhotoSource = "camera") {
        setLastArrived(false);
        navigator.vibrate?.(40);
        const key = Date.now();
        if (source === "camera") setFlashKey(key);
        setReceipt({
            key,
            shotsLeft: Math.max(0, shotsLeft - 1),
            fromCameraRoll: source === "camera_roll",
        });
    }

    /** Fra filfeltet: bildet finnes allerede. */
    function took(file: File) {
        acknowledge();
        queue.enqueue(file);
    }

    async function pickFromCameraRoll(file: File) {
        const id = ++pickId.current;
        // Komprimeringen ville flatet ut en GIF til ett bilde, og API-et tar
        // uansett bare stillbilder.
        if (file.type === "image/gif" || file.type.startsWith("video/")) {
            setPicked(null);
            toast.error("Bildet ble ikke lagt til", {
                description:
                    "GIF-er og videoer støttes ikke. Velg et vanlig bilde.",
            });
            return;
        }
        // HEIC-filer har ofte tom `type`, så de slippes gjennom på filnavnet.
        if (!file.type.startsWith("image/") && !isHeicFile(file)) {
            setPicked(null);
            toast.error("Bildet ble ikke lagt til", {
                description: "Filen må være et bilde.",
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
            toast.error("Bildet ble ikke lagt til", {
                description:
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
        if (!picked?.file || shotsLeft <= 0) return;
        const { file } = picked;
        cancelPick();
        // Samme kø som kameraet: egen nøkkel, venter på nett, prøver igjen.
        acknowledge("camera_roll");
        queue.enqueue(file, "camera_roll");
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
                <WrappedCameraUnavailable
                    reason={camera.reason}
                    opensAt={camera.opensAt}
                    closesAt={camera.closesAt}
                    shotsPerPerson={camera.shotsPerPerson}
                    shotsUsed={camera.shotsUsed}
                    draftCount={camera.draftCount}
                    // Det siste bildet tømmer kvoten i samme øyeblikk som det
                    // kommer fram, så kvitteringen står på «Filmen er full».
                    lastArrived={lastArrived && queue.count === 0}
                    eventLink={
                        <Link to="/arrangementer/$slug" params={{ slug }} />
                    }
                    homeLink={<Link to="/" />}
                    myPhotosLink={
                        <Link
                            to="/arrangementer/$slug/kamera/mine"
                            params={{ slug }}
                        />
                    }
                />
                {/* «Filmen er full» har sin egen knapp til Mine bilder. */}
                {camera.reason === "no_shots_left" ? null : myPhotosStrip}
                {organizerLink}
            </WrappedCameraScreen>
        );
    }

    if (picked) {
        return (
            <>
                <WrappedCameraRollConfirm
                    src={picked.src}
                    shotsLeft={shotsLeft}
                    onCancel={cancelPick}
                    onConfirm={confirmPick}
                    onPickAnother={openCameraRoll}
                />
                {cameraRollInput}
            </>
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
                                    fromCameraRoll={receipt.fromCameraRoll}
                                />
                            ) : null}
                            {waiting}
                        </>
                    }
                />
                <Button
                    variant="outline"
                    disabled={shotsLeft <= 0}
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
                shotsLeft={shotsLeft}
                shotsPerPerson={camera.shotsPerPerson}
                flashKey={flashKey}
                receipt={
                    receipt ? (
                        <WrappedShotReceipt
                            key={receipt.key}
                            shotsLeft={receipt.shotsLeft}
                            fromCameraRoll={receipt.fromCameraRoll}
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
                onPickFromCameraRoll={openCameraRoll}
                myPhotos={myPhotosStrip}
            />
            {cameraRollInput}
        </WrappedCameraScreen>
    );
}
