import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { FieldContent, FieldGroup } from "@tihlde/ui/ui/field";
import {
    InputGroupAddon,
    InputGroupButton,
    InputGroupText,
} from "@tihlde/ui/ui/input-group";
import { type DateRange } from "@tihlde/ui/ui/date-picker";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { type TimeValue } from "@tihlde/ui/ui/time-picker";
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
import { useState } from "react";
import { z } from "zod";

import {
    ChangePasswordDialog,
    CreateEventDialog,
    EditProfileDialog,
    EventRegistrationDialog,
    InviteUserDialog,
    JobFiltersDemo,
    LoginDialog,
} from "#/components/form-test";
import { formHandlers, useAppForm } from "#/hooks/form";

export const Route = createFileRoute("/_dev/form-test")({
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
    country: z
        .string()
        .nullable()
        .refine((v) => v !== null && v.length > 0, {
            error: "Velg et land",
        }),
    tags: z.array(z.string()).min(1, { error: "Velg minst én tag" }),
    avatar: z
        .instanceof(File, { error: "Last opp et bilde" })
        .nullable()
        .refine((v) => v !== null, { error: "Last opp et bilde" }),
    avatarSmall: z.instanceof(File).nullable(),
    logoPng: z.instanceof(File).nullable(),
    gallery: z.array(z.instanceof(File)),
    strictGallery: z.array(z.instanceof(File)),
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
    meetingDate: z
        .instanceof(Date, { error: "Velg en dato" })
        .nullable()
        .refine((v) => v !== null, { error: "Velg en dato" }),
    birthMonth: z
        .instanceof(Date, { error: "Velg en måned" })
        .nullable()
        .refine((v) => v !== null, { error: "Velg en måned" }),
    vacationRange: z
        .object({
            from: z.instanceof(Date),
            to: z.instanceof(Date).optional(),
        })
        .nullable()
        .refine((v) => v !== null && v.to !== undefined, {
            error: "Velg start- og sluttdato",
        }),
    reportRange: z
        .object({
            from: z.instanceof(Date),
            to: z.instanceof(Date).optional(),
        })
        .nullable(),
    startTime: z
        .object({
            hour: z.number().int().min(0).max(23),
            minute: z.number().int().min(0).max(59),
        })
        .nullable()
        .refine((v) => v !== null, { error: "Velg starttid" }),
    reminderTime: z
        .object({
            hour: z.number().int().min(0).max(23),
            minute: z.number().int().min(0).max(59),
        })
        .nullable(),
});

