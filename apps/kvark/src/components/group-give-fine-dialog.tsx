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
import { ImageDropzone } from "@tihlde/ui/ui/image-dropzone";
import { Input } from "@tihlde/ui/ui/input";
import { Separator } from "@tihlde/ui/ui/separator";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { useEffect, useState } from "react";

import { LawCombobox } from "#/components/law-combobox";
import {
    MemberMultiCombobox,
    type ComboboxMember,
} from "#/components/user-combobox";
import type { Law } from "#/lib/group";
import { imageDropzoneLabels } from "#/lib/image";

export type GiveFineValues = {
    /** Én bot opprettes per mottaker. */
    userIds: string[];
    lawId: string | null;
    amount: number;
    reason: string;
    image: File | null;
};

type GroupGiveFineDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    members: ComboboxMember[];
    laws: Law[];
    onSubmit: (values: GiveFineValues) => void;
    isSubmitting?: boolean;
    /** Feilmelding fra opprettelsen, vist i dialogen så skjemaet beholdes. */
    error?: string | null;
};

export function GroupGiveFineDialog({
    open,
    onOpenChange,
    members,
    laws,
    onSubmit,
    isSubmitting,
    error,
}: GroupGiveFineDialogProps) {
    const [recipients, setRecipients] = useState<ComboboxMember[]>([]);
    const [law, setLaw] = useState<Law | null>(null);
    // Tekst, ikke tall: med `Number(e.target.value)` ble et tomt felt straks
    // til 0 igjen, så du fikk aldri slettet det paragrafen fylte inn for å
    // skrive et nytt antall.
    const [amount, setAmount] = useState("1");
    const [reason, setReason] = useState("");
    const [image, setImage] = useState<File | null>(null);

    // Dialogen blir stående montert mellom hver gang den åpnes, så uten dette
    // møter neste bot forrige bots mottakere og begrunnelse.
    useEffect(() => {
        if (open) return;
        setRecipients([]);
        setLaw(null);
        setAmount("1");
        setReason("");
        setImage(null);
    }, [open]);

    function handleLawChange(next: Law | null) {
        setLaw(next);
        if (next) setAmount(String(next.amount));
    }

    // 0 er en gyldig bot (en advarsel som ikke teller i summene), så feltet
    // valideres på «er dette et helt tall ≥ 0», ikke på at det er positivt.
    const parsedAmount = Number(amount);
    const amountValid =
        amount.trim().length > 0 &&
        Number.isInteger(parsedAmount) &&
        parsedAmount >= 0;

    // En gruppe uten lovverk skal fortsatt kunne gi bøter — da er det ingen
    // paragraf å velge, og feltet er ikke påkrevd.
    const lawRequired = laws.length > 0;
    const canSubmit =
        recipients.length > 0 &&
        reason.trim().length > 0 &&
        amountValid &&
        (!lawRequired || law !== null) &&
        !isSubmitting;

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit({
            userIds: recipients.map((member) => member.id),
            lawId: law?.id ?? null,
            amount: parsedAmount,
            reason: reason.trim(),
            image,
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Ny bot</DialogTitle>
                    <DialogDescription>
                        Opprett en ny bot for et lovbrudd
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form
                        id="give-fine-form"
                        className="flex flex-col gap-4"
                        onSubmit={handleSubmit}
                    >
                        <FieldGroup>
                            <Field>
                                <FieldLabel>
                                    Hvem har begått et lovbrudd? *
                                </FieldLabel>
                                <MemberMultiCombobox
                                    items={members}
                                    value={recipients}
                                    onValueChange={setRecipients}
                                    placeholder="Velg bruker..."
                                />
                                <p className="text-xs text-muted-foreground">
                                    Du kan velge flere personer. Alle får hver
                                    sin bot.
                                </p>
                            </Field>

                            <Field>
                                <FieldLabel>
                                    Lovbrudd {lawRequired ? "*" : null}
                                </FieldLabel>
                                <LawCombobox
                                    items={laws}
                                    value={law}
                                    onValueChange={handleLawChange}
                                />
                                {law ? (
                                    <div className="mt-2 flex gap-3">
                                        <Separator
                                            orientation="vertical"
                                            className="h-auto self-stretch"
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            {law.description}
                                        </p>
                                    </div>
                                ) : null}
                                {lawRequired ? null : (
                                    <p className="text-xs text-muted-foreground">
                                        Gruppa har ikke lagt inn noe lovverk
                                        ennå, så boten gis uten paragraf.
                                    </p>
                                )}
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="fine-amount">
                                    Forslag til antall bøter *
                                </FieldLabel>
                                <Input
                                    id="fine-amount"
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Sett 0 hvis boten skal registreres uten å
                                    telle.
                                </p>
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="fine-reason">
                                    Begrunnelse *
                                </FieldLabel>
                                <Textarea
                                    id="fine-reason"
                                    rows={3}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Skriv en kort begrunnelse..."
                                />
                            </Field>

                            <Field>
                                <FieldLabel>Bilde</FieldLabel>
                                <ImageDropzone
                                    preset="natural"
                                    value={image ? [image] : []}
                                    onValueChange={(next) =>
                                        setImage(next[0] ?? null)
                                    }
                                    accept={{ "image/*": [] }}
                                    disabled={isSubmitting}
                                    labels={imageDropzoneLabels}
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
                        form="give-fine-form"
                        disabled={!canSubmit}
                    >
                        {isSubmitting ? "Oppretter …" : "Opprett bot"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
