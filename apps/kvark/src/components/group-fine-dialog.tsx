import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";

import type { Fine } from "#/routes/_app/grupper.$slug.mock";

type GroupFineDialogProps = {
    fines: Fine[];
    openIndex: number | null;
    onOpenChange: (i: number | null) => void;
};

export function GroupFineDialog({
    fines,
    openIndex,
    onOpenChange,
}: GroupFineDialogProps) {
    const fine = openIndex !== null ? fines[openIndex] : null;

    function go(delta: number) {
        if (openIndex === null) return;
        const next = openIndex + delta;
        if (next < 0 || next >= fines.length) return;
        onOpenChange(next);
    }

    return (
        <Dialog
            open={fine !== null}
            onOpenChange={(open) => {
                if (!open) onOpenChange(null);
            }}
        >
            <DialogContent className="max-w-lg">
                {fine ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>
                                {fine.paragraph} - {fine.title}
                            </DialogTitle>
                            <DialogDescription>{fine.user}</DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2">
                                <Badge
                                    variant={
                                        fine.approved ? "default" : "outline"
                                    }
                                >
                                    {fine.approved
                                        ? "Godkjent"
                                        : "Ikke godkjent"}
                                </Badge>
                                <Badge
                                    variant={fine.paid ? "default" : "outline"}
                                >
                                    {fine.paid ? "Betalt" : "Ikke betalt"}
                                </Badge>
                            </div>
                            <div className="text-sm">
                                <p>Opprettet av: {fine.createdBy}</p>
                                <p>Dato: {fine.date}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground">
                                    Begrunnelse
                                </span>
                                <p className="text-sm">{fine.reason}</p>
                            </div>
                            <div className="aspect-video w-full rounded-md bg-muted" />
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline">
                                    Merk som godkjent
                                </Button>
                                <Button size="sm" variant="outline">
                                    Merk som betalt
                                </Button>
                                <Button size="sm" variant="outline">
                                    <Pencil />
                                    Rediger bot
                                </Button>
                                <Button size="sm" variant="outline">
                                    <Trash2 />
                                    Slett bot
                                </Button>
                            </div>
                        </div>
                        <DialogFooter className="justify-between sm:justify-between">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => go(-1)}
                                disabled={openIndex === 0}
                            >
                                <ChevronLeft />
                                Forrige
                            </Button>
                            <span className="self-center text-xs text-muted-foreground">
                                {openIndex !== null ? openIndex + 1 : 0} /{" "}
                                {fines.length}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => go(1)}
                                disabled={
                                    openIndex !== null &&
                                    openIndex >= fines.length - 1
                                }
                            >
                                Neste
                                <ChevronRight />
                            </Button>
                        </DialogFooter>
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
