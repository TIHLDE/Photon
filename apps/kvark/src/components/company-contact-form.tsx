import {
    CLASS_LEVELS,
    COMPANY_EVENT_TYPES,
    COMPANY_EXTRAS,
    COMPANY_THEMES,
    COMPANY_TYPES,
    PARTICIPANT_RANGES,
} from "#/data/company";
import { formHandlers, useAppForm } from "#/hooks/form";
import type { CompanyContact } from "@tihlde/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { FieldGroup } from "@tihlde/ui/ui/field";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { z } from "zod";

const required = { error: "Feltet er påkrevd" };

const schema = z.object({
    company: z.string().min(1, required).max(200),
    contactName: z.string().min(1, required).max(200),
    contactEmail: z.email({ error: "Ugyldig e-post" }),
    phone: z.string().max(30, { error: "Maks 30 tegn" }),
    companyType: z.string().min(1, { error: "Velg en bedriftstype" }),
    hasTrondheimOffice: z.boolean(),
    themes: z.array(z.string()),
    about: z.string().min(1, required).max(5000, { error: "Maks 5000 tegn" }),
    classLevels: z.array(z.string()),
    semesters: z.array(z.string()).min(1, { error: "Velg minst ett semester" }),
    participants: z.string(),
    eventTypes: z
        .array(z.string())
        .min(1, { error: "Velg minst én type arrangement" }),
    extras: z.array(z.string()),
    comment: z.string().max(5000, { error: "Maks 5000 tegn" }),
});

const toOptions = (values: readonly string[]) =>
    values.map((value) => ({ value, label: value }));

interface Option {
    value: string;
    label: string;
}

interface CompanyContactFormProps {
    semesterOptions: Option[];
    onSubmit: (
        values: CompanyContact,
        helpers: { reset: () => void },
    ) => void | Promise<void>;
}

export function CompanyContactForm({
    semesterOptions,
    onSubmit,
}: CompanyContactFormProps) {
    const form = useAppForm({
        defaultValues: {
            company: "",
            contactName: "",
            contactEmail: "",
            phone: "",
            companyType: "",
            hasTrondheimOffice: false,
            themes: [] as string[],
            about: "",
            classLevels: [] as string[],
            semesters: [] as string[],
            participants: "",
            eventTypes: [] as string[],
            extras: [] as string[],
            comment: "",
        },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            await onSubmit(value, { reset: () => form.reset() });
        },
    });

    return (
        <form {...formHandlers(form)} className="flex flex-col gap-6">
            <Section title="Kontakt">
                <FieldGroup className="grid gap-6 md:grid-cols-2">
                    <form.AppField name="company">
                        {(field) => (
                            <field.Field required>
                                <field.Label>Navn på bedrift</field.Label>
                                <field.Input
                                    variant="contrast"
                                    placeholder="Bedrift AS"
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>
                    <form.AppField name="contactName">
                        {(field) => (
                            <field.Field required>
                                <field.Label>Kontaktperson</field.Label>
                                <field.Input
                                    variant="contrast"
                                    autoComplete="name"
                                    placeholder="Kari Nordmann"
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
                                    variant="contrast"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="kari@bedrift.no"
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>
                    <form.AppField name="phone">
                        {(field) => (
                            <field.Field>
                                <field.Label>Telefonnummer</field.Label>
                                <field.Input
                                    variant="contrast"
                                    type="tel"
                                    autoComplete="tel"
                                    placeholder="+47 900 00 000"
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>
                </FieldGroup>
            </Section>

            <Section title="Om bedriften">
                <FieldGroup className="gap-8">
                    <form.AppField name="companyType">
                        {(field) => (
                            <field.Field required>
                                <field.Label>Bedriftstype</field.Label>
                                <field.ToggleGroup
                                    options={toOptions(COMPANY_TYPES)}
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>
                    <form.AppField name="hasTrondheimOffice">
                        {(field) => (
                            <field.SwitchCard title="Har dere kontorer i Trondheim egnet for besøk?" />
                        )}
                    </form.AppField>
                    <form.AppField name="themes">
                        {(field) => (
                            <field.Field>
                                <field.Label>
                                    Temaer som er relevante for dere
                                </field.Label>
                                <field.Description>
                                    Velg det dere kan tenke dere å holde kurs om
                                    eller ta opp i presentasjonen.
                                    (Uforpliktende)
                                </field.Description>
                                <field.ToggleGroup
                                    multiple
                                    options={toOptions(COMPANY_THEMES)}
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>
                    <form.AppField name="about">
                        {(field) => (
                            <field.Field required>
                                <field.Label>
                                    Om bedriften og hva dere jobber med
                                </field.Label>
                                <field.Textarea
                                    variant="contrast"
                                    rows={5}
                                    className="min-h-32"
                                    placeholder="Skriv litt om bedriften..."
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>
                </FieldGroup>
            </Section>

            <Section title="Ønsker">
                <FieldGroup className="gap-8">
                    <div className="grid gap-8 md:grid-cols-2">
                        <form.AppField name="classLevels">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Klassetrinn</field.Label>
                                    <field.ToggleGroup
                                        multiple
                                        options={toOptions(CLASS_LEVELS)}
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="semesters">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Semester</field.Label>
                                    <field.ToggleGroup
                                        multiple
                                        options={semesterOptions}
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                    </div>
                    <form.AppField name="participants">
                        {(field) => (
                            <field.Field>
                                <field.Label>Antall deltagere</field.Label>
                                <field.ToggleGroup
                                    options={toOptions(PARTICIPANT_RANGES)}
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>
                    <form.AppField name="eventTypes">
                        {(field) => (
                            <field.Field required>
                                <field.Label>Arrangementer</field.Label>
                                <field.CheckboxCards
                                    options={toOptions(COMPANY_EVENT_TYPES)}
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>
                    <form.AppField name="extras">
                        {(field) => (
                            <field.Field>
                                <field.Label>Samarbeid og annet</field.Label>
                                <field.CheckboxCards
                                    options={toOptions(COMPANY_EXTRAS)}
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>
                    <form.AppField name="comment">
                        {(field) => (
                            <field.Field>
                                <field.Label>Kommentar</field.Label>
                                <field.Textarea
                                    variant="contrast"
                                    rows={5}
                                    className="min-h-32"
                                    placeholder="Fortell oss mer om hva dere ønsker..."
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>
                </FieldGroup>
            </Section>

            <Section title="Send inn">
                <div className="flex flex-col items-start gap-6">
                    <p className="text-muted-foreground">
                        Vi setter sammen et variert program som representerer
                        ulike bransjer, teknologier og typer arrangementer.
                        Kreativitet, nytenking og interaktivitet teller når vi
                        velger bedrifter.
                    </p>
                    <form.AppForm>
                        <form.SubmitButton
                            variant="contrast"
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
                </div>
            </Section>
        </form>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle textSize="xl">{title}</CardTitle>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}
