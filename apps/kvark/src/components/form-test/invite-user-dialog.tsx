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

const ROLES = [
    { value: "admin", label: "Administrator" },
    { value: "member", label: "Medlem" },
    { value: "guest", label: "Gjest" },
];

const schema = z.object({
    email: z.email({ error: "Ugyldig e-post" }),
    role: z
        .union([z.literal(""), z.enum(["admin", "member", "guest"])])
        .refine((v) => v !== "", { error: "Velg en rolle" }),
    message: z.string().max(500, { error: "Maks 500 tegn" }),
});

interface InviteUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({
    open,
    onOpenChange,
}: InviteUserDialogProps) {
    const form = useAppForm({
        defaultValues: {
            email: "",
            role: "" as "" | "admin" | "member" | "guest",
            message: "",
        },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            globalThis.console.log("Invite:", value);
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
                    <DialogTitle>Inviter bruker</DialogTitle>
                    <DialogDescription>
                        Send en invitasjon på e-post.
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
                        <form.AppField name="role">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Rolle</field.Label>
                                    <field.Select
                                        options={ROLES}
                                        placeholder="Velg rolle"
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="message">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Personlig melding</field.Label>
                                    <field.Textarea
                                        rows={3}
                                        placeholder="Valgfritt — vises i e-posten"
                                    />
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
                                        <span>Sender...</span>
                                    </>
                                }
                            >
                                Send invitasjon
                            </form.SubmitButton>
                        </form.AppForm>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
