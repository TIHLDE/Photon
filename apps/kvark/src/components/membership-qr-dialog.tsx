import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import { QRCode } from "@tihlde/ui/ui/qr-code";
import { QrCode } from "lucide-react";

type MembershipQrDialogProps = {
    name: string;
    /**
     * Bruker-id-en som skannes ved innsjekk på arrangementer. Uten den finnes
     * det ikke noe gyldig medlemsbevis, så knappen deaktiveres.
     */
    userId?: string;
};

export function MembershipQrDialog({ name, userId }: MembershipQrDialogProps) {
    return (
        <Dialog>
            <DialogTrigger
                render={
                    <Button variant="outline" disabled={!userId}>
                        <QrCode />
                        Medlemsbevis
                    </Button>
                }
            />
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Medlemsbevis</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4">
                    {userId ? (
                        <QRCode className="w-full max-w-xs" value={userId} />
                    ) : null}
                    <p className="text-base font-medium">{name}</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
