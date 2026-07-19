import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
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

import {
    sanitizeRedirectTo,
    signInUsernameMutationOptions,
    signInWithFeide,
} from "#/api/auth";
import { FeideSignInButton } from "#/components/feide-sign-in-button";
import { env } from "#/env";
import { formHandlers, useAppForm } from "#/hooks/form";

// Keep extra search params (sig, exp, client_id, scope…) so the
// oauthProviderClient fetch hook can read them off window.location.
const searchSchema = z
    .object({
        redirectTo: z.string().optional(),
    })
    .loose();

export const Route = createFileRoute("/_auth/login")({
    component: LoginPage,
    validateSearch: searchSchema,
});

const loginSchema = z.object({
    username: z.string().min(1, { error: "Brukernavn kan ikke være tomt" }),
    password: z.string().min(1, { error: "Passord kan ikke være tom" }),
});

function LoginPage() {
    const { redirectTo } = Route.useSearch();

    const [feideLoading, setFeideLoading] = useState(false);

    async function handleFeideSignIn() {
        setFeideLoading(true);
        try {
            await signInWithFeide(sanitizeRedirectTo(redirectTo));
        } catch {
            // Reaching here means the redirect never happened; let the user retry.
            setFeideLoading(false);
        }
    }

    const signInMutation = useMutation(signInUsernameMutationOptions);

    const form = useAppForm({
        validators: {
            onChange: loginSchema,
            onSubmit: loginSchema,
        },
        defaultValues: {
            username: "",
            password: "",
        },
        async onSubmit({ value }) {
            const data = await signInMutation.mutateAsync({
                username: value.username,
                password: value.password,
            });

            // If we came from an OAuth authorize redirect, the server's after-hook
            // runs authorizeEndpoint and overrides the response with a redirect URL.
            if ("url" in data && data.url) {
                window.location.href = data.url;
                return;
            }

            // Hard navigation so the search params (and any stale state) are dropped.
            // Sanitized: redirectTo is attacker-controllable via the URL.
            window.location.href = sanitizeRedirectTo(redirectTo);
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Logg inn</CardTitle>
                <CardDescription>
                    Velkommen tilbake. Logg inn på kontoen din.
                </CardDescription>
            </CardHeader>
            <form {...formHandlers(form)}>
                <CardContent>
                    <FieldGroup>
                        <form.AppField name="username">
                            {(field) => (
                                <field.InputField
                                    label="Brukernavn"
                                    type="text"
                                    autoComplete="username"
                                    required
                                />
                            )}
                        </form.AppField>
                        <form.AppField name="password">
                            {(field) => (
                                <field.PasswordField
                                    label="Passord"
                                    autoComplete="current-password"
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
                                    <span>Logger inn...</span>
                                </>
                            }
                        >
                            Logg inn
                        </form.SubmitButton>
                    </form.AppForm>
                    {env.VITE_FEIDE_ENABLED && (
                        <FeideSignInButton
                            onSignIn={handleFeideSignIn}
                            loading={feideLoading}
                        />
                    )}
                    <p className="text-sm text-muted-foreground">
                        Har du ikke konto?{" "}
                        <Link
                            to="/register"
                            className="underline underline-offset-4"
                        >
                            Opprett bruker
                        </Link>
                    </p>
                    <p className="text-sm text-muted-foreground">
                        <Link
                            to="/forgot-password"
                            className="underline underline-offset-4"
                        >
                            Glemt passord?
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
