import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { FieldError, FieldGroup, FieldSeparator } from "@tihlde/ui/ui/field";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";

import { formHandlers, useAppForm } from "#/hooks/form";

const QUESTION_TYPES = [
    { value: "text_answer", label: "Fritekst" },
    { value: "single_select", label: "Ett alternativ" },
    { value: "multiple_select", label: "Flere alternativer" },
] as const;

const optionSchema = z.object({
    // Lokal nøkkel for React-lista. Sendes ikke til API-et.
    key: z.string(),
    title: z
        .string()
        .min(1, { error: "Alternativet må ha en tekst" })
        .max(400, { error: "Maks 400 tegn" }),
});

const questionSchema = z
    .object({
        key: z.string(),
        title: z
            .string()
            .min(1, { error: "Spørsmålet må ha en tekst" })
            .max(400, { error: "Maks 400 tegn" }),
        type: z.enum(["text_answer", "single_select", "multiple_select"]),
        required: z.boolean(),
        options: z.array(optionSchema),
    })
    .refine((q) => q.type === "text_answer" || q.options.length > 0, {
        error: "Legg til minst ett alternativ",
        path: ["options"],
    });

const newFormSchema = z.object({
    title: z
        .string()
        .min(1, { error: "Tittel er påkrevd" })
        .max(400, { error: "Maks 400 tegn" }),
    description: z.string().max(2000, { error: "Maks 2000 tegn" }),
    emailReceiverOnSubmit: z.union([
        z.email({ error: "Må være en gyldig e-postadresse" }),
        z.literal(""),
    ]),
    canSubmitMultiple: z.boolean(),
    isOpenForSubmissions: z.boolean(),
    onlyForGroupMembers: z.boolean(),
    questions: z.array(questionSchema),
});

export type NewFormValues = z.infer<typeof newFormSchema>;
type NewFormQuestion = NewFormValues["questions"][number];

const EMPTY_VALUES: NewFormValues = {
    title: "",
    description: "",
    emailReceiverOnSubmit: "",
    canSubmitMultiple: true,
    // Et nyopprettet skjema er åpent med en gang — det vanlige er at man
    // lager et skjema fordi man vil ha svar nå. Det kan stenges igjen under
    // «Rediger».
    isOpenForSubmissions: true,
    onlyForGroupMembers: false,
    questions: [],
};

/** Stabil nøkkel per spørsmål/alternativ så lista overlever sletting midt i. */
function newKey(): string {
    return globalThis.crypto.randomUUID();
}

function emptyQuestion(): NewFormQuestion {
    return {
        key: newKey(),
        title: "",
        type: "text_answer",
        required: false,
        options: [],
    };
}

type GroupNewFormDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: NewFormValues) => void | Promise<void>;
    isSubmitting?: boolean;
    /** Feil fra opprettelsen, vist i dialogen så skjemaet beholdes. */
    error?: string | null;
};

