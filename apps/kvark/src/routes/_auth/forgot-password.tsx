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

import {
    requestPasswordResetMutationOptions,
    sanitizeRedirectTo,
} from "#/api/auth";
import { formHandlers, useAppForm } from "#/hooks/form";

export const Route = createFileRoute("/_auth/forgot-password")({
    component: ForgotPasswordPage,
    // Destinasjonen brukeren var på vei til, videreført fra innloggingssiden.
    validateSearch: z.object({ redirectTo: z.string().optional() }),
});

const forgotPasswordSchema = z.object({
    email: z.email({ error: "Ugyldig e-post" }),
});

function ForgotPasswordPage() {
    const { redirectTo } = Route.useSearch();
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
            // validates it against trustedOrigins. Destinasjonen henges på som
            // søkeparameter: backend bygger lenka med `new URL(...)` og setter
            // bare `token`, så det som allerede står der overlever.
            const resetPath = redirectTo
                ? `/reset-password?redirectTo=${encodeURIComponent(sanitizeRedirectTo(redirectTo))}`
                : "/reset-password";
            const resetUrl =
                typeof window !== "undefined"
                    ? new URL(resetPath, window.location.origin).toString()
                    : resetPath;

            await requestResetMutation.mutateAsync({
                email: value.email,
                redirectTo: resetUrl,
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
                        search={{ redirectTo }}
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
            <form {...formHandlers(form)} className="flex flex-col gap-4">
                <CardContent className="flex flex-col gap-5">
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
                </CardContent>
                <CardFooter className="justify-center">
                    <p className="text-sm text-muted-foreground">
                        <Link
                            to="/login"
                            search={{ redirectTo }}
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
