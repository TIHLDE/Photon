import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { CardDescription } from "@tihlde/ui/ui/card";
import { FieldGroup } from "@tihlde/ui/ui/field";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { z } from "zod";
import type { ApplicationOptions } from "#/api/queries/applications";
import { formHandlers, useAppForm } from "#/hooks/form";
import type {
    CcOption,
    DefaultContact,
    GroupOption,
    SubmitHelpers,
} from "./shared";

const schema = z.object({
    contactName: z.string().min(1, { error: "Feltet er påkrevd" }).max(200),
    contactEmail: z.email({ error: "Ugyldig e-post" }),
    cc: z.custom<CcOption | null>().nullable(),
    amountNok: z
        .number({ error: "Feltet er påkrevd" })
        .int({ error: "Beløpet må være et helt antall kroner" })
        .positive({ error: "Beløpet må være større enn 0" }),
    date: z.date({ error: "Feltet er påkrevd" }),
    group: z.custom<GroupOption>(
        (value) => value !== null && value !== undefined,
        { error: "Velg en gruppe" },
    ),
    budgetType: z.string().min(1, { error: "Velg budsjetttype" }),
    description: z.string().min(1, { error: "Feltet er påkrevd" }).max(5000),
    accountNumber: z.string().regex(/^\d{4}\.\d{2}\.\d{5}$/, {
        error: "Kontonummer må være i formatet xxxx.xx.xxxxx",
    }),
    receipts: z
        .array(z.instanceof(File))
        .min(1, { error: "Legg ved minst én kvittering" }),
});

export type ExpenseFormValues = z.infer<typeof schema>;

type ExpenseFormProps = {
    options: ApplicationOptions;
    defaultContact: DefaultContact;
    onSubmit: (
        values: ExpenseFormValues,
        helpers: SubmitHelpers,
    ) => void | Promise<void>;
};

export function ExpenseForm({
    options,
    defaultContact,
    onSubmit,
}: ExpenseFormProps) {
    const form = useAppForm({
        defaultValues: {
            contactName: defaultContact.name,
            contactEmail: defaultContact.email,
            cc: null as CcOption | null,
            amountNok: null as unknown as number,
            date: new Date(),
            group: null as unknown as GroupOption,
            budgetType: "",
            description: "",
            accountNumber: "",
            receipts: [] as File[],
        },
        validators: { onDynamic: schema },
        async onSubmit({ value }) {
            await onSubmit(value as ExpenseFormValues, {
                reset: () => form.reset(),
            });
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl">Utlegg</CardTitle>
                <CardDescription>
                    Har du lagt ut for noe på vegne av TIHLDE? Send inn
                    kvitteringen her, så behandler finansministeren den.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form {...formHandlers(form)} className="flex flex-col gap-6">
                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                        <form.AppField name="contactName">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Fullt navn</field.Label>
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
                        <form.AppField name="amountNok">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Sum (NOK)</field.Label>
                                    <field.Number min={1} placeholder="0" />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="accountNumber">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Kontonummer</field.Label>
                                    <field.Input placeholder="1234.56.78901" />
                                    <field.Description>
                                        Formatet er xxxx.xx.xxxxx
                                    </field.Description>
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                    </FieldGroup>

                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                        <form.AppField name="date">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Dato</field.Label>
                                    <field.DatePicker />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
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
                    </FieldGroup>

                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                        <form.AppField name="budgetType">
                            {(field) => (
                                <field.Field required>
                                    <field.Label>Budsjetttype</field.Label>
                                    <field.Select
                                        options={options.budgetTypes}
                                        placeholder="Velg budsjetttype"
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                        <form.AppField name="cc">
                            {(field) => (
                                <field.Field>
                                    <field.Label>
                                        Kopi til økonomiansvarlig
                                    </field.Label>
                                    <field.Combobox
                                        items={options.ccOptions}
                                        placeholder="Valgfritt"
                                        getLabel={(option) => option.name}
                                        getKey={(option) => option.slug}
                                        isEqual={(a, b) => a.slug === b.slug}
                                    />
                                    <field.Error />
                                </field.Field>
                            )}
                        </form.AppField>
                    </FieldGroup>

                    <form.AppField name="description">
                        {(field) => (
                            <field.Field required>
                                <field.Label>Hva utlegget er for</field.Label>
                                <field.Textarea
                                    rows={5}
                                    placeholder="Beskriv hva du har lagt ut for..."
                                />
                                <field.Error />
                            </field.Field>
                        )}
                    </form.AppField>

                    <form.AppField name="receipts">
                        {(field) => (
                            <field.Field required>
                                <field.Label>Kvitteringer</field.Label>
                                <field.ImageDropzone multiple maxFiles={10} />
                                <field.Description>
                                    Last opp bilder av kvitteringene. Maks 10
                                    filer.
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
                            Send inn utlegg
                        </form.SubmitButton>
                    </form.AppForm>
                </form>
            </CardContent>
        </Card>
    );
}
