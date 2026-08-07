import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@tihlde/ui/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { FieldGroup } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Spinner } from "@tihlde/ui/ui/spinner";

import {
    AuthError,
    sanitizeRedirectTo,
    sendVerificationEmailMutationOptions,
    signInUsernameMutationOptions,
    signInWithFeide,
} from "#/api/auth";
import { requestAccountLinkHelpMutation } from "#/api/queries/account-link";
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

/**
 * Absolute URL for the link a confirmation mail carries.
 *
 * Absolute because Better Auth resolves a relative callback against the API
 * host, which would land the member on a 404 from the router. It points at
 * /koble-feide rather than the destination itself, and carries the
 * destination as `next` so that page can move them on afterwards.
 */
function feideLinkCallbackUrl(redirectTo: unknown) {
    const url = new URL("/koble-feide", window.location.origin);
    url.searchParams.set("next", sanitizeRedirectTo(redirectTo));
    return url.toString();
}

const loginSchema = z.object({
    username: z.string().min(1, { error: "Brukernavn kan ikke være tomt" }),
    password: z.string().min(1, { error: "Passord kan ikke være tom" }),
});

function LoginPage() {
    const { redirectTo, error } = Route.useSearch();

    const feideIssue = feideIssueFrom(error);

    const [feideLoading, setFeideLoading] = useState(false);
    // Feide is the primary path, so the username/password form stays collapsed
    // behind a "Kan du ikke bruke Feide?" link.
    const [showPasswordForm, setShowPasswordForm] = useState(false);

    // Verifying the address is what lets Better Auth attach Feide to a
    // migrated account; the member does it themselves, since reading that
    // inbox is also what proves the account is theirs. Confirming signs them
    // in, and /koble-feide then attaches Feide to that session — which is what
    // rescues a member whose stored username never matched their NTNU one.
    const verificationMutation = useMutation(
        sendVerificationEmailMutationOptions,
    );
    const helpMutation = useMutation(requestAccountLinkHelpMutation);

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
    const emailNotVerified =
        signInMutation.error instanceof AuthError &&
        signInMutation.error.code === "EMAIL_NOT_VERIFIED";

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
                        registering={feideLoading}
                        onRegisterAsNew={() =>
                            handleFeideSignIn({ requestSignUp: true })
                        }
                        onSendVerification={(email) =>
                            verificationMutation.mutate({
                                email,
                                // Confirming signs them in, so send them
                                // straight to the step that needs a session.
                                callbackURL: feideLinkCallbackUrl(redirectTo),
                            })
                        }
                        verificationSending={verificationMutation.isPending}
                        verificationSent={verificationMutation.isSuccess}
                        // The endpoint answers 200 whether or not the address
                        // exists, so a failure here is never "wrong address" —
                        // it is the request itself not getting through. Say
                        // only that, rather than guessing at a cause.
                        verificationError={
                            verificationMutation.isError
                                ? "Fikk ikke sendt lenken. Prøv igjen."
                                : undefined
                        }
                        onTryAnotherEmail={() => verificationMutation.reset()}
                        onRequestHelp={(data) => helpMutation.mutate({ data })}
                        helpSending={helpMutation.isPending}
                        helpSent={helpMutation.isSuccess}
                        helpError={helpMutation.error?.message}
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

                        {signInMutation.isError && !emailNotVerified && (
                            <p className="text-sm text-destructive">
                                {signInMutation.error.message}
                            </p>
                        )}

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

            {emailNotVerified && (
                <EmailVerificationPrompt
                    sent={verificationMutation.isSuccess}
                    sending={verificationMutation.isPending}
                    error={verificationMutation.isError}
                    onSend={(email) =>
                        verificationMutation.mutate({
                            email,
                            // Via /koble-feide, not straight to redirectTo:
                            // whoever hits this needs a password to sign in,
                            // which is the population that never synced with
                            // Feide. Confirming signs them in, so this is the
                            // one moment we hold a session and can attach
                            // Feide to *this* account. That page sends them on
                            // to `next` either way — it detects an existing
                            // link, and offers a way past for members who
                            // cannot use Feide at all.
                            callbackURL: feideLinkCallbackUrl(redirectTo),
                        })
                    }
                />
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

function EmailVerificationPrompt({
    sent,
    sending,
    error,
    onSend,
}: {
    sent: boolean;
    sending: boolean;
    error: boolean;
    onSend: (email: string) => void;
}) {
    const [email, setEmail] = useState("");

    return (
        <div className="px-6">
            <Alert>
                <AlertTitle>E-posten din er ikke bekreftet</AlertTitle>
                <AlertDescription>
                    {sent
                        ? "Sjekk innboksen din for en ny bekreftelseslenke."
                        : "Skriv inn e-postadressen din for å få en ny bekreftelseslenke."}
                </AlertDescription>
                {!sent && (
                    <form
                        className="mt-3 flex flex-col gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            onSend(email.trim());
                        }}
                    >
                        <Input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="din@epost.no"
                            aria-label="E-postadresse"
                            autoComplete="email"
                            required
                        />
                        <Button type="submit" disabled={sending}>
                            {sending ? (
                                <>
                                    <Spinner />
                                    <span>Sender...</span>
                                </>
                            ) : (
                                "Send ny bekreftelses-e-post"
                            )}
                        </Button>
                        {error && (
                            <p className="text-sm text-destructive">
                                Fikk ikke sendt lenken. Prøv igjen.
                            </p>
                        )}
                    </form>
                )}
            </Alert>
        </div>
    );
}
