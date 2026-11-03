import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useRef, useState } from "react";
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
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Spinner } from "@tihlde/ui/ui/spinner";

import {
    authQueryOptions,
    sendPasswordSetupLinkMutationOptions,
    sanitizeRedirectTo,
} from "#/api/auth";
import { TurnstileChallenge } from "#/components/turnstile-challenge";
import { TURNSTILE_PASSWORD_RESET_ACTION } from "#/lib/turnstile";

/**
 * The step a member lands on the first time they sign in with Feide.
 *
 * Better Auth redirects a login that *created* the account to
 * `newUserCallbackURL` instead of the normal one, so this is the single moment
 * we can tell a first Feide login from every later one — see `signInWithFeide`.
 *
 * It exists because a Feide account has no password at all, and the login
 * page's fallback form asks for username and password. Without this the member
 * has exactly one way in, and nothing to fall back on the day Feide or
 * Dataporten is unavailable.
 *
 * The password itself is chosen through Better Auth's own reset flow: we mail
 * a link to the address on the account, and `/reset-password` creates the
 * credential. A signed-in session alone is never enough to add a password —
 * the link proves the inbox is theirs as well.
 *
 * Skipping is a first-class answer: Feide alone is a perfectly good login, and
 * the reset flow can add a password later.
 */
export const Route = createFileRoute("/_auth/velg-passord")({
    component: ChoosePasswordPage,
    validateSearch: z.object({
        redirectTo: z.string().optional(),
        /**
         * Set by the Feide callback when linking deleted an unproven password.
         * Only decides which copy to show — nothing here grants anything, so a
         * hand-typed value costs nothing.
         */
        passwordRevoked: z.coerce.boolean().optional(),
    }),
});

function ChoosePasswordPage() {
    return (
        <Suspense fallback={<ChoosePasswordSkeleton />}>
            <ChoosePasswordCard />
        </Suspense>
    );
}

function ChoosePasswordSkeleton() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <Skeleton className="h-6 w-48" />
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
    );
}

function ChoosePasswordCard() {
    const { redirectTo, passwordRevoked } = Route.useSearch();
    const { data: auth } = useSuspenseQuery(authQueryOptions);
    const mutation = useMutation(sendPasswordSetupLinkMutationOptions);
    const turnstileRef = useRef<TurnstileInstance>(undefined);
    const [captchaToken, setCaptchaToken] = useState<string>();

    // Hard navigation, as after a normal login: this page is reached by a
    // redirect from the backend callback, so the router state behind it is
    // whatever the login page left there.
    const leave = () => {
        window.location.href = sanitizeRedirectTo(redirectTo ?? "/");
    };

    const username = auth?.user.username;

    const sendLink = () => {
        // Absolute, because Better Auth checks it against trustedOrigins; the
        // destination rides along the same way the forgot-password page does.
        const resetPath = `/reset-password?redirectTo=${encodeURIComponent(
            sanitizeRedirectTo(redirectTo ?? "/"),
        )}`;
        mutation.mutate(
            {
                redirectTo: new URL(
                    resetPath,
                    window.location.origin,
                ).toString(),
                captchaToken,
            },
            {
                // A token is spent once Cloudflare has checked it, so a retry
                // needs a fresh one.
                onError: () => {
                    setCaptchaToken(undefined);
                    turnstileRef.current?.reset();
                },
            },
        );
    };

    if (mutation.isSuccess) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Sjekk e-posten din</CardTitle>
                    <CardDescription>
                        Vi har sendt en lenke til {mutation.data.email}. Åpne
                        den for å velge passord. Lenken er gyldig i en kort
                        periode.
                    </CardDescription>
                </CardHeader>
                <CardFooter className="justify-center">
                    <Button type="button" variant="link" onClick={leave}>
                        Fortsett
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                {/* Two different situations land here. Offering a password as
                    a bonus is right for an account that never had one, and
                    wrong for someone whose password was just deleted — for
                    them "hopp over" closes their only non-Feide way in, and
                    they would not know that. */}
                <CardTitle>
                    {passwordRevoked
                        ? "Velg et nytt passord"
                        : "Vil du også kunne logge inn med passord?"}
                </CardTitle>
                <CardDescription>
                    {passwordRevoked
                        ? `Det gamle passordet ble fjernet fordi e-posten på kontoen aldri ble bekreftet. Du er logget inn med Feide nå${username ? `, som ${username}` : ""}. Vi sender deg en lenke for å velge et nytt passord.`
                        : username
                          ? `Brukernavnet ditt er ${username}. Vi sender deg en lenke for å velge passord, så kommer du inn selv om Feide er nede.`
                          : "Vi sender deg en lenke for å velge passord, så kommer du inn selv om Feide er nede."}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <TurnstileChallenge
                    action={TURNSTILE_PASSWORD_RESET_ACTION}
                    turnstileRef={turnstileRef}
                    onToken={setCaptchaToken}
                />

                {mutation.isError && (
                    <p className="text-sm text-destructive">
                        {mutation.error.message}
                    </p>
                )}

                <Button
                    type="button"
                    className="w-full"
                    disabled={mutation.isPending}
                    onClick={sendLink}
                >
                    {mutation.isPending ? (
                        <>
                            <Spinner />
                            <span>Sender...</span>
                        </>
                    ) : (
                        "Send lenke"
                    )}
                </Button>
            </CardContent>
            {/* Skipping stays a first-class answer for an account that never
                had a password — Feide alone is a fine login. It is not one for
                an account whose password was just taken away: leaving without
                setting a new one is how someone ends up with Feide as their
                only way in, which is precisely what this page exists to
                prevent. The layout's nav bar is still there, so nobody is
                trapped. */}
            {!passwordRevoked && (
                <CardFooter className="justify-center">
                    <Button type="button" variant="link" onClick={leave}>
                        Hopp over
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
