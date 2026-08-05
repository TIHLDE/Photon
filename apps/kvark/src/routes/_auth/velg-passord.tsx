import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
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
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Spinner } from "@tihlde/ui/ui/spinner";

import { authQueryOptions, sanitizeRedirectTo } from "#/api/auth";
import { setPasswordMutation } from "#/api/queries/password";
import { formHandlers, useAppForm } from "#/hooks/form";

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
 * Skipping is a first-class answer: Feide alone is a perfectly good login, and
 * the reset flow can add a password later.
 */
export const Route = createFileRoute("/_auth/velg-passord")({
    component: ChoosePasswordPage,
    validateSearch: z.object({ redirectTo: z.string().optional() }),
});

const choosePasswordSchema = z
    .object({
        password: z
            .string()
            .min(8, { error: "Passordet må være minst 8 tegn" }),
        confirmPassword: z.string(),
    })
    .superRefine((value, ctx) => {
        if (value.password !== value.confirmPassword) {
            ctx.addIssue({
                code: "custom",
                message: "Passordene er ikke like",
                path: ["confirmPassword"],
            });
            return z.NEVER;
        }
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
    const { redirectTo } = Route.useSearch();
    const { data: auth } = useSuspenseQuery(authQueryOptions);
    const mutation = useMutation(setPasswordMutation);

    // Hard navigation, as after a normal login: this page is reached by a
    // redirect from the backend callback, so the router state behind it is
    // whatever the login page left there.
    const leave = () => {
        window.location.href = sanitizeRedirectTo(redirectTo ?? "/");
    };

    const form = useAppForm({
        validators: {
            onChange: choosePasswordSchema,
            onSubmit: choosePasswordSchema,
        },
        defaultValues: {
            password: "",
            confirmPassword: "",
        },
        async onSubmit({ value }) {
            await mutation.mutateAsync({ newPassword: value.password });
            leave();
        },
    });

    const username = auth?.user.username;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Vil du også kunne logge inn med passord?</CardTitle>
                <CardDescription>
                    {username
                        ? `Brukernavnet ditt er ${username}. Velg et passord, så kommer du inn selv om Feide er nede.`
                        : "Velg et passord, så kommer du inn selv om Feide er nede."}
                </CardDescription>
            </CardHeader>
            <form {...formHandlers(form)} className="flex flex-col gap-4">
                <CardContent className="flex flex-col gap-5">
                    <FieldGroup>
                        <form.AppField name="password">
                            {(field) => (
                                <field.PasswordField
                                    label="Passord"
                                    required
                                    autoComplete="new-password"
                                />
                            )}
                        </form.AppField>
                        <form.AppField name="confirmPassword">
                            {(field) => (
                                <field.PasswordField
                                    label="Bekreft passord"
                                    required
                                    autoComplete="new-password"
                                />
                            )}
                        </form.AppField>
                    </FieldGroup>

                    <form.AppForm>
                        <form.FormErrors />
                    </form.AppForm>

                    {mutation.isError && (
                        <p className="text-sm text-destructive">
                            {mutation.error.message}
                        </p>
                    )}

                    <form.AppForm>
                        <form.SubmitButton
                            className="w-full"
                            loading={
                                <>
                                    <Spinner />
                                    <span>Lagrer...</span>
                                </>
                            }
                        >
                            Lagre passord
                        </form.SubmitButton>
                    </form.AppForm>
                </CardContent>
                <CardFooter className="justify-center">
                    <Button type="button" variant="link" onClick={leave}>
                        Hopp over
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
