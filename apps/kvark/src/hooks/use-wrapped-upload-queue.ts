import { useMutation } from "@tanstack/react-query";
import { isHeicFile } from "@tihlde/ui/lib/heic";
import { compressImageFile } from "@tihlde/ui/lib/image-compression";
import { useCallback, useEffect, useRef, useState } from "react";

import {
    type WrappedPhotoSource,
    type WrappedUploadResult,
    uploadWrappedPhotoMutation,
} from "#/api/queries/wrapped";
import { errorStatus } from "#/lib/utils";

/** Det API-et tar imot. Alt annet avvises der, så det stoppes her. */
const UPLOADABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type QueueItem = {
    /** Også idempotensnøkkelen: den samme i hvert forsøk på dette bildet. */
    id: string;
    file: File;
    /** Kameraet eller kamerarullen; følger bildet i hvert forsøk. */
    source: WrappedPhotoSource;
    /** Komprimert og klar, så et nytt forsøk slipper å gjøre det igjen. */
    prepared: File | null;
};

type UploadQueueOptions = {
    eventId: string;
    /** Et bilde kom fram. Svaret har tellerne slik serveren ser dem. */
    onUploaded: (result: WrappedUploadResult) => void;
    /** 403/409: statusen vi viste var utdatert og må hentes på nytt. */
    onStale: () => void;
    /** Et bilde som ikke kan sendes på nytt, med serverens forklaring. */
    onRejected: (message: string) => void;
};

/**
 * Bildene som er tatt, men ikke lastet opp ennå — i minnet, i rekkefølge.
 *
 * Utløseren venter aldri på dette: den legger bildet i køen og er klar igjen.
 * Køen gjør klar (HEIC, komprimering) og laster opp ett bilde om gangen. Feiler
 * nettet, stopper den og venter — til `retry()`, eller til nettleseren melder
 * at nettet er tilbake — og hvert bilde beholder nøkkelen sin, så et nytt
 * forsøk aldri koster et ekstra bilde.
 */
export function useWrappedUploadQueue({
    eventId,
    onUploaded,
    onStale,
    onRejected,
}: UploadQueueOptions) {
    const uploadPhoto = useMutation(uploadWrappedPhotoMutation);
    const items = useRef<QueueItem[]>([]);
    const running = useRef(false);
    const [count, setCount] = useState(0);
    const [waiting, setWaiting] = useState(false);
    const callbacks = useRef({ onUploaded, onStale, onRejected });
    useEffect(() => {
        callbacks.current = { onUploaded, onStale, onRejected };
    });

    const drop = useCallback((item: QueueItem) => {
        items.current = items.current.filter((other) => other !== item);
        setCount(items.current.length);
    }, []);

    const prepare = useCallback(
        async (item: QueueItem): Promise<File | null> => {
            if (item.prepared) return item.prepared;
            // HEIC-filer har ofte tom `type`, så de slippes gjennom på navnet.
            if (
                !item.file.type.startsWith("image/") &&
                !isHeicFile(item.file)
            ) {
                callbacks.current.onRejected("Filen må være et bilde.");
                return null;
            }
            try {
                // Konverterer også HEIC til JPEG før den komprimerer.
                const prepared = await compressImageFile(item.file);
                if (!UPLOADABLE_TYPES.includes(prepared.type)) {
                    console.warn("Kamerabilde i et format API-et ikke tar", {
                        type: prepared.type,
                    });
                    callbacks.current.onRejected(
                        "Kameraet tar bare vanlige bilder. Ta et nytt bilde med kameraet på telefonen.",
                    );
                    return null;
                }
                item.prepared = prepared;
                return prepared;
            } catch (error) {
                console.error("Klargjøring av kamerabilde feilet", error);
                callbacks.current.onRejected(
                    error instanceof Error
                        ? error.message
                        : "Fikk ikke lest bildet. Prøv å ta det på nytt.",
                );
                return null;
            }
        },
        [],
    );

    const pump = useCallback(async () => {
        if (running.current) return;
        running.current = true;
        setWaiting(false);
        try {
            for (;;) {
                const item = items.current[0];
                if (!item) return;

                const file = await prepare(item);
                if (!file) {
                    drop(item);
                    continue;
                }

                try {
                    const result = await uploadPhoto.mutateAsync({
                        eventId,
                        file,
                        idempotencyKey: item.id,
                        source: item.source,
                    });
                    if (import.meta.env.DEV) {
                        console.info("[wrapped] lastet opp", result.id);
                    }
                    // Samme tikk: telleren regnes som serverens tall minus
                    // det som står i køen, så de to må endres sammen.
                    callbacks.current.onUploaded(result);
                    drop(item);
                } catch (error) {
                    console.error("Opplasting av kamerabilde feilet", error);
                    const status =
                        error instanceof Error
                            ? errorStatus(error.cause)
                            : undefined;
                    if (status === 403 || status === 409) {
                        drop(item);
                        callbacks.current.onStale();
                        continue;
                    }
                    // Uten statuskode kom vi aldri fram, og 5xx er serverens
                    // feil: da venter bildet på et nytt forsøk. Alt annet har
                    // serveren avvist, og samme bilde får samme svar.
                    if (status === undefined || status >= 500) {
                        setWaiting(true);
                        return;
                    }
                    drop(item);
                    callbacks.current.onRejected(
                        error instanceof Error
                            ? error.message
                            : "Noe gikk galt under opplastingen.",
                    );
                }
            }
        } finally {
            running.current = false;
        }
    }, [eventId, prepare, drop, uploadPhoto]);

    const enqueue = useCallback(
        (file: File, source: WrappedPhotoSource = "camera") => {
            items.current = [
                ...items.current,
                { id: crypto.randomUUID(), file, source, prepared: null },
            ];
            setCount(items.current.length);
            // Står køen og venter på nett, får det nye bildet vente sammen
            // med de andre i stedet for å gå foran.
            if (!waiting) void pump();
        },
        [pump, waiting],
    );

    const retry = useCallback(() => void pump(), [pump]);

    // Nettleseren sier fra når nettet er tilbake; da prøver vi igjen selv.
    useEffect(() => {
        if (!waiting) return;
        window.addEventListener("online", retry);
        return () => window.removeEventListener("online", retry);
    }, [waiting, retry]);

    // Et bilde som ikke er lastet opp, finnes bare i denne fanen.
    useEffect(() => {
        if (count === 0) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [count]);

    return {
        enqueue,
        retry,
        /** Bilder som er tatt, men ikke kommet fram ennå. */
        count,
        /** Køen står stille til nettet er tilbake eller noen trykker «Prøv igjen». */
        waiting,
    };
}
