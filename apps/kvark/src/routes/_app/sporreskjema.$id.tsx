import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { FieldGroup } from "@tihlde/ui/ui/field";
import { Separator } from "@tihlde/ui/ui/separator";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { ArrowLeft, CheckCircle2, TriangleAlert } from "lucide-react";
import type { FormDetail } from "@tihlde/sdk";
import { z } from "zod";

import { authClientWithRedirect } from "#/api/auth";
import {
    createSubmissionMutation,
    getFormByIdQuery,
} from "#/api/queries/forms";
import { formHandlers, useAppForm } from "#/hooks/form";
import { useGoBack } from "#/hooks/use-go-back";
import { formatEventDate } from "#/lib/event";

export const Route = createFileRoute("/_app/sporreskjema/$id")({
    component: FormPage,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getFormByIdQuery(params.id)),
});

type FormField = FormDetail["fields"][number];

const requiredText = z.string().min(1, { error: "Feltet er påkrevd" });
const requiredChoice = z.string().min(1, { error: "Velg ett alternativ" });
const requiredChoices = z
    .array(z.string())
    .min(1, { error: "Velg minst ett alternativ" });

function byType(fields: FormField[], type: FormField["type"]) {
    return fields.filter((field) => field.type === type);
}

function FormPage() {
    const { id } = Route.useParams();
    const { data: form } = useSuspenseQuery(getFormByIdQuery(id));
    const goBack = useGoBack();

    return (
        <div className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
            <Button variant="outline" className="self-start" onClick={goBack}>
                <ArrowLeft />
                Tilbake
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">
                        {form.resource_type === "EventForm" &&
                        form.type === "evaluation"
                            ? "Evaluering"
                            : form.title}
                    </CardTitle>
                    <CardDescription>
                        <FormSubtitle form={form} />
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {form.description ? <p>{form.description}</p> : null}
                    <Separator />
                    <FormBody form={form} />
                </CardContent>
            </Card>
        </div>
    );
}

function FormSubtitle({ form }: { form: FormDetail }) {
    if (form.resource_type === "EventForm" && form.event) {
        return (
            <>
                Arrangøren av{" "}
                <Link
                    to="/arrangementer/$slug"
                    params={{ slug: form.event.slug ?? form.event.id }}
                >
                    «{form.event.title}»
                </Link>
                {form.event.location
                    ? `, som ble holdt ${formatEventDate(form.event.start_date)} på ${form.event.location}, `
                    : `, som ble holdt ${formatEventDate(form.event.start_date)}, `}
                ønsker at du svarer på følgende spørsmål:
            </>
        );
    }

    if (form.resource_type === "GroupForm" && form.group) {
        return <>Spørreskjema fra {form.group.name}</>;
    }

    return null;
}

/**
 * Decides whether the viewer may answer at all, and renders either the answer
 * form or the reason they cannot.
 */
function FormBody({ form }: { form: FormDetail }) {
    // Event surveys are answered as part of the registration flow on the event
    // page — only evaluations are filled in here.
    if (form.resource_type === "EventForm" && form.type !== "evaluation") {
        return (
            <Alert>
                <TriangleAlert />
                <AlertTitle>
                    Dette skjemaet svarer du på ved påmelding
                </AlertTitle>
                <AlertDescription>
                    Gå til arrangementet for å melde deg på og svare på
                    spørsmålene.
                </AlertDescription>
            </Alert>
        );
    }

    if (form.resource_type === "GroupForm" && !form.is_open_for_submissions) {
        return (
            <Alert>
                <TriangleAlert />
                <AlertTitle>Skjemaet er stengt</AlertTitle>
                <AlertDescription>
                    Spørreskjemaet er ikke åpent for innsending av svar akkurat
                    nå.
                </AlertDescription>
            </Alert>
        );
    }

    const canAnswerAgain =
        form.resource_type === "GroupForm" && Boolean(form.can_submit_multiple);

    if (form.viewer_has_answered && !canAnswerAgain) {
        return <AlreadyAnswered />;
    }

    return <AnswerForm form={form} />;
}

function AlreadyAnswered() {
    return (
        <div className="flex flex-col gap-4">
            <Alert>
                <CheckCircle2 />
                <AlertTitle>Du har allerede svart på dette skjemaet</AlertTitle>
                <AlertDescription>Takk for svaret ditt!</AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                    variant="outline"
                    className="w-full"
                    nativeButton={false}
                    render={<Link to="/" />}
                >
                    Gå til forsiden
                </Button>
                <Button
                    variant="outline"
                    className="w-full"
                    nativeButton={false}
                    render={<Link to="/profil/$id" params={{ id: "me" }} />}
                >
                    Gå til profilen din
                </Button>
            </div>
        </div>
    );
}

