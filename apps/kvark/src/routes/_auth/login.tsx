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

import { signInEmailMutationOptions } from "#/api/auth";
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
    email: z.email({ error: "Ugyldig e-post" }),
    password: z.string().min(1, { error: "Passord kan ikke være tom" }),
});

function LoginPage() {
    const { redirectTo } = Route.useSearch();

    const signInMutation = useMutation(signInEmailMutationOptions);

    const form = useAppForm({
        validators: {
            onChange: loginSchema,
            onSubmit: loginSchema,
        },
        defaultValues: {
            email: "",
            password: "",
        },
        async onSubmit({ value }) {
            const data = await signInMutation.mutateAsync({
                email: value.email,
                password: value.password,
            });

            // If we came from an OAuth authorize redirect, the server's after-hook
            // runs authorizeEndpoint and overrides the response with a redirect URL.
            if ("url" in data && data.url) {
                window.location.href = data.url;
                return;
            }

            // Hard navigation so the search params (and any stale state) are dropped.
            window.location.href = redirectTo ?? "/";
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
