import { useMutation } from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import { cn } from "@tihlde/ui/lib/utils";
import { CheckCircle2, QrCode, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { setAttendanceMutation } from "#/api/queries/events";
import { extractErrorMessage } from "#/lib/api-error";

/**
 * Innsjekk ved døra: medlemsbeviset er en QR-kode med brukerens id (se
 * `membership-qr-dialog`), så en skanning er ikke annet enn et kall på
 * oppmøte-endepunktet med den id-en.
 *
 * Selve regelen om hvem som kan hukes av ligger i API-et: det svarer 409 for
 * folk på venteliste og 404 for folk som ikke er påmeldt i det hele tatt.
 * Her vises bare svaret — en avvist skanning huker ikke av noen.
 */

type ScanResult = {
    /** Nøkkel for lista; skanninger av samme person skal ikke kollidere. */
    key: number;
    ok: boolean;
    title: string;
    description?: string;
};

/**
 * Et kort som blir liggende foran kameraet leses mange ganger i sekundet. En
 * vellykket innsjekk gjentas derfor ikke før noen andre er skannet, mens en
 * avvist skanning kan prøves på nytt etter et par sekunder.
 */
const RETRY_COOLDOWN_MS = 3000;

/** Hvor ofte bildet analyseres. Raskt nok til å føles umiddelbart. */
const SCAN_INTERVAL_MS = 120;

type BarcodeDetectorLike = {
    detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
};

type BarcodeDetectorConstructor = new (options: {
    formats: string[];
}) => BarcodeDetectorLike;

async function createDetector(): Promise<BarcodeDetectorLike> {
    const Detector = (
        globalThis as unknown as {
            BarcodeDetector?: BarcodeDetectorConstructor;
        }
    ).BarcodeDetector;

    if (Detector) {
        try {
            return new Detector({ formats: ["qr_code"] });
        } catch {
            // Nettleseren har API-et, men ikke QR-formatet. Fall videre.
        }
    }

    // Safari har ikke BarcodeDetector, og det er iPhone-ene som skanner i
    // døra. jsQR lastes derfor bare når kameraet faktisk åpnes.
    const { default: jsQR } = await import("jsqr");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    return {
        detect(source) {
            const video = source as HTMLVideoElement;
            if (!context || !video.videoWidth || !video.videoHeight) {
                return Promise.resolve([]);
            }
            // Nedskalert: jsQR kjører på hovedtråden, og full oppløsning gjør
            // hver avlesning merkbart treg på en telefon.
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            );
            const code = jsQR(image.data, image.width, image.height);
            return Promise.resolve(code ? [{ rawValue: code.data }] : []);
        },
    };
}

