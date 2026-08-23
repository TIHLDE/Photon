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
import { useRef, useState, type ReactNode } from "react";

type ConfirmDeleteDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Spørsmål som navngir det som slettes, f.eks. «Slette «Fadderuka»?». */
    title: ReactNode;
    /** Én linje om hva som forsvinner, og at det ikke kan angres. */
    description: ReactNode;
    /** Handlingen, kort og konkret: «Slett arrangement». */
    confirmLabel: string;
    onConfirm: () => void;
    isPending?: boolean;
};

/**
 * Bekreftelse før noe slettes for godt. Erstatter `window.confirm`, slik at
 * teksten kan si hva som faktisk skjer og knappene ser ut som resten av appen.
 */
export function ConfirmDeleteDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    onConfirm,
    isPending = false,
}: ConfirmDeleteDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel variant="outline" size="default">
                        Avbryt
                    </AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        disabled={isPending}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/**
 * State for en bekreftelsesdialog som gjelder ett element i en liste.
 *
 * `shown` henger igjen på det forrige elementet mens dialogen animeres ut.
 * Uten det bytter tittelen til «undefined» i det halve sekundet lukkingen
 * tar, siden `pending` allerede er nullet når siste render kjører.
 */
export function usePendingConfirm<T>() {
    const [pending, setPending] = useState<T | null>(null);
    const lastShown = useRef<T | null>(null);
    if (pending) lastShown.current = pending;

    return {
        /** Elementet som venter på bekreftelse, eller `null`. */
        pending,
        /** Elementet dialogen skal vise — også mens den lukkes. */
        shown: pending ?? lastShown.current,
        open: pending !== null,
        request: (item: T) => setPending(item),
        clear: () => setPending(null),
    };
}
