import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import { QrCode } from "lucide-react";
import type { ReactElement } from "react";

type EventQrDialogProps = {
    trigger: ReactElement;
    title: string;
    registrantName: string;
};

export function EventQrDialog({
    trigger,
    title,
    registrantName,
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
                    <div className="flex aspect-square w-full max-w-64 items-center justify-center rounded-lg border bg-muted">
                        <QrCode className="size-32 text-muted-foreground" />
                    </div>
                    <span>{registrantName}</span>
                    <span className="text-sm text-muted-foreground">
                        Vis denne koden ved oppmøte
                    </span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
