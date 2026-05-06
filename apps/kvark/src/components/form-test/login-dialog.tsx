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
import { FieldContent, FieldGroup } from "@tihlde/ui/ui/field";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { z } from "zod";

const schema = z.object({
    email: z.email({ error: "Ugyldig e-post" }),
    password: z.string().min(1, { error: "Skriv inn passord" }),
    rememberMe: z.boolean(),
});

interface LoginDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
    const form = useAppForm({
        defaultValues: {
            email: "",
            password: "",
            rememberMe: false,
        },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            globalThis.console.log("Login:", value);
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
                    <DialogTitle>Logg inn</DialogTitle>
                    <DialogDescription>
                        Bruk TIHLDE-kontoen din for å logge inn.
                    </DialogDescription>
                </DialogHeader>
                <form {...formHandlers(form)} className="flex flex-col gap-4">
                    <FieldGroup>
                        <form.AppField name="email">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>E-post</field.Label>
                                    <field.Input
                                        type="email"
                                        autoComplete="email"
                                        placeholder="navn@example.com"
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="password">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Passord</field.Label>
                                    <field.Password autoComplete="current-password" />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="rememberMe">
                            {(field) => (
                                <field.Field orientation="horizontal">
                                    <FieldContent>
                                        <field.Label>Husk meg</field.Label>
                                    </FieldContent>
                                    <field.Switch />
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
                                        <span>Logger inn...</span>
                                    </>
                                }
                            >
                                Logg inn
                            </form.SubmitButton>
                        </form.AppForm>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
