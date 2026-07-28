import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
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

import {
    sanitizeRedirectTo,
    signInUsernameMutationOptions,
    signInWithFeide,
} from "#/api/auth";
import { FeideSignInButton } from "#/components/feide-sign-in-button";
import {
    FeideSignInIssue,
    type FeideSignInIssueReason,
} from "#/components/feide-sign-in-issue";
import { OrDivider } from "#/components/or-divider";
import { formHandlers, useAppForm } from "#/hooks/form";

// Keep extra search params (sig, exp, client_id, scope…) so the
// oauthProviderClient fetch hook can read them off window.location.
const searchSchema = z
    .object({
        redirectTo: z.string().optional(),
        // Better Auth appends this when the Feide callback fails; it redirects
        // to errorCallbackURL, which signInWithFeide points back here.
        error: z.string().optional(),
    })
    .loose();

/**
 * The two Feide outcomes that mean "we could not decide which account is
 * yours", as opposed to a genuine failure. Better Auth builds these slugs by
 * replacing spaces with underscores, so they arrive as `signup_disabled` and
 * `account_not_linked`.
 */
const FEIDE_ISSUE_REASONS = new Set<FeideSignInIssueReason>([
    "signup_disabled",
    "account_not_linked",
]);

function feideIssueFrom(error: string | undefined) {
    return error && FEIDE_ISSUE_REASONS.has(error as FeideSignInIssueReason)
        ? (error as FeideSignInIssueReason)
        : null;
}

export const Route = createFileRoute("/_auth/login")({
    component: LoginPage,
    validateSearch: searchSchema,
});

const loginSchema = z.object({
    username: z.string().min(1, { error: "Brukernavn kan ikke være tomt" }),
    password: z.string().min(1, { error: "Passord kan ikke være tom" }),
});

function LoginPage() {
    const { redirectTo, error } = Route.useSearch();

    const feideIssue = feideIssueFrom(error);

    const [feideLoading, setFeideLoading] = useState(false);
    // Feide is the primary path, so the username/password form stays collapsed
    // behind a "Kan du ikke bruke Feide?" link — unless Feide already failed in
    // a way that points at an existing account, where the form *is* the answer.
    const [showPasswordForm, setShowPasswordForm] = useState(
        feideIssue === "account_not_linked",
    );

    async function handleFeideSignIn(options?: { requestSignUp?: boolean }) {
        setFeideLoading(true);
        try {
            await signInWithFeide(sanitizeRedirectTo(redirectTo), options);
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
                    Velkommen tilbake. Logg inn med Feide.
                </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
                {feideIssue && (
                    <FeideSignInIssue
                        reason={feideIssue}
                        loading={feideLoading}
                        showExistingAccountAction={!showPasswordForm}
                        onRegisterAsNew={() =>
                            handleFeideSignIn({ requestSignUp: true })
                        }
                        onUseExistingAccount={() => setShowPasswordForm(true)}
                    />
                )}
                <FeideSignInButton
                    variant="default"
                    onSignIn={() => handleFeideSignIn()}
                    loading={feideLoading}
                />
                {!showPasswordForm && (
                    <Button
                        type="button"
                        variant="link"
                        className="mx-auto"
                        onClick={() => setShowPasswordForm(true)}
                    >
                        Kan du ikke bruke Feide?
                    </Button>
                )}
            </CardContent>

            {showPasswordForm && (
                <form {...formHandlers(form)} className="flex flex-col gap-4">
                    <div className="px-6">
                        <OrDivider label="eller logg inn med brukernavn" />
                    </div>
                    <CardContent className="flex flex-col gap-5">
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
                            <div className="flex flex-col gap-2">
                                <form.AppField name="password">
                                    {(field) => (
                                        <field.PasswordField
                                            label="Passord"
                                            autoComplete="current-password"
                                            required
                                        />
                                    )}
                                </form.AppField>
                                <div className="flex justify-end">
                                    <Link
                                        to="/forgot-password"
                                        className="text-sm text-muted-foreground underline underline-offset-4"
                                    >
                                        Glemt passord?
                                    </Link>
                                </div>
                            </div>
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
                                        <span>Logger inn...</span>
                                    </>
                                }
                            >
                                Logg inn
                            </form.SubmitButton>
                        </form.AppForm>
                    </CardContent>
                </form>
            )}

            <CardFooter className="justify-center">
                <p className="text-sm text-muted-foreground">
                    Har du ikke konto?{" "}
                    <Link
                        to="/register"
                        className="underline underline-offset-4"
                    >
                        Opprett bruker
                    </Link>
                </p>
            </CardFooter>
        </Card>
    );
}
