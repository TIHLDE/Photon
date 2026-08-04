import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { FieldGroup } from "@tihlde/ui/ui/field";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { TriangleAlert } from "lucide-react";
import { z } from "zod";

import { formHandlers, useAppForm } from "#/hooks/form";

const schema = z.object({
    title: z
        .string()
        .min(1, { error: "Tittel er påkrevd" })
        .max(400, { error: "Maks 400 tegn" }),
});

type GroupNewFormDialogProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (values: { title: string }) => void;
    isSubmitting: boolean;
    error: string | null;
};

export function GroupNewFormDialog({
    open,
    onClose,
    onSubmit,
    isSubmitting,
    error,
}: GroupNewFormDialogProps) {
    const form = useAppForm({
        defaultValues: { title: "" },
        validators: { onDynamic: schema },
        onSubmit({ value }) {
            onSubmit({ title: value.title.trim() });
        },
    });

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) {
                    form.reset();
                    onClose();
                }
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Nytt spørreskjema</DialogTitle>
                    <DialogDescription>
                        Alle TIHLDE-medlemmer vil kunne svare på skjemaet, flere
                        ganger om de ønsker. Skjemaet er stengt til du åpner det
                        under «Rediger», og der legger du også til spørsmålene.
                        Spørsmålene kan endres helt til noen har svart.
                    </DialogDescription>
                </DialogHeader>
                <form {...formHandlers(form)} className="flex flex-col gap-4">
                    {error ? (
                        <Alert variant="destructive">
                            <TriangleAlert />
                            <AlertTitle>
                                Klarte ikke å opprette skjemaet
                            </AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : null}
                    <FieldGroup>
                        <form.AppField name="title">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Tittel</field.Label>
                                    <field.Input placeholder="Skriv her..." />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                    </FieldGroup>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Avbryt
                        </Button>
                        <form.AppForm>
                            <form.SubmitButton
                                disabled={isSubmitting}
                                loading={
                                    <>
                                        <Spinner />
                                        <span>Oppretter...</span>
                                    </>
                                }
                            >
                                Opprett spørreskjema
                            </form.SubmitButton>
                        </form.AppForm>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
