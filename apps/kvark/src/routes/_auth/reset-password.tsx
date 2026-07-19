import { Link, createFileRoute } from "@tanstack/react-router";
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

import { changePasswordMutationOptions } from "#/api/auth";
import { formHandlers, useAppForm } from "#/hooks/form";
import { useMutation } from "@tanstack/react-query";

const searchSchema = z.object({
    token: z.string().optional(),
    error: z.string().optional(),
});

export const Route = createFileRoute("/_auth/reset-password")({
    component: ResetPasswordPage,
    validateSearch: searchSchema,
});

const resetPasswordSchema = z
    .object({
        password: z.string().min(1, { error: "Passord kan ikke være tom" }),
        confirmPassword: z.string(),
    })
    .superRefine((e, ctx) => {
        if (e.password !== e.confirmPassword) {
            ctx.addIssue({
                code: "custom",
                message: "Bekreft passord er ikke lik passord",
                path: ["confirmPassword"],
            });
            return z.NEVER;
        }
    });

function ResetPasswordPage() {
    const { token, error: tokenError } = Route.useSearch();

    const changePasswordMutation = useMutation(changePasswordMutationOptions);

    const form = useAppForm({
        validators: {
            onChange: resetPasswordSchema,
            onSubmit: resetPasswordSchema,
        },
        defaultValues: {
            password: "",
            confirmPassword: "",
        },
        async onSubmit({ value }) {
            if (!token) return;
            if (value.password !== value.confirmPassword) return;

            // TODO: Wrap async call in toast to show user feedback
            await changePasswordMutation.mutateAsync({
                newPassword: value.password,
                token,
            });
        },
    });

    if (tokenError || !token) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Ugyldig lenke</CardTitle>
                    <CardDescription>
                        Lenken er enten utløpt eller ugyldig. Be om en ny
                        tilbakestillingslenke for å fortsette.
                    </CardDescription>
                </CardHeader>
                <CardFooter>
                    <Link
                        to="/forgot-password"
                        className="text-sm underline underline-offset-4"
                    >
                        Be om ny lenke
                    </Link>
                </CardFooter>
            </Card>
        );
    }

    if (changePasswordMutation.isSuccess) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Passord oppdatert</CardTitle>
                    <CardDescription>
                        Du kan nå logge inn med ditt nye passord.
                    </CardDescription>
                </CardHeader>
                <CardFooter>
                    <Link
                        to="/login"
                        className="text-sm underline underline-offset-4"
                    >
                        Gå til innlogging
                    </Link>
                </CardFooter>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Velg nytt passord</CardTitle>
                <CardDescription>
                    Velg et nytt passord for kontoen din.
                </CardDescription>
            </CardHeader>
            <form {...formHandlers(form)}>
                <CardContent>
                    <FieldGroup>
                        <form.AppField name="password">
                            {(field) => (
                                <field.PasswordField
                                    label="Nytt passord"
                                    description="Skriv inn det nye passordet"
                                    required
                                    autoComplete="new-password"
                                />
                            )}
                        </form.AppField>
                        <form.AppField name="confirmPassword">
                            {(field) => (
                                <field.PasswordField
                                    label="Bekreft passord"
                                    description="Skriv inn samme passord på nytt"
                                    required
                                    autoComplete="new-password"
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
                            loading={
                                <>
                                    <Spinner />
                                    <span>Lagrer...</span>
                                </>
                            }
                        >
                            Sett nytt passord
                        </form.SubmitButton>
                    </form.AppForm>
                    <p className="text-sm text-muted-foreground">
                        <Link
                            to="/login"
                            className="underline underline-offset-4"
                        >
                            Tilbake til innlogging
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
