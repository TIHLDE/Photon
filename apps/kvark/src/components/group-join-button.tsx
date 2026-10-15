import { formHandlers, useAppForm } from "#/hooks/form";
import { Alert, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import { FieldError, FieldGroup } from "@tihlde/ui/ui/field";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { CheckCircle2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

const schema = z.object({
    name: z.string().trim().min(1, { error: "Feltet er påkrevd" }).max(100),
    message: z
        .string()
        .trim()
        .min(1, { error: "Feltet er påkrevd" })
        .max(2000, { error: "Maks 2000 tegn" }),
});

type GroupJoinValues = z.infer<typeof schema>;

export type GroupJoinButtonProps = {
    groupName: string;
    defaultName: string;
    pending: boolean;
    onRequest: (values: GroupJoinValues) => Promise<unknown>;
};

export function GroupJoinButton({
    groupName,
    defaultName,
    pending,
    onRequest,
}: GroupJoinButtonProps) {
    const [open, setOpen] = useState(false);
    const [sent, setSent] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const form = useAppForm({
        defaultValues: { name: defaultName, message: "" },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            setSubmitError(null);
            try {
                await onRequest(value);
                setSent(true);
            } catch (error) {
                setSubmitError(
                    error instanceof Error
                        ? error.message
                        : "Kunne ikke sende søknaden.",
                );
            }
        },
    });

    useEffect(() => {
        if (!sent || !open) return;
        const timer = setTimeout(() => setOpen(false), 1000);
        return () => clearTimeout(timer);
    }, [sent, open]);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (next) {
                    form.reset();
                    setSent(false);
                    setSubmitError(null);
                }
                setOpen(next);
            }}
        >
            <DialogTrigger
                render={
                    <Button disabled={pending}>
                        {pending ? null : <UserPlus />}
                        {pending
                            ? "Søknad sendt"
                            : "Bli med i denne interessegruppen"}
                    </Button>
                }
            />
            <DialogContent showCloseButton={!sent}>
                <DialogHeader>
                    <DialogTitle>Søk om å bli med i {groupName}</DialogTitle>
                </DialogHeader>
                {sent ? (
                    <Alert>
                        <CheckCircle2 />
                        <AlertTitle>Søknad sendt!</AlertTitle>
                    </Alert>
                ) : (
                    <form
                        {...formHandlers(form)}
                        className="flex min-h-0 flex-auto flex-col gap-4"
                    >
                        <DialogBody>
                            <FieldGroup>
                                <form.AppField name="name">
                                    {(field) => (
                                        <field.Field required>
                                            <field.Label>Navn</field.Label>
                                            <field.Input autoComplete="name" />
                                            <field.Error />
                                        </field.Field>
                                    )}
                                </form.AppField>
                                <form.AppField name="message">
                                    {(field) => (
                                        <field.Field required>
                                            <field.Label>
                                                Søknadstekst
                                            </field.Label>
                                            <field.Textarea rows={5} />
                                            <field.Error />
                                        </field.Field>
                                    )}
                                </form.AppField>
                            </FieldGroup>
                        </DialogBody>
                        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col">
                            <FieldError
                                errors={
                                    submitError
                                        ? [{ message: submitError }]
                                        : undefined
                                }
                            />
                            <form.AppForm>
                                <form.SubmitButton
                                    loading={
                                        <>
                                            <Spinner />
                                            <span>Sender...</span>
                                        </>
                                    }
                                >
                                    Send søknad
                                </form.SubmitButton>
                            </form.AppForm>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
