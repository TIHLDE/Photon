import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@tihlde/ui/ui/alert-dialog";
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
import { Label } from "@tihlde/ui/ui/label";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { Fine } from "#/lib/group";

import { assetImageUrl } from "#/lib/assets";

type GroupFineDialogProps = {
    fines: Fine[];
    openIndex: number | null;
    onOpenChange: (i: number | null) => void;
    /**
     * Whether the viewer may act on the fine. Members can see the group's
     * fines but only the botsjef and fines:* holders may settle them, so the
     * action row is hidden rather than shown and rejected.
     */
    canManage: boolean;
    /**
     * Den innloggede brukeren. Bare den bøtelagte kan skrive forsvar, så uten
     * dette vet dialogen ikke om feltet skal vises eller bare leses.
     */
    currentUserId?: string;
    onApprove: (fine: Fine) => void;
    onMarkPaid: (fine: Fine) => void;
    onDelete: (fine: Fine) => void;
    onSaveDefense: (fine: Fine, defense: string) => void;
};

export function GroupFineDialog({
    fines,
    openIndex,
    onOpenChange,
    canManage,
    currentUserId,
    onApprove,
    onMarkPaid,
    onDelete,
    onSaveDefense,
}: GroupFineDialogProps) {
    const fine = openIndex !== null ? fines[openIndex] : null;
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [defenseDraft, setDefenseDraft] = useState<string | null>(null);

    // Utkastet hører til én bot. Uten dette ville teksten du skrev fulgt med
    // når du blar videre med piltastene.
    const fineId = fine?.id ?? null;
    useEffect(() => {
        setDefenseDraft(null);
    }, [fineId]);

    const isOwnFine = Boolean(
        fine && currentUserId && fine.userId === currentUserId,
    );
    const defenseValue = defenseDraft ?? fine?.defense ?? "";
    const defenseChanged =
        defenseDraft !== null && defenseDraft !== fine?.defense;

    const go = useCallback(
        (delta: number) => {
            if (openIndex === null) return;
            const next = openIndex + delta;
            if (next < 0 || next >= fines.length) return;
            onOpenChange(next);
        },
        [openIndex, fines.length, onOpenChange],
    );

    // Å bla gjennom mange bøter med mus er tungvint. Piltastene er bundet så
    // lenge dialogen står åpen, men ikke mens bekreftelsen på sletting vises.
    useEffect(() => {
        if (openIndex === null || confirmDelete) return;

        function onKeyDown(event: KeyboardEvent) {
            // Piltastene flytter markøren mens du skriver forsvaret. Uten
            // dette hoppet dialogen til neste bot midt i setningen.
            const target = event.target as HTMLElement | null;
            if (
                target?.tagName === "TEXTAREA" ||
                target?.tagName === "INPUT" ||
                target?.isContentEditable
            ) {
                return;
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                go(-1);
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                go(1);
            }
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [openIndex, confirmDelete, go]);

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
                                {fine.paragraph ? `${fine.paragraph} - ` : ""}
                                {fine.title}
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
                            {fine.image ? (
                                <img
                                    src={assetImageUrl(fine.image, 960)}
                                    alt="Bevis for boten"
                                    loading="lazy"
                                    decoding="async"
                                    className="max-h-80 w-full rounded-md object-contain"
                                />
                            ) : null}
                            {isOwnFine ? (
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="fine-defense">
                                        Ditt forsvar
                                    </Label>
                                    <Textarea
                                        id="fine-defense"
                                        rows={3}
                                        placeholder="Forklar din side av saken"
                                        value={defenseValue}
                                        onChange={(event) =>
                                            setDefenseDraft(event.target.value)
                                        }
                                    />
                                    <Button
                                        size="sm"
                                        className="self-start"
                                        disabled={!defenseChanged}
                                        onClick={() => {
                                            onSaveDefense(fine, defenseValue);
                                            setDefenseDraft(null);
                                        }}
                                    >
                                        Lagre forsvar
                                    </Button>
                                </div>
                            ) : fine.defense ? (
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">
                                        Forsvar
                                    </span>
                                    <p className="text-sm">{fine.defense}</p>
                                </div>
                            ) : null}
                            {/* «Rediger bot» lå her, men PATCH-endepunktet tar
                                bare status og forsvar — begrunnelse og beløp
                                kan ikke endres, så knappen gjorde ingenting. */}
                            {canManage ? (
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={fine.approved}
                                        onClick={() => onApprove(fine)}
                                    >
                                        Merk som godkjent
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={fine.paid}
                                        onClick={() => onMarkPaid(fine)}
                                    >
                                        Merk som betalt
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setConfirmDelete(true)}
                                    >
                                        <Trash2 />
                                        Slett bot
                                    </Button>
                                </div>
                            ) : null}
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

                <AlertDialog
                    open={confirmDelete}
                    onOpenChange={setConfirmDelete}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Slett boten?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Boten fjernes for godt og forsvinner fra
                                gruppens oversikt.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel variant="outline" size="default">
                                Avbryt
                            </AlertDialogCancel>
                            <AlertDialogAction
                                variant="destructive"
                                onClick={() => {
                                    if (!fine) return;
                                    onDelete(fine);
                                    // Boten finnes ikke lenger, så dialogen
                                    // har ingenting å vise.
                                    onOpenChange(null);
                                }}
                            >
                                Slett bot
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    );
}
