import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { FieldGroup } from "@tihlde/ui/ui/field";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { useStore } from "@tanstack/react-form";
import { z } from "zod";
import type { ApplicationOptions } from "#/api/queries/applications";
import { formHandlers, useAppForm } from "#/hooks/form";
import type { DefaultContact, SubmitHelpers } from "./shared";

const schema = z
    .object({
        contactName: z.string().min(1, { error: "Feltet er påkrevd" }).max(200),
        contactEmail: z.email({ error: "Ugyldig e-post" }),
        caseName: z.string().min(1, { error: "Feltet er påkrevd" }).max(300),
        caseType: z.string().min(1, { error: "Velg type sak" }),
        background: z
            .string()
            .min(1, { error: "Feltet er påkrevd" })
            .max(10000),
        assessment: z
            .string()
            .min(1, { error: "Feltet er påkrevd" })
            .max(10000),
        recommendation: z.string().max(10000),
        attachments: z.array(z.instanceof(File)),
    })
    // The old portal marked this required in the UI but left it optional in
    // validation, so a Vedtakssak could be submitted without an innstilling.
    .superRefine((data, ctx) => {
        if (data.caseType === "decision" && !data.recommendation.trim()) {
            ctx.addIssue({
                code: "custom",
                path: ["recommendation"],
                message: "Vedtakssaker må ha en innstilling",
            });
        }
    });

export type HsCaseFormValues = z.infer<typeof schema>;

type HsCaseFormProps = {
    options: ApplicationOptions;
    defaultContact: DefaultContact;
    onSubmit: (
        values: HsCaseFormValues,
        helpers: SubmitHelpers,
    ) => void | Promise<void>;
};

export function HsCaseForm({
    options,
    defaultContact,
    onSubmit,
}: HsCaseFormProps) {
    const form = useAppForm({
        defaultValues: {
            contactName: defaultContact.name,
            contactEmail: defaultContact.email,
            caseName: "",
            caseType: "",
            background: "",
            assessment: "",
            recommendation: "",
            attachments: [] as File[],
        },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            await onSubmit(value as HsCaseFormValues, {
                reset: () => form.reset(),
            });
        },
    });

    const caseType = useStore(form.store, (state) => state.values.caseType);
    const isDecision = caseType === "decision";

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl">Sak til HS</CardTitle>
                <CardDescription>
                    Meld inn en sak til Hovedstyret. Saker må sendes inn senest
                    24 timer før HS-møtet for å bli tatt opp.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form {...formHandlers(form)} className="flex flex-col gap-6">
                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                        <form.AppField name="contactName">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>
                                        Navn på kontaktperson
                                    </field.Label>
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
                                        placeholder="navn@tihlde.org"
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                    </FieldGroup>

                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                        <form.AppField name="caseName">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Navn på saken</field.Label>
                                    <field.Input placeholder="Skriv her..." />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="caseType">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Type sak</field.Label>
                                    <field.Select
                                        options={options.caseTypes}
                                        placeholder="Velg type sak"
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                    </FieldGroup>

                    <form.AppField name="background">
                        {(field) => (
                            <field.Field required>
                                <field.Label>
                                    Kort beskrivelse / bakgrunn for saken
                                </field.Label>
                                <field.Textarea
                                    rows={5}
                                    placeholder="Hva handler saken om?"
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>

                    <form.AppField name="assessment">
                        {(field) => (
                            <field.Field required>
                                <field.Label>
                                    Saksbehandlers vurdering
                                </field.Label>
                                <field.Textarea
                                    rows={5}
                                    placeholder="Din vurdering av saken..."
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>

                    {isDecision && (
                        <form.AppField name="recommendation">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>
                                        Saksbehandlers innstilling
                                    </field.Label>
                                    <field.Textarea
                                        rows={4}
                                        placeholder="Hva innstiller du på?"
                                    />
                                    <field.Description>
                                        Påkrevd for vedtakssaker.
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                    )}

                    <form.AppField name="attachments">
                        {(field) => (
                            <field.Field>
                                <field.Label>Eventuelle vedlegg</field.Label>
                                <field.ImageDropzone multiple maxFiles={10} />
                                <field.Description>
                                    Valgfritt. Maks 10 filer.
                                </field.Description>
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>

                    <form.AppForm>
                        <form.FormErrors />
                        <form.SubmitButton
                            size="lg"
                            loading={
                                <>
                                    <Spinner />
                                    <span>Sender...</span>
                                </>
                            }
                        >
                            Meld inn sak
                        </form.SubmitButton>
                    </form.AppForm>
                </form>
            </CardContent>
        </Card>
    );
}
