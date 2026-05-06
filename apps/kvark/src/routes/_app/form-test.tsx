import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { FieldGroup } from "@tihlde/ui/ui/field";
import {
    InputGroupAddon,
    InputGroupButton,
    InputGroupText,
} from "@tihlde/ui/ui/input-group";
import { Spinner } from "@tihlde/ui/ui/spinner";
import {
    AtSignIcon,
    CheckIcon,
    CommandIcon,
    CopyIcon,
    CreditCardIcon,
    InfoIcon,
    MailIcon,
    SearchIcon,
    StarIcon,
} from "lucide-react";
import { z } from "zod";

import { formHandlers, useAppForm } from "#/hooks/form";

export const Route = createFileRoute("/_app/form-test")({
    component: FormTestPage,
});

const ROLE_OPTIONS = [
    { value: "admin", label: "Administrator" },
    { value: "user", label: "Bruker" },
    { value: "guest", label: "Gjest" },
];

const PLAN_OPTIONS = [
    { value: "free", label: "Gratis" },
    { value: "pro", label: "Pro" },
    { value: "enterprise", label: "Bedrift" },
];

const INTEREST_OPTIONS = [
    { value: "music", label: "Musikk" },
    { value: "sports", label: "Sport" },
    { value: "tech", label: "Tech" },
    { value: "art", label: "Kunst" },
    { value: "food", label: "Mat" },
];

const COUNTRIES = ["Norge", "Sverige", "Danmark", "Finland", "Island"];

const TAG_OPTIONS = [
    "TypeScript",
    "React",
    "Hono",
    "Zod",
    "Drizzle",
    "Tailwind",
    "TanStack",
];

const formTestSchema = z.object({
    email: z.email({ error: "Ugyldig e-post" }),
    fullName: z.string().min(2, { error: "Minst 2 tegn" }),
    password: z.string().min(8, { error: "Minst 8 tegn" }),
    bio: z
        .string()
        .min(10, { error: "Minst 10 tegn" })
        .max(500, { error: "Maks 500 tegn" }),
    age: z
        .number()
        .int()
        .min(13, { error: "Minst 13" })
        .max(120, { error: "Maks 120" })
        .nullable()
        .refine((v) => v !== null, { error: "Alder er påkrevd" }),
    quantity: z
        .number()
        .int()
        .min(1, { error: "Minst 1" })
        .max(99, { error: "Maks 99" })
        .nullable()
        .refine((v) => v !== null, { error: "Antall er påkrevd" }),
    acceptTerms: z
        .boolean()
        .refine((v) => v === true, { error: "Du må godta vilkårene" }),
    notifications: z.boolean(),
    role: z
        .union([z.literal(""), z.enum(["admin", "user", "guest"])])
        .refine((v) => v !== "", { error: "Velg en rolle" }),
    plan: z
        .union([z.literal(""), z.enum(["free", "pro", "enterprise"])])
        .refine((v) => v !== "", { error: "Velg et abonnement" }),
    interests: z
        .array(z.string())
        .min(1, { error: "Velg minst ett interesseområde" }),
    country: z.string().min(1, { error: "Velg et land" }),
    tags: z.array(z.string()).min(1, { error: "Velg minst én tag" }),
    avatar: z
        .instanceof(File, { error: "Last opp et bilde" })
        .nullable()
        .refine((v) => v !== null, { error: "Last opp et bilde" }),
    search: z.string().min(1, { error: "Skriv inn et søk" }),
    emailWithIcon: z.email({ error: "Ugyldig e-post" }),
    amount: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, { error: "Skriv et tall, f.eks. 1234.50" }),
    website: z
        .string()
        .min(1, { error: "Domene er påkrevd" })
        .regex(/^[a-z0-9-]+$/i, {
            error: "Bare bokstaver, tall og bindestrek",
        }),
    username: z
        .string()
        .min(3, { error: "Minst 3 tegn" })
        .regex(/^[a-z0-9_]+$/i, {
            error: "Bare bokstaver, tall og understrek",
        }),
    copyUrl: z.string(),
    cardNumber: z.string().regex(/^\d{12,19}$/, { error: "12–19 sifre" }),
    shortcutSearch: z.string(),
    charLimitedNote: z
        .string()
        .min(1, { error: "Skriv et notat" })
        .max(120, { error: "Maks 120 tegn" }),
});

