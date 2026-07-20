import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import { QrCode } from "lucide-react";

type MembershipQrDialogProps = {
    name: string;
};

export function MembershipQrDialog({ name }: MembershipQrDialogProps) {
    return (
        <Dialog>
            <DialogTrigger
                render={
                    <Button variant="outline">
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
                    <p className="text-base font-medium">{name}</p>
                    <div className="flex aspect-square w-full max-w-xs items-center justify-center rounded-md bg-muted">
                        <QrCode className="size-32 text-muted-foreground" />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
