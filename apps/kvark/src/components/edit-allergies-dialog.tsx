import { useForm } from "@tanstack/react-form";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@tihlde/ui/ui/field";
import { RadioGroup, RadioGroupItem } from "@tihlde/ui/ui/radio-group";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { AlertCircle, Pencil } from "lucide-react";
import { useId, useState } from "react";
import { z } from "zod";

import {
    AllergyPicker,
    type AllergyOption,
    type AllergySelection,
} from "#/components/allergy-picker";

type AllergyAnswer = "" | "none" | "some";

const schema = z
    .object({
        answer: z.enum(["", "none", "some"]),
        selection: z.object({
            allergies: z.array(z.string()),
            customAllergies: z.array(z.string()),
        }),
    })
    .refine(
        ({ answer, selection }) =>
            answer === "none" ||
            (answer === "some" &&
                selection.allergies.length + selection.customAllergies.length >
                    0),
        { message: "Velg allergier eller bekreft at du ikke har noen." },
    );

type EditAllergiesDialogProps = {
    defaultValues: AllergySelection;
    hasAnswered: boolean;
    options: AllergyOption[];
    onSubmit: (selection: AllergySelection) => Promise<void>;
};

export function EditAllergiesDialog({
    defaultValues,
    hasAnswered,
    options,
    onSubmit,
}: EditAllergiesDialogProps) {
    const [open, setOpen] = useState(false);
    const [submitError, setSubmitError] = useState(false);
    const id = useId();
    const answer: AllergyAnswer =
        defaultValues.allergies.length + defaultValues.customAllergies.length >
        0
            ? "some"
            : hasAnswered
              ? "none"
              : "";

    const form = useForm({
        defaultValues: { answer, selection: defaultValues },
        validators: { onChange: schema },
        onSubmit: async ({ value }) => {
            setSubmitError(false);
            try {
                await onSubmit(
                    value.answer === "none"
                        ? { allergies: [], customAllergies: [] }
                        : value.selection,
                );
                setOpen(false);
            } catch {
                // Behold utkastet i dialogen, slik som i profilredigeringen.
                setSubmitError(true);
            }
        },
    });

    return (
        <form.Subscribe
            selector={(state) => [state.values, state.isSubmitting] as const}
        >
            {([values, isSubmitting]) => (
                <Dialog
                    open={open}
                    onOpenChange={(next) => {
                        if (isSubmitting) return;
                        // Et nytt besøk starter med det sist lagrede svaret.
                        // Refetch i bakgrunnen skal ikke overskrive et utkast.
                        if (next) {
                            form.reset({ answer, selection: defaultValues });
                            setSubmitError(false);
                        }
                        setOpen(next);
                    }}
                >
                    <DialogTrigger
                        render={
                            <Button type="button" variant="outline">
                                <Pencil />
                                {hasAnswered ? "Endre" : "Svar nå"}
                            </Button>
                        }
                    />
                    <DialogContent
                        className="max-w-lg"
                        showCloseButton={!isSubmitting}
                    >
                        <DialogHeader>
                            <DialogTitle>Allergier</DialogTitle>
                            <DialogDescription>
                                Svaret deles med arrangører når de bestiller mat
                                til arrangementer du melder deg på.
                            </DialogDescription>
                        </DialogHeader>
                        <form
                            className="flex min-h-0 flex-auto flex-col gap-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void form.handleSubmit();
                            }}
                        >
                            <DialogBody>
                                <form.Field name="answer">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel id={`${id}-label`}>
                                                Har du allergier?
                                            </FieldLabel>
                                            <RadioGroup
                                                aria-labelledby={`${id}-label`}
                                                value={field.state.value}
                                                onValueChange={(next) => {
                                                    field.handleChange(
                                                        next as AllergyAnswer,
                                                    );
                                                    setSubmitError(false);
                                                }}
                                                disabled={isSubmitting}
                                            >
                                                <Field orientation="horizontal">
                                                    <RadioGroupItem
                                                        id={`${id}-none`}
                                                        value="none"
                                                    />
                                                    <FieldLabel
                                                        htmlFor={`${id}-none`}
                                                    >
                                                        Jeg har ingen allergier
                                                    </FieldLabel>
                                                </Field>
                                                <Field orientation="horizontal">
                                                    <RadioGroupItem
                                                        id={`${id}-some`}
                                                        value="some"
                                                    />
                                                    <FieldLabel
                                                        htmlFor={`${id}-some`}
                                                    >
                                                        Jeg har allergier
                                                    </FieldLabel>
                                                </Field>
                                            </RadioGroup>
                                        </Field>
                                    )}
                                </form.Field>
                                {values.answer === "some" ? (
                                    <form.Field name="selection">
                                        {(field) => (
                                            <Field>
                                                <AllergyPicker
                                                    options={options}
                                                    value={field.state.value}
                                                    onChange={(next) => {
                                                        field.handleChange(
                                                            next,
                                                        );
                                                        setSubmitError(false);
                                                    }}
                                                    disabled={isSubmitting}
                                                />
                                                <FieldDescription>
                                                    Velg fra lista, eller skriv
                                                    inn og legg til dine egne.
                                                    Velg minst én allergi.
                                                </FieldDescription>
                                            </Field>
                                        )}
                                    </form.Field>
                                ) : null}
                                {submitError ? (
                                    <Alert variant="destructive">
                                        <AlertCircle />
                                        <AlertTitle>
                                            Svaret ble ikke lagret
                                        </AlertTitle>
                                        <AlertDescription>
                                            Prøv igjen. Allergiene du valgte
                                            ligger fortsatt her.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                            </DialogBody>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isSubmitting}
                                    onClick={() => setOpen(false)}
                                >
                                    Avbryt
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        isSubmitting ||
                                        !schema.safeParse(values).success
                                    }
                                >
                                    {isSubmitting ? (
                                        <Spinner aria-hidden="true" />
                                    ) : null}
                                    {isSubmitting
                                        ? "Lagrer …"
                                        : submitError
                                          ? "Prøv igjen"
                                          : "Lagre svar"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </form.Subscribe>
    );
}