function FormTestPage() {
    const [loginOpen, setLoginOpen] = useState(false);
    const [createEventOpen, setCreateEventOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);
    const [editProfileOpen, setEditProfileOpen] = useState(false);
    const [registerEventOpen, setRegisterEventOpen] = useState(false);

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
            country: null as string | null,
            tags: [] as string[],
            avatar: null as File | null,
            avatarSmall: null as File | null,
            logoPng: null as File | null,
            gallery: [] as File[],
            strictGallery: [] as File[],
            search: "",
            emailWithIcon: "",
            amount: "",
            website: "",
            username: "",
            copyUrl: "https://tihlde.org/...",
            cardNumber: "",
            shortcutSearch: "",
            charLimitedNote: "",
            meetingDate: null as Date | null,
            birthMonth: null as Date | null,
            vacationRange: null as DateRange | null,
            reportRange: null as DateRange | null,
            startTime: null as TimeValue | null,
            reminderTime: null as TimeValue | null,
        },
        validators: { onDynamic: formTestSchema },
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
                            Field/Label/Input/Password (composable),
                            TextareaField
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="email">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>E-post</field.Label>
                                        <field.Input
                                            type="email"
                                            autoComplete="email"
                                            placeholder="navn@example.com"
                                        />
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="fullName">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>Fullt navn</field.Label>
                                        <field.Input autoComplete="name" />
                                        <field.Description>
                                            Som det står i passet
                                        </field.Description>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="password">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>Passord</field.Label>
                                        <field.Password autoComplete="new-password" />
                                        <field.Description>
                                            Minst 8 tegn
                                        </field.Description>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="bio">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>Bio</field.Label>
                                        <field.Textarea
                                            rows={4}
                                            placeholder="Fortell litt om deg selv..."
                                        />
                                        <field.Description>
                                            10–500 tegn
                                        </field.Description>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>InputGroup-varianter</CardTitle>
                        <CardDescription>
                            Samme Input/TextareaField, men med{" "}
                            <code>InputGroupAddon</code>-children for ikoner,
                            prefikser, suffikser, knapper og hint.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="search">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>Søk</field.Label>
                                        <field.Input placeholder="Søk etter alt...">
                                            <InputGroupAddon align="inline-start">
                                                <SearchIcon />
                                            </InputGroupAddon>
                                        </field.Input>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="emailWithIcon">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>E-post (ikon)</field.Label>
                                        <field.Input
                                            type="email"
                                            placeholder="navn@example.com"
                                        >
                                            <InputGroupAddon align="inline-start">
                                                <MailIcon />
                                            </InputGroupAddon>
                                        </field.Input>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="amount">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>Beløp</field.Label>
                                        <field.Input placeholder="0.00">
                                            <InputGroupAddon align="inline-start">
                                                <InputGroupText>
                                                    $
                                                </InputGroupText>
                                            </InputGroupAddon>
                                            <InputGroupAddon align="inline-end">
                                                <InputGroupText>
                                                    USD
                                                </InputGroupText>
                                            </InputGroupAddon>
                                        </field.Input>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="website">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>Nettside</field.Label>
                                        <field.Input placeholder="example">
                                            <InputGroupAddon align="inline-start">
                                                <InputGroupText>
                                                    https://
                                                </InputGroupText>
                                            </InputGroupAddon>
                                            <InputGroupAddon align="inline-end">
                                                <InputGroupText>
                                                    .com
                                                </InputGroupText>
                                            </InputGroupAddon>
                                        </field.Input>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="username">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>Brukernavn</field.Label>
                                        <field.Input placeholder="brukernavn">
                                            <InputGroupAddon align="inline-end">
                                                <InputGroupText>
                                                    <AtSignIcon />
                                                    tihlde.org
                                                </InputGroupText>
                                            </InputGroupAddon>
                                        </field.Input>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="copyUrl">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>Lenke å dele</field.Label>
                                        <field.Input readOnly>
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
                                        </field.Input>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="shortcutSearch">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>Kommando</field.Label>
                                        <field.Input placeholder="Søk...">
                                            <InputGroupAddon align="inline-start">
                                                <SearchIcon />
                                            </InputGroupAddon>
                                            <InputGroupAddon align="inline-end">
                                                <InputGroupText className="rounded-sm bg-muted px-1 text-xs">
                                                    <CommandIcon className="size-3" />
                                                    K
                                                </InputGroupText>
                                            </InputGroupAddon>
                                        </field.Input>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="cardNumber">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>Kortnummer</field.Label>
                                        <field.Input placeholder="0000 0000 0000 0000">
                                            <InputGroupAddon align="inline-start">
                                                <CreditCardIcon />
                                            </InputGroupAddon>
                                            <InputGroupAddon align="inline-end">
                                                {field.state.value.length >=
                                                12 ? (
                                                    <CheckIcon className="text-emerald-500" />
                                                ) : (
                                                    <>
                                                        <StarIcon />
                                                        <InfoIcon />
                                                    </>
                                                )}
                                            </InputGroupAddon>
                                        </field.Input>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="charLimitedNote">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>Notat</field.Label>
                                        <field.Textarea
                                            rows={3}
                                            placeholder="Skriv her..."
                                        >
                                            <InputGroupAddon align="block-end">
                                                <InputGroupText>
                                                    {120 -
                                                        field.state.value
                                                            .length}{" "}
                                                    tegn igjen
                                                </InputGroupText>
                                            </InputGroupAddon>
                                        </field.Textarea>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Numeriske felt</CardTitle>
                        <CardDescription>
                            Number med +/- (Base UI NumberField primitive). Pil
                            opp/ned funker også når feltet er fokusert.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="age">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>Alder</field.Label>
                                        <field.Number
                                            min={13}
                                            max={120}
                                            placeholder="13"
                                        />
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="quantity">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>Antall</field.Label>
                                        <field.Number
                                            min={1}
                                            max={99}
                                            step={5}
                                        />
                                        <field.Description>
                                            Steg på 5, mellom 1 og 99
                                        </field.Description>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Toggles</CardTitle>
                        <CardDescription>
                            Checkbox (påkrevd) og Switch (valgfritt)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="acceptTerms">
                                {(field) => (
                                    <field.Field
                                        orientation="horizontal"
                                        required
                                    >
                                        <FieldContent>
                                            <field.Label>
                                                Jeg godtar vilkårene
                                            </field.Label>
                                            <field.Description>
                                                Du må godta for å sende inn
                                                skjemaet
                                            </field.Description>
                                            <field.Error />
                                        </FieldContent>
                                        <field.Checkbox />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="notifications">
                                {(field) => (
                                    <field.Field orientation="horizontal">
                                        <FieldContent>
                                            <field.Label>
                                                E-postvarsler
                                            </field.Label>
                                            <field.Description>
                                                Få varsler om nye arrangementer
                                                på e-post
                                            </field.Description>
                                            <field.Error />
                                        </FieldContent>
                                        <field.Switch />
                                    </field.Field>
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Enkeltvalg</CardTitle>
                        <CardDescription>
                            Select, RadioGroup, Combobox (single)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="role">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>Rolle</field.Label>
                                        <field.Select
                                            options={ROLE_OPTIONS}
                                            placeholder="Velg en rolle"
                                        />
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="plan">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>Abonnement</field.Label>
                                        <field.RadioGroup
                                            options={PLAN_OPTIONS}
                                        />
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="country">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>Land</field.Label>
                                        <field.Combobox
                                            items={COUNTRIES}
                                            placeholder="Søk eller velg..."
                                        />
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Flervalg</CardTitle>
                        <CardDescription>
                            CheckboxGroup, Combobox (multiple)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="interests">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>Interesser</field.Label>
                                        <field.CheckboxGroup
                                            options={INTEREST_OPTIONS}
                                        />
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="tags">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>Tags</field.Label>
                                        <field.Combobox
                                            items={TAG_OPTIONS}
                                            multiple
                                            placeholder="Søk og legg til..."
                                        />
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Filer</CardTitle>
                        <CardDescription>
                            ImageDropzone — ulike varianter med caps for
                            filtype, størrelse og antall.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <form.AppField name="avatar">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>
                                            Profilbilde (standard, påkrevd)
                                        </field.Label>
                                        <field.ImageDropzone />
                                        <field.Description>
                                            Hvilken som helst bildefil — ingen
                                            størrelsesgrense
                                        </field.Description>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="avatarSmall">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>Liten avatar</field.Label>
                                        <field.ImageDropzone
                                            maxSize={2 * 1024 * 1024}
                                        />
                                        <field.Description>
                                            Bilde, maks 2 MB
                                        </field.Description>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="logoPng">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>
                                            Logo (kun PNG)
                                        </field.Label>
                                        <field.ImageDropzone
                                            accept={{ "image/png": [".png"] }}
                                            maxSize={500 * 1024}
                                            placeholder="Klikk eller dra en PNG hit"
                                        />
                                        <field.Description>
                                            Bare PNG-filer, maks 500 KB
                                        </field.Description>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="gallery">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>Galleri</field.Label>
                                        <field.ImageDropzone
                                            multiple
                                            maxFiles={4}
                                            placeholder="Klikk eller dra opptil 4 bilder hit"
                                        />
                                        <field.Description>
                                            Opptil 4 bilder, blandede formater
                                        </field.Description>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="strictGallery">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>
                                            Bevisutdrag (strenge regler)
                                        </field.Label>
                                        <field.ImageDropzone
                                            accept={{
                                                "image/jpeg": [".jpg", ".jpeg"],
                                                "image/png": [".png"],
                                            }}
                                            multiple
                                            maxFiles={3}
                                            maxSize={1024 * 1024}
                                            placeholder="Klikk eller dra opptil 3 JPG/PNG hit"
                                        />
                                        <field.Description>
                                            JPG/PNG, maks 3 stk, maks 1 MB per
                                            fil
                                        </field.Description>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Datoer og tider</CardTitle>
                        <CardDescription>
                            DatePicker (enkelt + range, dag- og månedsvisning)
                            paret med TimePicker — 24-timers norsk klokke.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                                <form.AppField name="meetingDate">
                                    {(field) => (
                                        <field.Field required>
                                            <field.Label>
                                                Møtedato (dagsvisning)
                                            </field.Label>
                                            <field.DatePicker
                                                view="day"
                                                placeholder="Velg dato"
                                            />
                                            <field.Error />
                                        </field.Field>
                                    )}
                                </form.AppField>
                                <form.AppField name="startTime">
                                    {(field) => (
                                        <field.Field required>
                                            <field.Label>Starttid</field.Label>
                                            <field.TimePicker />
                                            <field.Error />
                                        </field.Field>
                                    )}
                                </form.AppField>
                            </div>

                            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                                <form.AppField name="birthMonth">
                                    {(field) => (
                                        <field.Field required>
                                            <field.Label>
                                                Fødselsmåned (månedsvisning)
                                            </field.Label>
                                            <field.DatePicker
                                                view="month"
                                                placeholder="Velg måned"
                                            />
                                            <field.Error />
                                        </field.Field>
                                    )}
                                </form.AppField>
                                <form.AppField name="reminderTime">
                                    {(field) => (
                                        <field.Field>
                                            <field.Label>
                                                Påminnelse
                                            </field.Label>
                                            <field.TimePicker minuteStep={15} />
                                            <field.Error />
                                        </field.Field>
                                    )}
                                </form.AppField>
                            </div>

                            <form.AppField name="vacationRange">
                                {(field) => (
                                    <field.Field required>
                                        <field.Label>
                                            Ferie (range, dag)
                                        </field.Label>
                                        <field.DateRangePicker
                                            view="day"
                                            placeholder="Velg periode"
                                        />
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>

                            <form.AppField name="reportRange">
                                {(field) => (
                                    <field.Field>
                                        <field.Label>
                                            Rapportperiode (range, måned)
                                        </field.Label>
                                        <field.DateRangePicker
                                            view="month"
                                            placeholder="Velg månedsperiode"
                                        />
                                        <field.Description>
                                            Valgfri — brukes til månedsrapporter
                                        </field.Description>
                                        <field.Error />
                                    </field.Field>
                                )}
                            </form.AppField>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Jobbfilter</CardTitle>
                        <CardDescription>
                            Hvordan annonser-filteret ser ut bygget på de nye
                            field-komposablene (i stedet for rå primitiver).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
                            <JobFiltersDemo />
                            <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                                Resultatområde (mock)
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Dialoger</CardTitle>
                        <CardDescription>
                            Reelle skjemaer i Dialog — egne useAppForm-instanser
                            per dialog. Valider, send inn (logger til konsoll)
                            eller avbryt.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setLoginOpen(true)}
                            >
                                Logg inn
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateEventOpen(true)}
                            >
                                Nytt arrangement
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setInviteOpen(true)}
                            >
                                Inviter bruker
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setChangePasswordOpen(true)}
                            >
                                Endre passord
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditProfileOpen(true)}
                            >
                                Rediger profil
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setRegisterEventOpen(true)}
                            >
                                Påmelding til arrangement
                            </Button>
                        </div>
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

            <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
            <CreateEventDialog
                open={createEventOpen}
                onOpenChange={setCreateEventOpen}
            />
            <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
            <ChangePasswordDialog
                open={changePasswordOpen}
                onOpenChange={setChangePasswordOpen}
            />
            <EditProfileDialog
                open={editProfileOpen}
                onOpenChange={setEditProfileOpen}
            />
            <EventRegistrationDialog
                open={registerEventOpen}
                onOpenChange={setRegisterEventOpen}
                eventTitle="Bedriftspresentasjon: Bekk"
            />
        </div>
    );
}