export function GroupNewFormDialog({
    open,
    onOpenChange,
    onSubmit,
    isSubmitting,
    error,
}: GroupNewFormDialogProps) {
    const form = useAppForm({
        defaultValues: EMPTY_VALUES,
        validators: { onDynamic: newFormSchema },
        async onSubmit({ value }) {
            await onSubmit(value);
        },
    });

    // Dialogen blir stående montert mellom hver gang den åpnes, så uten dette
    // møter neste skjema forrige skjemas tittel og spørsmål.
    useEffect(() => {
        if (!open) form.reset();
    }, [open, form]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Nytt spørreskjema</DialogTitle>
                    <DialogDescription>
                        Legg til spørsmålene du vil ha svar på. Spørsmålene kan
                        endres helt til noen har svart på skjemaet.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="new-group-form"
                    {...formHandlers(form)}
                    className="flex flex-col gap-4"
                >
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

                        <form.AppField name="description">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Beskrivelse</field.Label>
                                    <field.Textarea
                                        rows={3}
                                        placeholder="Hva handler skjemaet om?"
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>

                        <FieldSeparator />

                        <form.Field name="questions" mode="array">
                            {(questions) => (
                                <div className="flex flex-col gap-4">
                                    {questions.state.value.map(
                                        (question, index) => (
                                            <div
                                                key={question.key}
                                                className="flex flex-col gap-3"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-medium">
                                                        Spørsmål {index + 1}
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Fjern spørsmål ${index + 1}`}
                                                        onClick={() =>
                                                            questions.removeValue(
                                                                index,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                </div>

                                                <form.AppField
                                                    name={`questions[${index}].title`}
                                                >
                                                    {(field) => (
                                                        <field.Field required>
                                                            <field.Label>
                                                                Spørsmål
                                                            </field.Label>
                                                            <field.Input placeholder="Skriv her..." />
                                                            <field.Error />
                                                        </field.Field>
                                                    )}
                                                </form.AppField>

                                                <form.AppField
                                                    name={`questions[${index}].type`}
                                                >
                                                    {(field) => (
                                                        <field.Field>
                                                            <field.Label>
                                                                Svartype
                                                            </field.Label>
                                                            <field.Select
                                                                options={[
                                                                    ...QUESTION_TYPES,
                                                                ]}
                                                            />
                                                            <field.Error />
                                                        </field.Field>
                                                    )}
                                                </form.AppField>

                                                <form.AppField
                                                    name={`questions[${index}].required`}
                                                >
                                                    {(field) => (
                                                        <field.Field orientation="horizontal">
                                                            <field.Label>
                                                                Må besvares
                                                            </field.Label>
                                                            <field.Switch />
                                                        </field.Field>
                                                    )}
                                                </form.AppField>

                                                {/* Svartypen leses via Subscribe,
                                                    ikke fra spørsmålsobjektet:
                                                    array-feltet rendrer ikke på
                                                    nytt når et underfelt endres,
                                                    så alternativene ville aldri
                                                    dukket opp. */}
                                                <form.Subscribe
                                                    selector={(state) =>
                                                        state.values.questions[
                                                            index
                                                        ]?.type
                                                    }
                                                >
                                                    {(type) =>
                                                        type ===
                                                        "text_answer" ? null : (
                                                            <form.Field
                                                                name={`questions[${index}].options`}
                                                                mode="array"
                                                            >
                                                                {(options) => (
                                                                    <div className="flex flex-col gap-2">
                                                                        {options.state.value.map(
                                                                            (
                                                                                option,
                                                                                optionIndex,
                                                                            ) => (
                                                                                <div
                                                                                    key={
                                                                                        option.key
                                                                                    }
                                                                                    className="flex items-end gap-2"
                                                                                >
                                                                                    <form.AppField
                                                                                        name={`questions[${index}].options[${optionIndex}].title`}
                                                                                    >
                                                                                        {(
                                                                                            field,
                                                                                        ) => (
                                                                                            <field.Field
                                                                                                required
                                                                                                className="flex-1"
                                                                                            >
                                                                                                <field.Label>
                                                                                                    Alternativ{" "}
                                                                                                    {optionIndex +
                                                                                                        1}
                                                                                                </field.Label>
                                                                                                <field.Input placeholder="Skriv her..." />
                                                                                                <field.Error />
                                                                                            </field.Field>
                                                                                        )}
                                                                                    </form.AppField>
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        aria-label={`Fjern alternativ ${optionIndex + 1}`}
                                                                                        onClick={() =>
                                                                                            options.removeValue(
                                                                                                optionIndex,
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        <Trash2 />
                                                                                    </Button>
                                                                                </div>
                                                                            ),
                                                                        )}
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                options.pushValue(
                                                                                    {
                                                                                        key: newKey(),
                                                                                        title: "",
                                                                                    },
                                                                                )
                                                                            }
                                                                        >
                                                                            <Plus />
                                                                            Legg
                                                                            til
                                                                            alternativ
                                                                        </Button>
                                                                        <FieldError
                                                                            errors={
                                                                                options
                                                                                    .state
                                                                                    .meta
                                                                                    .errors
                                                                            }
                                                                        />
                                                                    </div>
                                                                )}
                                                            </form.Field>
                                                        )
                                                    }
                                                </form.Subscribe>

                                                <FieldSeparator />
                                            </div>
                                        ),
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            questions.pushValue(emptyQuestion())
                                        }
                                    >
                                        <Plus />
                                        Legg til spørsmål
                                    </Button>
                                </div>
                            )}
                        </form.Field>

                        <FieldSeparator />

                        <form.AppField name="isOpenForSubmissions">
                            {(field) => (
                                <field.Field orientation="horizontal">
                                    <field.Label>Åpent for svar</field.Label>
                                    <field.Switch />
                                </field.Field>
                            )}
                        </form.AppField>

                        <form.AppField name="canSubmitMultiple">
                            {(field) => (
                                <field.Field orientation="horizontal">
                                    <field.Label>
                                        Kan svare flere ganger
                                    </field.Label>
                                    <field.Switch />
                                </field.Field>
                            )}
                        </form.AppField>

                        <form.AppField name="onlyForGroupMembers">
                            {(field) => (
                                <field.Field orientation="horizontal">
                                    <field.Label>
                                        Kun for gruppens medlemmer
                                    </field.Label>
                                    <field.Switch />
                                </field.Field>
                            )}
                        </form.AppField>

                        <form.AppField name="emailReceiverOnSubmit">
                            {(field) => (
                                <field.Field>
                                    <field.Label>
                                        Varsle denne e-postadressen ved nye svar
                                    </field.Label>
                                    <field.Input
                                        type="email"
                                        placeholder="valgfritt@tihlde.org"
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                    </FieldGroup>
                    {error ? <p role="alert">{error}</p> : null}
                </form>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Avbryt
                    </Button>
                    <Button
                        type="submit"
                        form="new-group-form"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Spinner />
                                <span>Oppretter...</span>
                            </>
                        ) : (
                            "Opprett spørreskjema"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
