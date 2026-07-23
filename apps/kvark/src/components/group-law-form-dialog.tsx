import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { useEffect, useState } from "react";

import type { Law } from "#/lib/group";

export type LawFormValues = {
    paragraph: number;
    title: string;
    description: string;
    amount: number;
};

type GroupLawFormDialogProps = {
    open: boolean;
    law: Law | null;
    onClose: () => void;
    onSubmit: (values: LawFormValues) => void;
    onDelete?: () => void;
};

export function GroupLawFormDialog({
    open,
    law,
    onClose,
    onSubmit,
    onDelete,
}: GroupLawFormDialogProps) {
    const [paragraph, setParagraph] = useState("1");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("1");

    // Re-seed the fields whenever the dialog opens for a (different) law.
    useEffect(() => {
        if (!open) return;
        setParagraph(law?.paragraph ?? "1");
        setTitle(law?.title ?? "");
        setDescription(law?.description ?? "");
        setAmount(String(law?.amount ?? 1));
    }, [open, law]);

    const parsedParagraph = Number(paragraph.replace(",", "."));
    const parsedAmount = Number(amount);
    const valid =
        Number.isFinite(parsedParagraph) &&
        parsedParagraph >= 0 &&
        parsedParagraph <= 99.99 &&
        title.trim().length > 0 &&
        Number.isInteger(parsedAmount) &&
        parsedAmount >= 0;

    function handleSubmit() {
        if (!valid) return;
        onSubmit({
            paragraph: parsedParagraph,
            title: title.trim(),
            description,
            amount: parsedAmount,
        });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) onClose();
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {law ? "Rediger lovparagraf" : "Ny lovparagraf"}
                    </DialogTitle>
                    <DialogDescription>
                        {law
                            ? "Oppdater paragrafen for gruppen"
                            : "Opprett en ny lovparagraf for gruppen"}
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSubmit();
                    }}
                >
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="law-paragraph">
                                Paragraf *
                            </FieldLabel>
                            <Input
                                id="law-paragraph"
                                value={paragraph}
                                onChange={(e) => setParagraph(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Heltall for overskrift. Maks 2 siffer på hver
                                side av komma
                            </p>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="law-title">
                                Tittel *
                            </FieldLabel>
                            <Input
                                id="law-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Skriv her..."
                            />
                            <p className="text-xs text-muted-foreground">
                                For eks.: Forsentkomming
                            </p>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="law-description">
                                Beskrivelse
                            </FieldLabel>
                            <Textarea
                                id="law-description"
                                rows={4}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Skriv her..."
                            />
                            <p className="text-xs text-muted-foreground">
                                La stå tom for å ikke kunne velges ved
                                botgivning
                            </p>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="law-amount">
                                Veiledende antall bøter *
                            </FieldLabel>
                            <Input
                                id="law-amount"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Brukes for å forhåndsutfylle antall bøter når
                                det lages en ny
                            </p>
                        </Field>
                    </FieldGroup>
                </form>
                <DialogFooter>
                    {law && onDelete ? (
                        <Button
                            variant="destructive"
                            className="mr-auto"
                            onClick={onDelete}
                        >
                            Slett
                        </Button>
                    ) : null}
                    <Button variant="outline" onClick={onClose}>
                        Avbryt
                    </Button>
                    <Button disabled={!valid} onClick={handleSubmit}>
                        {law ? "Oppdater" : "Opprett"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