function FormTestPage() {
    const form = useAppForm({
        defaultValues: {
            email: "",
            fullName: "",
            password: "",
            bio: "",
            age: null as number | null,
            quantity: 1 as number | null,
            acceptTerms: false,
            notifications: true,
            role: "" as "" | "admin" | "user" | "guest",
            plan: "" as "" | "free" | "pro" | "enterprise",
            interests: [] as string[],
            country: "",
            tags: [] as string[],
            avatar: null as File | null,
            search: "",
            emailWithIcon: "",
            amount: "",
            website: "",
            username: "",
            copyUrl: "https://tihlde.org/...",
            cardNumber: "",
            shortcutSearch: "",
            charLimitedNote: "",
        },
        validators: {
            onBlur: formTestSchema,
            onSubmit: formTestSchema,
        },
        async onSubmit({ value }) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            globalThis.console.log("Submitted form:", value);
        },
    });

    return (
        <div className="container mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl">Form test</h1>
                <p className="text-muted-foreground">
                    Demoside for alle TanStack Form composition components.
                    Trykk «Send inn» for å se feilmeldinger på alle påkrevde
                    felt.
                </p>
            </header>

            <form {...formHandlers(form)} className="flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Tekstinput</CardTitle>
                        <CardDescription>
                            InputField (text/email/password), TextareaField
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="email">
                                {(field) => (
                                    <field.InputField
                                        label="E-post"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="navn@example.com"
                                        required
                                    />
                                )}
                            </form.AppField>

                            <form.AppField name="fullName">
                                {(field) => (
                                    <field.InputField
                                        label="Fullt navn"
                                        autoComplete="name"
                                        description="Som det står i passet"
                                        required
                                    />
                                )}
                            </form.AppField>

                            <form.AppField name="password">
                                {(field) => (
                                    <field.InputField
                                        label="Passord"
                                        type="password"
                                        autoComplete="new-password"
                                        description="Minst 8 tegn"
                                        required
                                    />
                                )}
                            </form.AppField>

                            <form.AppField name="bio">
                                {(field) => (
                                    <field.TextareaField
                                        label="Bio"
                                        rows={4}
                                        placeholder="Fortell litt om deg selv..."
                                        description="10–500 tegn"
                                        required
                                    />
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>InputGroup-varianter</CardTitle>
                        <CardDescription>
                            Samme InputField / TextareaField, men med{" "}
                            <code>InputGroupAddon</code>-children for ikoner,
                            prefikser, suffikser, knapper og hint.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="search">
                                {(field) => (
                                    <field.InputField
                                        label="Søk"
                                        placeholder="Søk etter alt..."
                                    >
                                        <InputGroupAddon align="inline-start">
                                            <SearchIcon />
                                        </InputGroupAddon>
                                    </field.InputField>
                                )}
                            </form.AppField>

                            <form.AppField name="emailWithIcon">
                                {(field) => (
                                    <field.InputField
                                        label="E-post (ikon)"
                                        type="email"
                                        placeholder="navn@example.com"
                                    >
                                        <InputGroupAddon align="inline-start">
                                            <MailIcon />
                                        </InputGroupAddon>
                                    </field.InputField>
                                )}
                            </form.AppField>

                            <form.AppField name="amount">
                                {(field) => (
                                    <field.InputField
                                        label="Beløp"
                                        placeholder="0.00"
                                    >
                                        <InputGroupAddon align="inline-start">
                                            <InputGroupText>$</InputGroupText>
                                        </InputGroupAddon>
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupText>USD</InputGroupText>
                                        </InputGroupAddon>
                                    </field.InputField>
                                )}
                            </form.AppField>

                            <form.AppField name="website">
                                {(field) => (
                                    <field.InputField
                                        label="Nettside"
                                        placeholder="example"
                                    >
                                        <InputGroupAddon align="inline-start">
                                            <InputGroupText>
                                                https://
                                            </InputGroupText>
                                        </InputGroupAddon>
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupText>.com</InputGroupText>
                                        </InputGroupAddon>
                                    </field.InputField>
                                )}
                            </form.AppField>

                            <form.AppField name="username">
                                {(field) => (
                                    <field.InputField
                                        label="Brukernavn"
                                        placeholder="brukernavn"
                                    >
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupText>
                                                <AtSignIcon />
                                                tihlde.org
                                            </InputGroupText>
                                        </InputGroupAddon>
                                    </field.InputField>
                                )}
                            </form.AppField>

                            <form.AppField name="copyUrl">
                                {(field) => (
                                    <field.InputField
                                        label="Lenke å dele"
                                        readOnly
                                    >
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupButton
                                                size="icon-xs"
                                                onClick={() =>
                                                    navigator.clipboard.writeText(
                                                        field.state.value,
                                                    )
                                                }
                                                aria-label="Kopier"
                                            >
                                                <CopyIcon />
                                            </InputGroupButton>
                                        </InputGroupAddon>
                                    </field.InputField>
                                )}
                            </form.AppField>

                            <form.AppField name="shortcutSearch">
                                {(field) => (
                                    <field.InputField
                                        label="Kommando"
                                        placeholder="Søk..."
                                    >
                                        <InputGroupAddon align="inline-start">
                                            <SearchIcon />
                                        </InputGroupAddon>
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupText className="rounded-sm bg-muted px-1 text-xs">
                                                <CommandIcon className="size-3" />
                                                K
                                            </InputGroupText>
                                        </InputGroupAddon>
                                    </field.InputField>
                                )}
                            </form.AppField>

                            <form.AppField name="cardNumber">
                                {(field) => (
                                    <field.InputField
                                        label="Kortnummer"
                                        placeholder="0000 0000 0000 0000"
                                    >
                                        <InputGroupAddon align="inline-start">
                                            <CreditCardIcon />
                                        </InputGroupAddon>
                                        <InputGroupAddon align="inline-end">
                                            {field.state.value.length >= 12 ? (
                                                <CheckIcon className="text-emerald-500" />
                                            ) : (
                                                <>
                                                    <StarIcon />
                                                    <InfoIcon />
                                                </>
                                            )}
                                        </InputGroupAddon>
                                    </field.InputField>
                                )}
                            </form.AppField>

                            <form.AppField name="charLimitedNote">
                                {(field) => (
                                    <field.TextareaField
                                        label="Notat"
                                        rows={3}
                                        placeholder="Skriv her..."
                                        blockEndAddon={
                                            <InputGroupText>
                                                {120 - field.state.value.length}{" "}
                                                tegn igjen
                                            </InputGroupText>
                                        }
                                    />
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Numeriske felt</CardTitle>
                        <CardDescription>
                            NumberField med +/- (Base UI NumberField primitive).
                            Pil opp/ned funker også når feltet er fokusert.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="age">
                                {(field) => (
                                    <field.NumberField
                                        label="Alder"
                                        min={13}
                                        max={120}
                                        placeholder="13"
                                        required
                                    />
                                )}
                            </form.AppField>

                            <form.AppField name="quantity">
                                {(field) => (
                                    <field.NumberField
                                        label="Antall"
                                        description="Steg på 5, mellom 1 og 99"
                                        min={1}
                                        max={99}
                                        step={5}
                                        required
                                    />
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Toggles</CardTitle>
                        <CardDescription>
                            CheckboxField (påkrevd) og SwitchField (valgfritt)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="acceptTerms">
                                {(field) => (
                                    <field.CheckboxField
                                        label="Jeg godtar vilkårene"
                                        description="Du må godta for å sende inn skjemaet"
                                        required
                                    />
                                )}
                            </form.AppField>

                            <form.AppField name="notifications">
                                {(field) => (
                                    <field.SwitchField
                                        label="E-postvarsler"
                                        description="Få varsler om nye arrangementer på e-post"
                                    />
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Enkeltvalg</CardTitle>
                        <CardDescription>
                            SelectField, RadioGroupField, ComboboxField (single)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="role">
                                {(field) => (
                                    <field.SelectField
                                        label="Rolle"
                                        options={ROLE_OPTIONS}
                                        placeholder="Velg en rolle"
                                        required
                                    />
                                )}
                            </form.AppField>

                            <form.AppField name="plan">
                                {(field) => (
                                    <field.RadioGroupField
                                        label="Abonnement"
                                        options={PLAN_OPTIONS}
                                        required
                                    />
                                )}
                            </form.AppField>

                            <form.AppField name="country">
                                {(field) => (
                                    <field.ComboboxField
                                        label="Land"
                                        items={COUNTRIES}
                                        placeholder="Søk eller velg..."
                                        required
                                    />
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Flervalg</CardTitle>
                        <CardDescription>
                            CheckboxGroupField, ComboboxField (multi)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="interests">
                                {(field) => (
                                    <field.CheckboxGroupField
                                        label="Interesser"
                                        options={INTEREST_OPTIONS}
                                        required
                                    />
                                )}
                            </form.AppField>

                            <form.AppField name="tags">
                                {(field) => (
                                    <field.ComboboxField
                                        label="Tags"
                                        items={TAG_OPTIONS}
                                        multi
                                        placeholder="Søk og legg til..."
                                        required
                                    />
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Filer</CardTitle>
                        <CardDescription>ImageDropzoneField</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="avatar">
                                {(field) => (
                                    <field.ImageDropzoneField
                                        label="Profilbilde"
                                        description="Bare bildefiler, opp til 5MB"
                                        required
                                    />
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Submit</CardTitle>
                        <CardDescription>
                            Trykk for å validere alt på en gang. Form-level
                            errors vises over knappen, felt-errors under hvert
                            felt.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-3">
                            <form.AppForm>
                                <form.FormErrors />
                            </form.AppForm>
                            <div className="flex gap-2">
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
                                <Button type="reset" variant="outline">
                                    Tilbakestill
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Debug</CardTitle>
                        <CardDescription>
                            Live form-state. Oppdateres på hvert tastetrykk.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form.Subscribe
                            selector={(state) => ({
                                values: state.values,
                                isValid: state.isValid,
                                isDirty: state.isDirty,
                                isSubmitting: state.isSubmitting,
                                errorCount: Object.keys(state.errors[0] ?? {})
                                    .length,
                            })}
                        >
                            {(snapshot) => (
                                <pre className="overflow-x-auto text-xs">
                                    {JSON.stringify(
                                        snapshot,
                                        (_, value) =>
                                            value instanceof File
                                                ? `[File: ${value.name}]`
                                                : value,
                                        2,
                                    )}
                                </pre>
                            )}
                        </form.Subscribe>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
