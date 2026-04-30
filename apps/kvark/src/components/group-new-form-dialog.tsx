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

type GroupNewFormDialogProps = {
    open: boolean;
    onClose: () => void;
};

export function GroupNewFormDialog({ open, onClose }: GroupNewFormDialogProps) {
    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) onClose();
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Nytt spørreskjema</DialogTitle>
                    <DialogDescription>
                        Alle TIHLDE-medlemmer vil kunne svare på skjemaet, flere
                        ganger om de ønsker. Du kan legge til spørsmål etter at
                        du har opprettet skjemaet. Spørsmålene kan endres helt
                        til noen har svart på skjemaet.
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-4">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="form-title">
                                Tittel *
                            </FieldLabel>
                            <Input
                                id="form-title"
                                placeholder="Skriv her..."
                                required
                            />
                        </Field>
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Avbryt
                    </Button>
                    <Button>Opprett spørreskjema</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
