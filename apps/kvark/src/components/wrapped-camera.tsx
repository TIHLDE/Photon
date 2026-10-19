import { type ReactNode, useRef } from "react";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Camera } from "lucide-react";

type WrappedCameraProps = {
    eventTitle: string;
    shotsLeft: number;
    shotsPerPerson: number;
    onPhoto: (file: File) => void;
    /** The receipt for the last photo, and anything waiting for the network. */
    status?: ReactNode;
};

/**
 * Engangskameraet uten søker: telefonens eget kamera gjennom et filfelt.
 * Reserven når nettleseren ikke får bruke kameraet direkte. Bildet vises
 * aldri etter at det er tatt — det er hele poenget — bare at det ble lagret.
 */
export function WrappedCamera({
    eventTitle,
    shotsLeft,
    shotsPerPerson,
    onPhoto,
    status,
}: WrappedCameraProps) {
    const inputRef = useRef<HTMLInputElement>(null);

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
                    disabled={shotsLeft <= 0}
                    onClick={() => inputRef.current?.click()}
                >
                    <Camera />
                    Åpne kamera
                </Button>

                {status}
            </CardContent>
        </Card>
    );
}
