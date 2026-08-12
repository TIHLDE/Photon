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
import type { ReactNode } from "react";

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
