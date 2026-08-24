import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import {
    FieldContent,
    FieldGroup,
    FieldLegend,
    FieldSet,
} from "@tihlde/ui/ui/field";
import { Separator } from "@tihlde/ui/ui/separator";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { LockIcon, PlusIcon, TrashIcon, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { ConfirmDeleteDialog } from "#/components/confirm-delete-dialog";
import { formHandlers, useAppForm } from "#/hooks/form";
import type { FormQuestionType, FormQuestionValues } from "#/lib/form";
import type { Form } from "#/lib/group";

export type GroupFormEditValues = {
    title: string;
    description: string;
    isOpen: boolean;
    /** Null betyr «åpner med en gang». */
    opensAt: Date | null;
    /** Null betyr «ingen svarfrist». */
    closesAt: Date | null;
    canSubmitMultiple: boolean;
    onlyForMembers: boolean;
    /** Tom streng betyr «ingen varsling». */
    emailReceiver: string;
    questions: FormQuestionValues[];
};

const QUESTION_TYPES: { value: FormQuestionType; label: string }[] = [
    { value: "text_answer", label: "Fritekst" },
    { value: "single_select", label: "Ett alternativ" },
    { value: "multiple_select", label: "Flere alternativer" },
];

const questionSchema = z
    .object({
        id: z.string().optional(),
        title: z.string().min(1, { error: "Spørsmålet må ha en tekst" }),
        type: z.enum(["text_answer", "single_select", "multiple_select"]),
        required: z.boolean(),
        options: z.array(
            z.object({
                id: z.string().optional(),
                title: z
                    .string()
                    .min(1, { error: "Alternativet må ha en tekst" }),
            }),
        ),
    })
    .refine(
        (question) =>
            question.type === "text_answer" || question.options.length > 0,
        { error: "Legg til minst ett alternativ", path: ["options"] },
    );

const schema = z
    .object({
        title: z
            .string()
            .min(1, { error: "Tittel er påkrevd" })
            .max(400, { error: "Maks 400 tegn" }),
        description: z.string(),
        isOpen: z.boolean(),
        opensAt: z.date().nullable(),
        closesAt: z.date().nullable(),
        canSubmitMultiple: z.boolean(),
        onlyForMembers: z.boolean(),
        emailReceiver: z.union([
            z.literal(""),
            z.email({ error: "Ugyldig e-postadresse" }),
        ]),
        questions: z.array(questionSchema),
    })
    // Et skjema som stenger før det åpner ville aldri tatt imot et svar.
    .refine(
        (values) =>
            !values.opensAt ||
            !values.closesAt ||
            values.closesAt.getTime() > values.opensAt.getTime(),
        { error: "Må være etter åpningen", path: ["closesAt"] },
    );

type GroupFormEditDialogProps = {
    open: boolean;
    /** Skjemaet som redigeres. Null når ingen er valgt. */
    form: Form | null;
    /** Spørsmålene slik de er lagret. Null mens de lastes. */
    questions: FormQuestionValues[] | null;
    /** Antall svar. Over 0 låser spørsmålene. */
    answerCount: number;
    onClose: () => void;
    onSubmit: (values: GroupFormEditValues) => void;
    isSubmitting: boolean;
    error: string | null;
    /**
     * Å slette hører til den samme tilgangen som å redigere. Utelatt når den
     * som ser på ikke har den.
     */
    onDelete?: () => void;
    isDeleting?: boolean;
    deleteError?: string | null;
};

export function GroupFormEditDialog({
    open,
    form,
    questions,
    answerCount,
    onClose,
    onSubmit,
    isSubmitting,
    error,
    onDelete,
    isDeleting = false,
    deleteError = null,
}: GroupFormEditDialogProps) {
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) onClose();
            }}
        >
            {/* Bredt: spørsmålstekstene er ofte lange setninger, og på en smal
            dialog ser man bare en flik av det man skriver. */}
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Rediger spørreskjema</DialogTitle>
                    <DialogDescription>
                        Endringene gjelder med én gang du lagrer.
                    </DialogDescription>
                </DialogHeader>
                {form && questions ? (
                    // Nøkkelen remonterer skjemaet når et annet spørreskjema
                    // åpnes: TanStack Form leser defaultValues bare én gang.
                    <EditForm
                        key={form.id}
                        form={form}
                        questions={questions}
                        answerCount={answerCount}
                        onClose={onClose}
                        onSubmit={onSubmit}
                        isSubmitting={isSubmitting}
                        error={error}
                        onRequestDelete={
                            onDelete ? () => setConfirmDelete(true) : undefined
                        }
                        isDeleting={isDeleting}
                        deleteError={deleteError}
                    />
                ) : (
                    <div className="flex flex-col gap-3">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                )}

                {form && onDelete ? (
                    <ConfirmDeleteDialog
                        open={confirmDelete}
                        onOpenChange={setConfirmDelete}
                        title={`Slette «${form.title}»?`}
                        description={
                            answerCount > 0
                                ? `Skjemaet og de ${answerCount} svarene som er sendt inn forsvinner for godt.`
                                : "Skjemaet forsvinner for godt, og lenken til det slutter å virke."
                        }
                        confirmLabel="Slett skjema"
                        isPending={isDeleting}
                        onConfirm={() => {
                            setConfirmDelete(false);
                            onDelete();
                        }}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

type EditFormProps = {
    form: Form;
    questions: FormQuestionValues[];
    answerCount: number;
    onClose: () => void;
    onSubmit: (values: GroupFormEditValues) => void;
    isSubmitting: boolean;
    error: string | null;
    onRequestDelete?: () => void;
    isDeleting: boolean;
    deleteError: string | null;
};

/**
 * Skjemaet er skilt ut i en egen hook slik at delkomponentene under kan navngi
 * typen sin med `ReturnType` i stedet for å gjenta generikken til TanStack Form.
 */
function useEditForm({
    form,
    questions,
    onSubmit,
}: Pick<EditFormProps, "form" | "questions" | "onSubmit">) {
    return useAppForm({
        defaultValues: {
            title: form.title,
            description: form.description,
            isOpen: form.isOpen,
            opensAt: form.opensAt ? new Date(form.opensAt) : null,
            closesAt: form.closesAt ? new Date(form.closesAt) : null,
            canSubmitMultiple: form.canSubmitMultiple,
            onlyForMembers: form.onlyForMembers,
            emailReceiver: form.emailReceiver,
            questions,
        },
        validators: { onDynamic: schema },
        onSubmit({ value }) {
            onSubmit({
                title: value.title.trim(),
                description: value.description,
                isOpen: value.isOpen,
                opensAt: value.opensAt,
                closesAt: value.closesAt,
                canSubmitMultiple: value.canSubmitMultiple,
                onlyForMembers: value.onlyForMembers,
                emailReceiver: value.emailReceiver.trim(),
                questions: value.questions,
            });
        },
    });
}

type EditFormApi = ReturnType<typeof useEditForm>;

function EditForm({
    form,
    questions,
    answerCount,
    onClose,
    onSubmit,
    isSubmitting,
    error,
    onRequestDelete,
    isDeleting,
    deleteError,
}: EditFormProps) {
    const editForm = useEditForm({ form, questions, onSubmit });

    return (
        // DialogBody låser tittel og knapperad mens spørsmålene scroller. Uten
        // den scroller hele dialogen, og med et opptaksskjema på ti spørsmål
        // er «Lagre» langt under skjermkanten. Knapperaden står utenfor
        // <form>: SubmitButton kaller handleSubmit selv når den ikke hører til
        // et form-element.
        <>
            <DialogBody>
                <form
                    {...formHandlers(editForm)}
                    className="flex flex-col gap-6"
                >
                    {error ? (
                        <Alert variant="destructive">
                            <TriangleAlert />
                            <AlertTitle>
                                Klarte ikke å lagre skjemaet
                            </AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : null}

                    {deleteError ? (
                        <Alert variant="destructive">
                            <TriangleAlert />
                            <AlertTitle>
                                Klarte ikke å slette skjemaet
                            </AlertTitle>
                            <AlertDescription>{deleteError}</AlertDescription>
                        </Alert>
                    ) : null}

                    <FieldGroup>
                        <editForm.AppField name="title">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Tittel</field.Label>
                                    <field.Input placeholder="Skriv her..." />
                                    <field.Error />
                                </field.Field>
                            )}
                        </editForm.AppField>
                        <editForm.AppField name="description">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Beskrivelse</field.Label>
                                    <field.Markdown placeholder="Skriv her..." />
                                    <field.Description>
                                        Vises over spørsmålene
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </editForm.AppField>
                        {/* Stenger man skjemaet, følger begge tidspunktene med:
                    ellers ville skjemaet man nettopp stengte åpnet seg selv
                    igjen, eller stengt seg selv på nytt senere. */}
                        <editForm.AppField
                            name="isOpen"
                            listeners={{
                                onChange: ({ value }) => {
                                    if (!value) {
                                        editForm.setFieldValue("opensAt", null);
                                        editForm.setFieldValue(
                                            "closesAt",
                                            null,
                                        );
                                    }
                                },
                            }}
                        >
                            {(field) => (
                                <field.Field orientation="horizontal">
                                    <FieldContent>
                                        <field.Label>
                                            Åpent for svar
                                        </field.Label>
                                        <field.Description>
                                            Skjemaet kan bare svares på og deles
                                            når det er åpent
                                        </field.Description>
                                    </FieldContent>
                                    <field.Switch />
                                </field.Field>
                            )}
                        </editForm.AppField>
                        {/* Og setter man et tidspunkt, er det fordi skjemaet skal åpne
                    da — bryteren følger etter. */}
                        <editForm.AppField
                            name="opensAt"
                            listeners={{
                                onChange: ({ value }) => {
                                    if (value)
                                        editForm.setFieldValue("isOpen", true);
                                },
                            }}
                        >
                            {(field) => (
                                <field.Field>
                                    <field.Label>Åpner</field.Label>
                                    <field.DateTimePicker />
                                    <field.Description>
                                        Valgfritt. Med et tidspunkt er skjemaet
                                        stengt til da, og åpner seg selv når
                                        tiden kommer.
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </editForm.AppField>
                        {/* Og en frist betyr at skjemaet skal ta imot svar til da
                    — også den slår på bryteren. */}
                        <editForm.AppField
                            name="closesAt"
                            listeners={{
                                onChange: ({ value }) => {
                                    if (value)
                                        editForm.setFieldValue("isOpen", true);
                                },
                            }}
                        >
                            {(field) => (
                                <field.Field>
                                    <field.Label>Stenger</field.Label>
                                    <field.DateTimePicker />
                                    <field.Description>
                                        Valgfritt. Med et tidspunkt slutter
                                        skjemaet å ta imot svar når fristen går
                                        ut.
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </editForm.AppField>
                        <editForm.AppField name="canSubmitMultiple">
                            {(field) => (
                                <field.Field orientation="horizontal">
                                    <FieldContent>
                                        <field.Label>
                                            Tillat flere svar fra samme person
                                        </field.Label>
                                    </FieldContent>
                                    <field.Switch />
                                </field.Field>
                            )}
                        </editForm.AppField>
                        <editForm.AppField name="onlyForMembers">
                            {(field) => (
                                <field.Field orientation="horizontal">
                                    <FieldContent>
                                        <field.Label>
                                            Bare for medlemmer av gruppen
                                        </field.Label>
                                    </FieldContent>
                                    <field.Switch />
                                </field.Field>
                            )}
                        </editForm.AppField>
                        <editForm.AppField name="emailReceiver">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Varsle på e-post</field.Label>
                                    <field.Input
                                        type="email"
                                        placeholder="navn@tihlde.org"
                                    />
                                    <field.Description>
                                        Får en e-post for hvert svar. La stå tom
                                        for ingen varsling.
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </editForm.AppField>
                    </FieldGroup>

                    <Separator />

                    {answerCount > 0 ? (
                        <Alert>
                            <LockIcon />
                            <AlertTitle>
                                Skjemaet har {answerCount}{" "}
                                {answerCount === 1 ? "svar" : "svar"}
                            </AlertTitle>
                            <AlertDescription>
                                Du kan endre tekst, rekkefølge og «påkrevd», og
                                legge til nye spørsmål og alternativer.
                                Spørsmålene som allerede er besvart kan ikke
                                fjernes eller bytte type — da ville svarene på
                                dem forsvunnet.
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <QuestionsEditor
                        editForm={editForm}
                        hasAnswers={answerCount > 0}
                    />
                </form>
            </DialogBody>

            <DialogFooter>
                {onRequestDelete ? (
                    <Button
                        type="button"
                        variant="destructive"
                        className="sm:mr-auto"
                        disabled={isSubmitting || isDeleting}
                        onClick={onRequestDelete}
                    >
                        <TrashIcon />
                        Slett skjema
                    </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={onClose}>
                    Avbryt
                </Button>
                <editForm.AppForm>
                    <editForm.SubmitButton
                        disabled={isSubmitting || isDeleting}
                        loading={
                            <>
                                <Spinner />
                                <span>Lagrer...</span>
                            </>
                        }
                    >
                        Lagre
                    </editForm.SubmitButton>
                </editForm.AppForm>
            </DialogFooter>
        </>
    );
}

/**
 * Spørsmålene redigeres som en liste: rekkefølgen i listen blir rekkefølgen i
 * skjemaet, og `order` settes av den som lagrer.
 *
 * `hasAnswers` sperrer det som ville tatt svar med seg. Sperringen gjelder alt
 * som er lagret fra før, mens spørsmål og alternativer man legger til i denne
 * runden kan fjernes igjen — ingen har rukket å svare på dem. API-et er
 * finere kornet og slipper gjennom et lagret spørsmål ingen har svart på, men
 * dialogen vet ikke hvilke det er, og velger heller å ikke friste med en
 * knapp som kan gi 409.
 */
function QuestionsEditor({
    editForm,
    hasAnswers,
}: {
    editForm: EditFormApi;
    hasAnswers: boolean;
}) {
    return (
        <editForm.Field name="questions" mode="array">
            {(questionList) => (
                <FieldSet>
                    <div className="flex items-center justify-between gap-2">
                        <FieldLegend variant="label" className="mb-0">
                            Spørsmål
                        </FieldLegend>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                questionList.pushValue({
                                    title: "",
                                    type: "text_answer",
                                    required: false,
                                    options: [],
                                })
                            }
                        >
                            <PlusIcon />
                            Nytt spørsmål
                        </Button>
                    </div>

                    {questionList.state.value.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Skjemaet har ingen spørsmål ennå.
                        </p>
                    ) : null}

                    {questionList.state.value.map((question, index) => (
                        <QuestionRow
                            // Indeksen er nøkkelen: et nytt spørsmål har ingen
                            // stabil id før det er lagret.
                            key={index}
                            editForm={editForm}
                            index={index}
                            locked={hasAnswers && question.id !== undefined}
                            onRemove={() => questionList.removeValue(index)}
                        />
                    ))}
                </FieldSet>
            )}
        </editForm.Field>
    );
}

function QuestionRow({
    editForm,
    index,
    locked,
    onRemove,
}: {
    editForm: EditFormApi;
    index: number;
    /** Spørsmålet er besvart: det kan endres, men ikke fjernes eller byttes. */
    locked: boolean;
    onRemove: () => void;
}) {
    return (
        <Card>
            <CardContent className="flex flex-col gap-4">
                <div className="flex items-start gap-2">
                    <editForm.AppField name={`questions[${index}].title`}>
                        {(field) => (
                            <field.Field required className="flex-1">
                                <field.Label>Spørsmål {index + 1}</field.Label>
                                <field.Input placeholder="Skriv her..." />
                                <field.Error />
                            </field.Field>
                        )}
                    </editForm.AppField>
                    {locked ? null : (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Slett spørsmål ${index + 1}`}
                            className="mt-6"
                            onClick={onRemove}
                        >
                            <TrashIcon />
                        </Button>
                    )}
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <editForm.AppField name={`questions[${index}].type`}>
                        {(field) => (
                            <field.Field className="flex-1">
                                <field.Label>Type</field.Label>
                                <field.Select
                                    options={QUESTION_TYPES}
                                    disabled={locked}
                                />
                                {locked ? (
                                    <field.Description>
                                        Låst fordi spørsmålet er besvart
                                    </field.Description>
                                ) : null}
                                <field.Error />
                            </field.Field>
                        )}
                    </editForm.AppField>
                    <editForm.AppField name={`questions[${index}].required`}>
                        {(field) => (
                            <field.Field orientation="horizontal">
                                <FieldContent>
                                    <field.Label>Påkrevd</field.Label>
                                </FieldContent>
                                <field.Switch />
                            </field.Field>
                        )}
                    </editForm.AppField>
                </div>

                <editForm.Subscribe
                    selector={(state) => state.values.questions[index]?.type}
                >
                    {(type) =>
                        type === "text_answer" || type === undefined ? null : (
                            <OptionsEditor
                                editForm={editForm}
                                index={index}
                                lockSaved={locked}
                            />
                        )
                    }
                </editForm.Subscribe>
            </CardContent>
        </Card>
    );
}

function OptionsEditor({
    editForm,
    index,
    lockSaved,
}: {
    editForm: EditFormApi;
    index: number;
    /** Alternativer som allerede er lagret kan ikke fjernes; nye kan. */
    lockSaved: boolean;
}) {
    return (
        <editForm.Field name={`questions[${index}].options`} mode="array">
            {(optionList) => (
                <div className="flex flex-col gap-2">
                    {optionList.state.value.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-end gap-2">
                            <editForm.AppField
                                name={`questions[${index}].options[${optionIndex}].title`}
                            >
                                {(field) => (
                                    <field.Field className="flex-1">
                                        <field.Label>
                                            Alternativ {optionIndex + 1}
                                        </field.Label>
                                        <field.Input placeholder="Skriv her..." />
                                        <field.Error />
                                    </field.Field>
                                )}
                            </editForm.AppField>
                            {lockSaved && option.id !== undefined ? null : (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Slett alternativ ${optionIndex + 1}`}
                                    onClick={() =>
                                        optionList.removeValue(optionIndex)
                                    }
                                >
                                    <TrashIcon />
                                </Button>
                            )}
                        </div>
                    ))}
                    {optionList.state.value.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Spørsmålet trenger minst ett alternativ.
                        </p>
                    ) : null}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={() => optionList.pushValue({ title: "" })}
                    >
                        <PlusIcon />
                        Nytt alternativ
                    </Button>
                </div>
            )}
        </editForm.Field>
    );
}
