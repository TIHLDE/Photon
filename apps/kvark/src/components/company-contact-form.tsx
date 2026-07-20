import { formHandlers, useAppForm } from "#/hooks/form";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { FieldGroup } from "@tihlde/ui/ui/field";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { z } from "zod";

const schema = z.object({
    company: z.string().min(1, { error: "Feltet er påkrevd" }).max(200),
    contactName: z.string().min(1, { error: "Feltet er påkrevd" }).max(200),
    contactEmail: z.email({ error: "Ugyldig e-post" }),
    eventTypes: z
        .array(z.string())
        .min(1, { error: "Velg minst én type arrangement" }),
    semesters: z.array(z.string()).min(1, { error: "Velg minst ett semester" }),
    comment: z.string().max(5000, { error: "Maks 5000 tegn" }),
});

export type CompanyContactFormValues = z.infer<typeof schema>;

interface Option {
    value: string;
    label: string;
}

interface CompanyContactFormProps {
    eventTypeOptions: Option[];
    semesterOptions: Option[];
    onSubmit: (
        values: CompanyContactFormValues,
        helpers: { reset: () => void },
    ) => void | Promise<void>;
}

export function CompanyContactForm({
    eventTypeOptions,
    semesterOptions,
    onSubmit,
}: CompanyContactFormProps) {
    const form = useAppForm({
        defaultValues: {
            company: "",
            contactName: "",
            contactEmail: "",
            eventTypes: [] as string[],
            semesters: [] as string[],
            comment: "",
        },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            await onSubmit(value, { reset: () => form.reset() });
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl">Meld interesse</CardTitle>
            </CardHeader>
            <CardContent>
                <form {...formHandlers(form)} className="flex flex-col gap-6">
                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                        <form.AppField name="company">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Bedrift</field.Label>
                                    <field.Input placeholder="Skriv her..." />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="contactName">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Kontaktperson</field.Label>
                                    <field.Input
                                        autoComplete="name"
                                        placeholder="Skriv her..."
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="contactEmail">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>E-post</field.Label>
                                    <field.Input
                                        type="email"
                                        autoComplete="email"
                                        placeholder="navn@bedrift.no"
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                    </FieldGroup>

                    <FieldGroup className="grid gap-6 md:grid-cols-2">
                        <form.AppField name="eventTypes">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Arrangementer</field.Label>
                                    <field.CheckboxGroup
                                        options={eventTypeOptions}
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="semesters">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Semester</field.Label>
                                    <field.CheckboxGroup
                                        options={semesterOptions}
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                    </FieldGroup>

                    <form.AppField name="comment">
                        {(field) => (
                            <field.Field>
                                <field.Label>Kommentar</field.Label>
                                <field.Textarea
                                    rows={6}
                                    placeholder="Fortell oss hva dere ønsker..."
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>

                    <form.AppForm>
                        <form.SubmitButton
                            size="lg"
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
                </form>
            </CardContent>
        </Card>
    );
}
