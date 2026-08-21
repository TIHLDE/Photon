import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { FieldGroup } from "@tihlde/ui/ui/field";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { z } from "zod";
import type { ApplicationOptions } from "#/api/queries/applications";
import { formHandlers, useAppForm } from "#/hooks/form";
import { usePrefillContact } from "./shared";
import type { DefaultContact, GroupOption, SubmitHelpers } from "./shared";

const schema = z.object({
    contactName: z.string().min(1, { error: "Feltet er påkrevd" }).max(200),
    contactEmail: z.email({ error: "Ugyldig e-post" }),
    group: z.custom<GroupOption>(
        (value) => value !== null && value !== undefined,
        { error: "Velg en gruppe" },
    ),
    purpose: z.string().min(1, { error: "Feltet er påkrevd" }).max(2000),
    eventDescription: z
        .string()
        .min(1, { error: "Feltet er påkrevd" })
        .max(5000),
    justification: z.string().min(1, { error: "Feltet er påkrevd" }).max(5000),
    totalAmountNok: z
        .number({ error: "Feltet er påkrevd" })
        .int({ error: "Beløpet må være et helt antall kroner" })
        .positive({ error: "Beløpet må være større enn 0" }),
    budgetLink: z.union([z.literal(""), z.url({ error: "Ugyldig lenke" })]),
    summary: z.string().max(5000),
    budgetImages: z.array(
        z.instanceof(File, { error: "Ugyldig fil. Last den opp på nytt." }),
    ),
});

export type SupportFormValues = z.infer<typeof schema>;

/**
 * Søknad om støtte.
 *
 * The same form serves both the general and the idrettslag variant — in the
 * old portal these were two near-identical files that differed only in the
 * heading and the endpoint.
 */
type SupportFormProps = {
    variant: "general" | "sports";
    options: ApplicationOptions;
    defaultContact: DefaultContact;
    onSubmit: (
        values: SupportFormValues,
        helpers: SubmitHelpers,
    ) => void | Promise<void>;
};

const copy = {
    general: {
        title: "Søknad om støtte",
        description:
            "Søk Hovedstyret om økonomisk støtte til et arrangement eller innkjøp.",
        submitLabel: "Send inn søknad",
    },
    sports: {
        title: "Støtte til idrettslag",
        description:
            "Søk IdKom om økonomisk støtte til et idrettslag eller en interessegruppe.",
        submitLabel: "Send inn søknad",
    },
} as const;

export function SupportForm({
    variant,
    options,
    defaultContact,
    onSubmit,
}: SupportFormProps) {
    const text = copy[variant];

    const form = useAppForm({
        defaultValues: {
            contactName: defaultContact.name,
            contactEmail: defaultContact.email,
            group: null as unknown as GroupOption,
            purpose: "",
            eventDescription: "",
            justification: "",
            totalAmountNok: null as unknown as number,
            budgetLink: "",
            summary: "",
            budgetImages: [] as File[],
        },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            await onSubmit(value as SupportFormValues, {
                reset: () => form.reset(),
            });
        },
    });

    usePrefillContact(form, defaultContact);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl">{text.title}</CardTitle>
                <CardDescription>{text.description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form {...formHandlers(form)} className="flex flex-col gap-6">
                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                        <form.AppField name="contactName">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Navn</field.Label>
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
                        <form.AppField name="group">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Gruppe</field.Label>
                                    <field.Combobox
                                        items={options.groups}
                                        placeholder="Søk etter gruppe..."
                                        getLabel={(group) => group.name}
                                        getKey={(group) => group.slug}
                                        isEqual={(a, b) => a.slug === b.slug}
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="totalAmountNok">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>
                                        Totalt søknadsbeløp (NOK)
                                    </field.Label>
                                    <field.Number min={1} placeholder="0" />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                    </FieldGroup>

                    <form.AppField name="purpose">
                        {(field) => (
                            <field.Field required>
                                <field.Label>Formål med søknad</field.Label>
                                <field.Textarea
                                    rows={3}
                                    placeholder="Hva søker dere om?"
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>

                    <form.AppField name="eventDescription">
                        {(field) => (
                            <field.Field required>
                                <field.Label>
                                    Beskrivelse av arrangement/produkt
                                </field.Label>
                                <field.Textarea
                                    rows={5}
                                    placeholder="Beskriv arrangementet eller produktet..."
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>

                    <form.AppField name="justification">
                        {(field) => (
                            <field.Field required>
                                <field.Label>
                                    Begrunnelse for støtte
                                </field.Label>
                                <field.Textarea
                                    rows={5}
                                    placeholder="Hvorfor bør søknaden innvilges?"
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>

                    <form.AppField name="budgetLink">
                        {(field) => (
                            <field.Field>
                                <field.Label>Lenke til budsjett</field.Label>
                                <field.Input
                                    type="url"
                                    placeholder="https://..."
                                />
                                <field.Description>Valgfritt</field.Description>
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>

                    <form.AppField name="budgetImages">
                        {(field) => (
                            <field.Field>
                                <field.Label>Budsjett (bilder)</field.Label>
                                <field.ImageDropzone multiple maxFiles={10} />
                                <field.Description>
                                    Valgfritt. Maks 10 filer.
                                </field.Description>
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>

                    <form.AppField name="summary">
                        {(field) => (
                            <field.Field>
                                <field.Label>Oppsummering</field.Label>
                                <field.Textarea
                                    rows={3}
                                    placeholder="Valgfri avsluttende oppsummering..."
                                />
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
                            {text.submitLabel}
                        </form.SubmitButton>
                    </form.AppForm>
                </form>
            </CardContent>
        </Card>
    );
}
