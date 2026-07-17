import { Link, createFileRoute } from "@tanstack/react-router";
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

import { requestPasswordResetMutationOptions } from "#/api/auth";
import { formHandlers, useAppForm } from "#/hooks/form";

export const Route = createFileRoute("/_auth/forgot-password")({
    component: ForgotPasswordPage,
});

const forgotPasswordSchema = z.object({
    email: z.email({ error: "Ugyldig e-post" }),
});

function ForgotPasswordPage() {
    const requestResetMutation = useMutation(
        requestPasswordResetMutationOptions,
    );

    const form = useAppForm({
        validators: {
            onChange: forgotPasswordSchema,
            onSubmit: forgotPasswordSchema,
        },
        defaultValues: {
            email: "",
        },
        async onSubmit({ value }) {
            // redirectTo must be an absolute URL — Better Auth's originCheck
            // validates it against trustedOrigins.
            const redirectTo =
                typeof window !== "undefined"
                    ? `${window.location.origin}/reset-password`
                    : "/reset-password";

            await requestResetMutation.mutateAsync({
                email: value.email,
                redirectTo,
            });
        },
    });

    if (requestResetMutation.isSuccess) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Sjekk e-posten din</CardTitle>
                    <CardDescription>
                        Hvis kontoen finnes har vi sendt en
                        tilbakestillingslenke til {form.state.values.email}.
                        Lenken er gyldig i en kort periode.
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Glemt passord</CardTitle>
                <CardDescription>
                    Skriv inn e-posten din så sender vi deg en lenke for å
                    tilbakestille passordet.
                </CardDescription>
            </CardHeader>
            <form {...formHandlers(form)}>
                <CardContent>
                    <FieldGroup>
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
                                    <span>Sender...</span>
                                </>
                            }
                        >
                            Send lenke
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
