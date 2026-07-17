import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
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

import { invalidateAuth, signUpEmailMutationOptions } from "#/api/auth";
import { formHandlers, useAppForm } from "#/hooks/form";

export const Route = createFileRoute("/_auth/register")({
    component: RegisterPage,
});

const registerSchema = z
    .object({
        name: z.string().min(1, { error: "Navn kan ikke være tom" }),
        email: z.email({ error: "Ugyldig e-post" }),
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

    const signUpMutation = useMutation(signUpEmailMutationOptions);

    const form = useAppForm({
        validators: {
            onChange: registerSchema,
            onSubmit: registerSchema,
        },
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
        async onSubmit({ value }) {
            const data = await signUpMutation.mutateAsync({
                name: value.name,
                email: value.email,
                password: value.password,
            });

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
                            fullføre registreringen.
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
                    Opprett en konto for å delta på arrangementer.
                </CardDescription>
            </CardHeader>
            <form {...formHandlers(form)}>
                <CardContent>
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
                                    required
                                />
                            )}
                        </form.AppField>
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
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
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
                    <p className="text-sm text-muted-foreground">
                        Har du allerede konto?{" "}
                        <Link
                            to="/login"
                            className="underline underline-offset-4"
                        >
                            Logg inn
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
