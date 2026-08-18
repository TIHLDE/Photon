import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import { QRCode } from "@tihlde/ui/ui/qr-code";
import type { ReactElement } from "react";

type EventQrDialogProps = {
    trigger: ReactElement;
    title: string;
    registrantName: string;
    /**
     * Bruker-id-en som skannes ved innsjekk. Uten den finnes det ikke noe
     * gyldig bevis, så dialogen sier fra i stedet for å vise en tom ramme.
     */
    userId?: string;
};

export function EventQrDialog({
    trigger,
    title,
    registrantName,
    userId,
}: EventQrDialogProps) {
    return (
        <Dialog>
            <DialogTrigger render={trigger} />
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Påmeldingsbevis</DialogTitle>
                    <DialogDescription>{title}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-3 p-4">
                    {userId ? (
                        <>
                            <QRCode
                                className="w-full max-w-64"
                                value={userId}
                            />
                            <span>{registrantName}</span>
                            <span className="text-sm text-muted-foreground">
                                Vis denne koden ved oppmøte
                            </span>
                        </>
                    ) : (
                        <>
                            <span>{registrantName}</span>
                            <span className="text-sm text-muted-foreground">
                                Logg inn på nytt for å hente medlemsbeviset
                                ditt.
                            </span>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
