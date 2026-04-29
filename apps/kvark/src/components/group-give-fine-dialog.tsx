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
import { Separator } from "@tihlde/ui/ui/separator";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { useState } from "react";

import { ImageDropzone } from "#/components/image-dropzone";
import { LawCombobox } from "#/components/law-combobox";
import { UserMultiCombobox } from "#/components/user-combobox";
import type { Law } from "#/routes/_app/grupper.$slug.mock";

type GroupGiveFineDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    users: string[];
    laws: Law[];
};

export function GroupGiveFineDialog({
    open,
    onOpenChange,
    users,
    laws,
}: GroupGiveFineDialogProps) {
    const [recipients, setRecipients] = useState<string[]>([]);
    const [law, setLaw] = useState<Law | null>(null);
    const [amount, setAmount] = useState<number>(1);

    function handleLawChange(next: Law | null) {
        setLaw(next);
        if (next) setAmount(next.amount);
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
                <form className="flex flex-col gap-4">
                    <FieldGroup>
                        <Field>
                            <FieldLabel>
                                Hvem har begått et lovbrudd? *
                            </FieldLabel>
                            <UserMultiCombobox
                                items={users}
                                value={recipients}
                                onValueChange={setRecipients}
                                placeholder="Velg bruker..."
                            />
                            <p className="text-xs text-muted-foreground">
                                Du kan velge flere personer
                            </p>
                        </Field>

                        <Field>
                            <FieldLabel>Lovbrudd *</FieldLabel>
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
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="fine-amount">
                                Forslag til antall bøter *
                            </FieldLabel>
                            <Input
                                id="fine-amount"
                                type="number"
                                value={amount}
                                onChange={(e) =>
                                    setAmount(Number(e.target.value))
                                }
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="fine-reason">
                                Begrunnelse *
                            </FieldLabel>
                            <Textarea
                                id="fine-reason"
                                rows={3}
                                placeholder="Skriv en kort begrunnelse..."
                            />
                        </Field>

                        <Field>
                            <FieldLabel>Bilde</FieldLabel>
                            <ImageDropzone />
                        </Field>
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Avbryt
                    </Button>
                    <Button>Opprett bot</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
