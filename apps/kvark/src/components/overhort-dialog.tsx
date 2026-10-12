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
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

const schema = z.object({
    name: z.string().trim().min(1, { error: "Feltet er påkrevd" }).max(200),
    statement: z
        .string()
        .trim()
        .min(1, { error: "Feltet er påkrevd" })
        .max(5000, { error: "Maks 5000 tegn" }),
});

/** Hvor lenge «Sendt!» vises før dialogen lukker seg selv. */
const CLOSE_AFTER_SENT_MS = 1000;

export type OverhortValues = z.infer<typeof schema>;

interface OverhortDialogProps {
    /** Rejects with the reason when the submission could not be sent. */
    onSubmit: (values: OverhortValues) => Promise<void>;
}

export function OverhortDialog({ onSubmit }: OverhortDialogProps) {
    const [open, setOpen] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const form = useAppForm({
        defaultValues: { name: "", statement: "" },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            setSubmitError(null);
            try {
                await onSubmit(value);
            } catch (error) {
                // Dialogen blir stående med det som ble skrevet, så det kan
                // sendes på nytt.
                setSubmitError(
                    error instanceof Error
                        ? error.message
                        : "Fikk ikke sendt inn. Prøv igjen.",
                );
                return;
            }
            setSent(true);
            form.reset();
        },
    });

    useEffect(() => {
        if (!sent || !open) return;
        const timer = setTimeout(() => setOpen(false), CLOSE_AFTER_SENT_MS);
        return () => clearTimeout(timer);
    }, [sent, open]);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                // Tilbakestilles ved åpning, ikke lukking: ellers blinker
                // skjemaet frem igjen mens dialogen animeres bort.
                if (next) {
                    form.reset();
                    setSubmitError(null);
                    setSent(false);
                }
                setOpen(next);
            }}
        >
            {/* ph-no-capture: PostHog skal verken logge klikk eller ta opp
                skjemaet, ellers kan tidspunktet knyttes til innsendingen. */}
            <DialogTrigger
                render={
                    <Button className="ph-no-capture">
                        Send inn til Overhört
                    </Button>
                }
            />
            <DialogContent className="ph-no-capture" showCloseButton={!sent}>
                <DialogHeader>
                    <DialogTitle>Send inn til Overhört</DialogTitle>
                </DialogHeader>
                {sent ? (
                    <Alert>
                        <CheckCircle2 />
                        <AlertTitle>Sendt!</AlertTitle>
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
                                            <field.Label>
                                                Navnet til den skyldige:
                                            </field.Label>
                                            <field.Input />
                                            <field.Error />
                                        </field.Field>
                                    )}
                                </form.AppField>
                                <form.AppField name="statement">
                                    {(field) => (
                                        <field.Field required>
                                            <field.Label>
                                                Hva som ble sagt:
                                            </field.Label>
                                            <field.Textarea rows={6} />
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
                                    Send inn
                                </form.SubmitButton>
                            </form.AppForm>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