function AnswerForm({ form }: { form: FormDetail }) {
    const submit = useMutation(createSubmissionMutation);

    const textFields = byType(form.fields, "text_answer");
    const singleFields = byType(form.fields, "single_select");
    const multiFields = byType(form.fields, "multiple_select");

    // Answers are keyed by field id and split by shape, so every field name
    // stays a single, well-typed value instead of a union.
    const answerForm = useAppForm({
        defaultValues: {
            texts: Object.fromEntries(
                textFields.map((field) => [field.id, ""]),
            ) as Record<string, string>,
            choices: Object.fromEntries(
                singleFields.map((field) => [field.id, ""]),
            ) as Record<string, string>,
            selections: Object.fromEntries(
                multiFields.map((field) => [field.id, [] as string[]]),
            ) as Record<string, string[]>,
        },
        async onSubmit({ value }) {
            // Unanswered optional fields are left out entirely — the API
            // requires each answer to carry either text or selected options.
            const answers = [
                ...textFields
                    .filter((field) => value.texts[field.id]?.trim())
                    .map((field) => ({
                        field: { id: field.id },
                        answer_text: value.texts[field.id] as string,
                    })),
                ...singleFields
                    .filter((field) => value.choices[field.id])
                    .map((field) => ({
                        field: { id: field.id },
                        selected_options: [
                            { id: value.choices[field.id] as string },
                        ],
                    })),
                ...multiFields
                    .filter((field) => value.selections[field.id]?.length)
                    .map((field) => ({
                        field: { id: field.id },
                        selected_options: (
                            value.selections[field.id] as string[]
                        ).map((optionId) => ({ id: optionId })),
                    })),
            ];

            try {
                await submit.mutateAsync({
                    formId: form.id,
                    data: { answers },
                });
            } catch {
                // Surfaced through `submit.isError` below
            }
        },
    });

    if (submit.isSuccess) {
        return (
            <Alert>
                <CheckCircle2 />
                <AlertTitle>Svaret ditt er sendt inn</AlertTitle>
                <AlertDescription>Takk for at du svarte!</AlertDescription>
            </Alert>
        );
    }

    return (
        <form {...formHandlers(answerForm)} className="flex flex-col gap-6">
            {submit.isError && (
                <Alert variant="destructive">
                    <TriangleAlert />
                    <AlertTitle>Klarte ikke å sende inn svaret</AlertTitle>
                    <AlertDescription>
                        Prøv igjen om litt. Har du allerede svart, kan det hende
                        skjemaet bare tar imot ett svar.
                    </AlertDescription>
                </Alert>
            )}

            <FieldGroup className="flex flex-col gap-6">
                {form.fields.map((field) => {
                    if (field.type === "text_answer") {
                        return (
                            <answerForm.AppField
                                key={field.id}
                                name={`texts.${field.id}`}
                                validators={
                                    field.required
                                        ? { onDynamic: requiredText }
                                        : undefined
                                }
                            >
                                {(f) => (
                                    <f.Field required={field.required}>
                                        <f.Label>{field.title}</f.Label>
                                        <f.Textarea
                                            rows={3}
                                            placeholder="Skriv svaret ditt her..."
                                        />
                                        <f.Error />
                                    </f.Field>
                                )}
                            </answerForm.AppField>
                        );
                    }

                    const options = field.options.map((option) => ({
                        value: option.id,
                        label: option.title,
                    }));

                    if (field.type === "single_select") {
                        return (
                            <answerForm.AppField
                                key={field.id}
                                name={`choices.${field.id}`}
                                validators={
                                    field.required
                                        ? { onDynamic: requiredChoice }
                                        : undefined
                                }
                            >
                                {(f) => (
                                    <f.Field required={field.required}>
                                        <f.Label>{field.title}</f.Label>
                                        <f.RadioGroup options={options} />
                                        <f.Error />
                                    </f.Field>
                                )}
                            </answerForm.AppField>
                        );
                    }

                    return (
                        <answerForm.AppField
                            key={field.id}
                            name={`selections.${field.id}`}
                            validators={
                                field.required
                                    ? { onDynamic: requiredChoices }
                                    : undefined
                            }
                        >
                            {(f) => (
                                <f.Field required={field.required}>
                                    <f.Label>{field.title}</f.Label>
                                    <f.CheckboxGroup options={options} />
                                    <f.Error />
                                </f.Field>
                            )}
                        </answerForm.AppField>
                    );
                })}
            </FieldGroup>

            <answerForm.AppForm>
                <answerForm.SubmitButton
                    className="w-full"
                    loading={
                        <>
                            <Spinner />
                            <span>Sender inn...</span>
                        </>
                    }
                >
                    Send inn
                </answerForm.SubmitButton>
            </answerForm.AppForm>
        </form>
    );
}
