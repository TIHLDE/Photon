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

import type { Law } from "#/routes/_app/grupper.$slug.mock";

type GroupLawFormDialogProps = {
    open: boolean;
    law: Law | null;
    onClose: () => void;
};

export function GroupLawFormDialog({
    open,
    law,
    onClose,
}: GroupLawFormDialogProps) {
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
                <form className="flex flex-col gap-4">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="law-paragraph">
                                Paragraf *
                            </FieldLabel>
                            <Input
                                id="law-paragraph"
                                defaultValue={law?.paragraph ?? "1"}
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
                                defaultValue={law?.title ?? ""}
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
                                defaultValue={law?.description ?? ""}
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
                                defaultValue={law?.amount ?? 1}
                            />
                            <p className="text-xs text-muted-foreground">
                                Brukes for å forhåndsutfylle antall bøter når
                                det lages en ny
                            </p>
                        </Field>
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Avbryt
                    </Button>
                    <Button>{law ? "Oppdater" : "Opprett"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
