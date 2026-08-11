import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { FieldGroup } from "@tihlde/ui/ui/field";
import { Spinner } from "@tihlde/ui/ui/spinner";

import { useState } from "react";

import {
    invalidateAuth,
    signInWithFeide,
    signUpEmailMutationOptions,
} from "#/api/auth";
import { FeideSignInButton } from "#/components/feide-sign-in-button";
import { OrDivider } from "#/components/or-divider";
import { formHandlers, useAppForm } from "#/hooks/form";

export const Route = createFileRoute("/_auth/register")({
    component: RegisterPage,
});

// Mirrors SELF_CHOSEN_USERNAME_PATTERN in @photon/auth, which is the actual
// enforcement point — this only moves the error next to the field.
const SELF_CHOSEN_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;

const registerSchema = z
    .object({
        name: z.string().min(1, { error: "Navn kan ikke være tom" }),
        email: z.email({ error: "Ugyldig e-post" }),
        // Only shown once the server says the derived one is taken, so an
        // empty value is normal and means "use the one from the address".
        username: z
            .string()
            .trim()
            .refine(
                (value) =>
                    value.length === 0 ||
                    SELF_CHOSEN_USERNAME_PATTERN.test(value.toLowerCase()),
                {
                    error: "3–30 tegn: små bokstaver, tall, punktum, bindestrek eller understrek",
                },
            ),
        password: z
            .string()
            .min(8, { error: "Passordet må være minst 8 tegn" }),
        confirmPassword: z.string(),
    })
    .superRefine((e, ctx) => {
        if (e.password !== e.confirmPassword) {
            ctx.addIssue({
                code: "custom",
                message: "Passordene er ikke like",
                path: ["confirmPassword"],
            });
            return z.NEVER;
        }
    });

function RegisterPage() {
    const navigate = useNavigate();

    const [feideLoading, setFeideLoading] = useState(false);
    // Feide is the primary path, so the email/password form stays collapsed
    // behind a "Kan du ikke bruke Feide?" link.
    const [showEmailForm, setShowEmailForm] = useState(false);

    async function handleFeideSignIn() {
        setFeideLoading(true);
        try {
            await signInWithFeide("/");
        } catch {
            setFeideLoading(false);
        }
    }

    const signUpMutation = useMutation(signUpEmailMutationOptions);

    /**
     * The username field appears only after the server has rejected the one it
     * derived from the address. Asking everyone up front for something we can
     * work out ourselves is a field most people would have to think about for
     * no reason.
     */
    const [needsUsername, setNeedsUsername] = useState(false);

    const form = useAppForm({
        validators: {
            onChange: registerSchema,
            onSubmit: registerSchema,
        },
        defaultValues: {
            name: "",
            email: "",
            username: "",
            password: "",
            confirmPassword: "",
        },
        async onSubmit({ value }) {
            let data: Awaited<ReturnType<typeof signUpMutation.mutateAsync>>;
            try {
                data = await signUpMutation.mutateAsync({
                    name: value.name,
                    email: value.email,
                    password: value.password,
                    username: value.username.trim() || undefined,
                });
            } catch (error) {
                // The server answers a taken username with a message naming it;
                // that is the cue to ask for one instead of only showing the
                // error and leaving no way to act on it.
                if (
                    error instanceof Error &&
                    error.message.includes("opptatt")
                ) {
                    setNeedsUsername(true);
                }
                throw error;
            }

            if ("url" in data && data.url) {
                window.location.href = data.url;
                return;
            }
            if ("session" in data && data.session) {
                await invalidateAuth();
                await navigate({ to: "/" });
                return;
            }
            // Otherwise email verification is required — the success card
            // renders below using signUpMutation.isSuccess.
        },
    });

    if (signUpMutation.isSuccess) {
        const data = signUpMutation.data;
        const navigated =
            ("url" in data && data.url) || ("session" in data && data.session);

        if (!navigated) {
            return (
                <Card>
                    <CardHeader>
                        <CardTitle>Sjekk e-posten din</CardTitle>
                        <CardDescription>
                            Vi har sendt en bekreftelseslenke til{" "}
                            {form.state.values.email}. Følg lenken for å
                            fullføre registreringen. Deretter godkjenner en
                            administrator brukeren din — du får en e-post når
                            det er gjort.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Link
                            to="/login"
                            className="text-sm underline underline-offset-4"
                        >
                            Tilbake til innlogging
                        </Link>
                    </CardFooter>
                </Card>
            );
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Opprett bruker</CardTitle>
                <CardDescription>
                    Er du student, registrer deg med Feide — da er du medlem med
                    én gang. Andre kan lage bruker med e-post, og en
                    administrator godkjenner den.
                </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
                <FeideSignInButton
                    variant="default"
                    label="Registrer med Feide"
                    onSignIn={handleFeideSignIn}
                    loading={feideLoading}
                />
                {!showEmailForm && (
                    <Button
                        type="button"
                        variant="link"
                        className="mx-auto"
                        onClick={() => setShowEmailForm(true)}
                    >
                        Har du ikke Feide?
                    </Button>
                )}
            </CardContent>

            {showEmailForm && (
                <form {...formHandlers(form)} className="flex flex-col gap-4">
                    <div className="px-6">
                        <OrDivider label="eller registrer med e-post" />
                    </div>
                    <CardContent className="flex flex-col gap-5">
                        <FieldGroup>
                            <form.AppField name="name">
                                {(field) => (
                                    <field.InputField
                                        label="Navn"
                                        autoComplete="name"
                                        required
                                    />
                                )}
                            </form.AppField>
                            <form.AppField name="email">
                                {(field) => (
                                    <field.InputField
                                        label="E-post"
                                        type="email"
                                        autoComplete="email"
                                        description="Studenter bruker @stud.ntnu.no. Andre kan bruke privat e-post. Brukernavnet ditt blir det som står før @."
                                        required
                                    />
                                )}
                            </form.AppField>
                            {needsUsername && (
                                <form.AppField name="username">
                                    {(field) => (
                                        <field.InputField
                                            label="Brukernavn"
                                            autoComplete="username"
                                            description="Brukernavnet fra e-postadressen din er opptatt. Velg et annet."
                                            required
                                        />
                                    )}
                                </form.AppField>
                            )}
                            <form.AppField name="password">
                                {(field) => (
                                    <field.PasswordField
                                        label="Passord"
                                        autoComplete="new-password"
                                        required
                                    />
                                )}
                            </form.AppField>
                            <form.AppField name="confirmPassword">
                                {(field) => (
                                    <field.PasswordField
                                        label="Bekreft passord"
                                        autoComplete="new-password"
                                        required
                                    />
                                )}
                            </form.AppField>
                        </FieldGroup>

                        <form.AppForm>
                            <form.FormErrors />
                        </form.AppForm>

                        <form.AppForm>
                            <form.SubmitButton
                                className="w-full"
                                loading={
                                    <>
                                        <Spinner />
                                        <span>Oppretter...</span>
                                    </>
                                }
                            >
                                Opprett bruker
                            </form.SubmitButton>
                        </form.AppForm>
                    </CardContent>
                </form>
            )}

            <CardFooter className="justify-center">
                <p className="text-sm text-muted-foreground">
                    Har du allerede konto?{" "}
                    <Link to="/login" className="underline underline-offset-4">
                        Logg inn
                    </Link>
                </p>
            </CardFooter>
        </Card>
    );
}
