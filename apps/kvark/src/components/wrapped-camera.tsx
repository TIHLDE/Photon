import { useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { Camera, CircleCheck, RotateCcw, TriangleAlert } from "lucide-react";

export type WrappedUploadState =
    | { status: "idle" }
    | { status: "converting" }
    | { status: "uploading" }
    | { status: "done" }
    | { status: "failed"; message: string };

type WrappedCameraProps = {
    eventTitle: string;
    shotsLeft: number;
    shotsPerPerson: number;
    uploadState: WrappedUploadState;
    onPhoto: (file: File) => void;
    /**
     * Bare satt når et bilde ligger klart og et nytt forsøk kan hjelpe —
     * altså ikke når serveren har avvist selve bildet.
     */
    onRetry?: () => void;
};

/**
 * Kvitteringen for et lagret bilde. Egen komponent fordi den også må vises
 * over «ingen bilder igjen»: det siste bildet tømmer kvoten i samme øyeblikk
 * som det lagres, og uten kvitteringen vet ingen om det kom fram.
 */
export function WrappedPhotoSaved() {
    return (
        <Alert>
            <CircleCheck />
            <AlertTitle>Bildet er lagret</AlertTitle>
            <AlertDescription>Det er sendt til arrangøren.</AlertDescription>
        </Alert>
    );
}

/**
 * Engangskameraet for ett arrangement. Bildet vises aldri etter at det er
 * tatt — det er hele poenget — bare at det ble lagret.
 */
export function WrappedCamera({
    eventTitle,
    shotsLeft,
    shotsPerPerson,
    uploadState,
    onPhoto,
    onRetry,
}: WrappedCameraProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const busy =
        uploadState.status === "converting" ||
        uploadState.status === "uploading";

    return (
        <Card>
            <CardHeader>
                <CardTitle>{eventTitle}</CardTitle>
                <CardDescription>
                    Arrangøren velger ut hvilke bilder som deles etter
                    arrangementet.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <Badge variant="secondary">
                    {shotsLeft} av {shotsPerPerson} bilder igjen
                </Badge>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        // Tøm feltet så samme fil kan velges på nytt.
                        e.target.value = "";
                        if (file) onPhoto(file);
                    }}
                />
                <Button
                    size="lg"
                    className="w-full"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                >
                    {busy ? <Spinner /> : <Camera />}
                    {uploadState.status === "converting"
                        ? "Gjør klar bildet …"
                        : uploadState.status === "uploading"
                          ? "Laster opp …"
                          : "Ta bilde"}
                </Button>

                {uploadState.status === "done" ? <WrappedPhotoSaved /> : null}

                {uploadState.status === "failed" ? (
                    <Alert variant="destructive">
                        <TriangleAlert />
                        <AlertTitle>Bildet ble ikke lastet opp</AlertTitle>
                        <AlertDescription className="flex flex-col gap-2">
                            <span>{uploadState.message}</span>
                            {onRetry ? (
                                <>
                                    <span>
                                        Bildet er tatt vare på. Et nytt forsøk
                                        koster ikke et ekstra bilde.
                                    </span>
                                    <div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={onRetry}
                                        >
                                            <RotateCcw />
                                            Prøv igjen
                                        </Button>
                                    </div>
                                </>
                            ) : null}
                        </AlertDescription>
                    </Alert>
                ) : null}
            </CardContent>
        </Card>
    );
}
