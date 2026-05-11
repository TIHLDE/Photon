import { formHandlers, useAppForm } from "#/hooks/form";
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
import { z } from "zod";

const schema = z
    .object({
        currentPassword: z
            .string()
            .min(1, { error: "Skriv inn nåværende passord" }),
        newPassword: z.string().min(8, { error: "Minst 8 tegn" }),
        confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        error: "Passordene må være like",
        path: ["confirmPassword"],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
        error: "Nytt passord må være ulikt nåværende",
        path: ["newPassword"],
    });

interface ChangePasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({
    open,
    onOpenChange,
}: ChangePasswordDialogProps) {
    const form = useAppForm({
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            globalThis.console.log("Change password:", value);
            onOpenChange(false);
            form.reset();
        },
    });

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) form.reset();
                onOpenChange(o);
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Endre passord</DialogTitle>
                    <DialogDescription>
                        Oppgi nåværende passord og velg et nytt.
                    </DialogDescription>
                </DialogHeader>
                <form {...formHandlers(form)} className="flex flex-col gap-4">
                    <FieldGroup>
                        <form.AppField name="currentPassword">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Nåværende passord</field.Label>
                                    <field.Password autoComplete="current-password" />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="newPassword">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Nytt passord</field.Label>
                                    <field.Password autoComplete="new-password" />
                                    <field.Description>
                                        Minst 8 tegn
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="confirmPassword">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>
                                        Bekreft nytt passord
                                    </field.Label>
                                    <field.Password autoComplete="new-password" />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                    </FieldGroup>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Avbryt
                        </Button>
                        <form.AppForm>
                            <form.SubmitButton
                                loading={
                                    <>
                                        <Spinner />
                                        <span>Oppdaterer...</span>
                                    </>
                                }
                            >
                                Oppdater passord
                            </form.SubmitButton>
                        </form.AppForm>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