export function AttendanceScannerDialog({ eventId }: { eventId: string }) {
    const [open, setOpen] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [results, setResults] = useState<ScanResult[]>([]);

    const videoRef = useRef<HTMLVideoElement>(null);
    /** Sist behandlede kode, slik at samme kort ikke sendes om og om igjen. */
    const lastScanRef = useRef<{
        value: string;
        at: number;
        ok: boolean;
    } | null>(null);
    const inFlightRef = useRef(false);

    const setAttendance = useMutation(setAttendanceMutation);
    const { mutateAsync } = setAttendance;

    const handleScan = useCallback(
        async (userId: string) => {
            inFlightRef.current = true;
            lastScanRef.current = { value: userId, at: Date.now(), ok: false };
            try {
                const result = await mutateAsync({
                    eventId,
                    userId,
                    attended: true,
                });
                lastScanRef.current = {
                    value: userId,
                    at: Date.now(),
                    ok: true,
                };
                navigator.vibrate?.(60);
                setResults((prev) => [
                    {
                        key: Date.now(),
                        ok: true,
                        title: `${result.name} er huket av`,
                        description: "Møtt opp",
                    },
                    ...prev.slice(0, 4),
                ]);
            } catch (error) {
                const description = await describeScanError(error);
                lastScanRef.current = {
                    value: userId,
                    at: Date.now(),
                    ok: false,
                };
                navigator.vibrate?.([60, 60, 60]);
                setResults((prev) => [
                    {
                        key: Date.now(),
                        ok: false,
                        title: "Ikke huket av",
                        description,
                    },
                    ...prev.slice(0, 4),
                ]);
            } finally {
                inFlightRef.current = false;
            }
        },
        [eventId, mutateAsync],
    );

    useEffect(() => {
        if (!open) {
            return;
        }

        let stream: MediaStream | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let stopped = false;

        const stop = () => {
            stopped = true;
            if (timer) {
                clearTimeout(timer);
            }
            for (const track of stream?.getTracks() ?? []) {
                track.stop();
            }
        };

        const start = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraError(
                    "Denne nettleseren gir ikke tilgang til kamera. Åpne siden i Safari eller Chrome på telefonen.",
                );
                return;
            }

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    // Bakkameraet på telefon; på PC blir det webkameraet.
                    video: { facingMode: { ideal: "environment" } },
                    audio: false,
                });
            } catch {
                setCameraError(
                    "Fikk ikke tilgang til kameraet. Tillat kamera for siden og prøv igjen.",
                );
                return;
            }

            const video = videoRef.current;
            if (stopped || !video) {
                stop();
                return;
            }

            video.srcObject = stream;
            video.setAttribute("playsinline", "true");
            await video.play().catch(() => {});

            const detector = await createDetector();
            if (stopped) {
                return;
            }

            const tick = async () => {
                if (stopped) {
                    return;
                }
                if (!inFlightRef.current && video.readyState >= 2) {
                    try {
                        const [code] = await detector.detect(video);
                        const value = code?.rawValue.trim();
                        const last = lastScanRef.current;
                        const isRepeat =
                            last?.value === value &&
                            (last.ok ||
                                Date.now() - last.at < RETRY_COOLDOWN_MS);

                        if (value && !isRepeat) {
                            await handleScan(value);
                        }
                    } catch {
                        // En enkelt mislykket avlesning betyr bare at neste
                        // bilde får prøve seg.
                    }
                }
                if (!stopped) {
                    timer = setTimeout(tick, SCAN_INTERVAL_MS);
                }
            };

            void tick();
        };

        void start();

        return stop;
    }, [open, handleScan]);

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) {
            setCameraError(null);
            setResults([]);
            lastScanRef.current = null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger
                render={
                    <Button variant="outline" type="button">
                        <QrCode />
                        Skann medlemsbevis
                    </Button>
                }
            />
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Skann medlemsbevis</DialogTitle>
                    <DialogDescription>
                        Hold medlemsbeviset foran kameraet. Den som skannes blir
                        huket av som møtt.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody className="flex flex-col gap-4">
                    {cameraError ? (
                        <p className="text-destructive text-sm">
                            {cameraError}
                        </p>
                    ) : (
                        <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-md">
                            <video
                                ref={videoRef}
                                muted
                                playsInline
                                className="size-full object-cover"
                            />
                        </div>
                    )}

                    {results.length > 0 ? (
                        <ul className="flex flex-col gap-2">
                            {results.map((result, index) => (
                                <li
                                    key={result.key}
                                    className={cn(
                                        "flex items-start gap-2 rounded-md border p-3 text-sm",
                                        result.ok
                                            ? "border-emerald-500/40 bg-emerald-500/10"
                                            : "border-destructive/40 bg-destructive/10",
                                        // Bare den nyeste skal fange blikket.
                                        index > 0 && "opacity-60",
                                    )}
                                >
                                    {result.ok ? (
                                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                                    ) : (
                                        <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                                    )}
                                    <div>
                                        <p className="font-medium">
                                            {result.title}
                                        </p>
                                        {result.description ? (
                                            <p className="text-muted-foreground">
                                                {result.description}
                                            </p>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </DialogBody>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                    >
                        Lukk
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * API-et svarer 404 for folk som ikke er påmeldt og 409 for folk uten plass.
 * Begge deler er «nei» i døra, men det er stor forskjell på dem for den som
 * står med skanneren.
 */
async function describeScanError(error: unknown): Promise<string> {
    const response =
        error && typeof error === "object" && "response" in error
            ? error.response
            : null;
    const status = response instanceof Response ? response.status : null;

    if (status === 404) {
        return "Personen er ikke påmeldt dette arrangementet.";
    }
    if (status === 409) {
        return "Personen har ikke plass på arrangementet – står på venteliste eller har mistet plassen.";
    }
    if (status === 403) {
        return "Du har ikke tilgang til å registrere oppmøte her.";
    }
    return await extractErrorMessage(error);
}
