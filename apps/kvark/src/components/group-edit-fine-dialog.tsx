import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { useEffect, useState } from "react";

import { LawCombobox } from "#/components/law-combobox";
import { NumberInput } from "#/components/number-input";
import type { Fine, Law } from "#/lib/group";

export type EditFineValues = {
    lawId: string | null;
    amount: number;
    reason: string;
};

type GroupEditFineDialogProps = {
    /** Boten som redigeres. `null` lukker dialogen. */
    fine: Fine | null;
    onOpenChange: (open: boolean) => void;
    laws: Law[];
    onSubmit: (fine: Fine, values: EditFineValues) => void;
    isSubmitting?: boolean;
    error?: string | null;
};

/**
 * Botsjefen retter opp en bot som allerede er gitt: feil paragraf, feil
 * antall eller en begrunnelse som må skrives om. Mottakeren står fast — en bot
 * til feil person slettes og gis på nytt.
 */
export function GroupEditFineDialog({
    fine,
    onOpenChange,
    laws,
    onSubmit,
    isSubmitting,
    error,
}: GroupEditFineDialogProps) {
    const [law, setLaw] = useState<Law | null>(null);
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");

    // Fyll skjemaet fra boten hver gang en ny åpnes. Bare på id-en: en
    // refetch av bøtene eller lovverket i bakgrunnen skal ikke viske ut det
    // botsjefen holder på å skrive.
    const fineId = fine?.id;
    useEffect(() => {
        if (!fine) return;
        setLaw(laws.find((l) => l.id === fine.lawId) ?? null);
        setAmount(String(fine.amount));
        setReason(fine.reason);
    }, [fineId]);

    function handleLawChange(next: Law | null) {
        setLaw(next);
        if (next) setAmount(String(next.amount));
    }

    const parsedAmount = Number(amount);
    const amountValid =
        amount.trim().length > 0 && Number.isInteger(parsedAmount);
    const canSubmit =
        fine !== null &&
        reason.trim().length > 0 &&
        amountValid &&
        !isSubmitting;

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!fine || !canSubmit) return;
        onSubmit(fine, {
            lawId: law?.id ?? null,
            amount: parsedAmount,
            reason: reason.trim(),
        });
    }

    return (
        <Dialog open={fine !== null} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Rediger bot</DialogTitle>
                    <DialogDescription>
                        {fine ? `Boten til ${fine.user}` : null}
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form
                        id="edit-fine-form"
                        className="flex flex-col gap-4"
                        onSubmit={handleSubmit}
                    >
                        <FieldGroup>
                            {laws.length > 0 ? (
                                <Field>
                                    <FieldLabel>Lovbrudd</FieldLabel>
                                    <LawCombobox
                                        items={laws}
                                        value={law}
                                        onValueChange={handleLawChange}
                                    />
                                    {law ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="self-start"
                                            onClick={() => setLaw(null)}
                                        >
                                            Fjern paragraf
                                        </Button>
                                    ) : null}
                                </Field>
                            ) : null}

                            <Field>
                                <FieldLabel htmlFor="edit-fine-amount">
                                    Antall bøter *
                                </FieldLabel>
                                <NumberInput
                                    id="edit-fine-amount"
                                    step={1}
                                    value={amount}
                                    onValueChange={setAmount}
                                />
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="edit-fine-reason">
                                    Begrunnelse *
                                </FieldLabel>
                                <Textarea
                                    id="edit-fine-reason"
                                    rows={3}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                />
                            </Field>
                        </FieldGroup>
                        {error ? <p role="alert">{error}</p> : null}
                    </form>
                </DialogBody>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Avbryt
                    </Button>
                    <Button
                        type="submit"
                        form="edit-fine-form"
                        disabled={!canSubmit}
                    >
                        {isSubmitting ? "Lagrer …" : "Lagre endringer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
