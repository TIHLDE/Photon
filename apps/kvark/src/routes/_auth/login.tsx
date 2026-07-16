import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";

import { loginUser } from "#/api/auth";

type LoginSearch = {
    redirectTo?: string;
};

export const Route = createFileRoute("/_auth/login")({
    component: LoginPage,
    validateSearch: (search: Record<string, unknown>): LoginSearch => ({
        redirectTo:
            typeof search.redirectTo === "string"
                ? search.redirectTo
                : undefined,
    }),
});

function LoginPage() {
    const navigate = useNavigate();
    const { redirectTo } = Route.useSearch();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setIsPending(true);
        try {
            await loginUser(username, password);
            await navigate({ to: redirectTo ?? "/" });
        } catch {
            setError("Feil brukernavn eller passord.");
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Logg inn</CardTitle>
                <CardDescription>
                    Velkommen tilbake. Logg inn på kontoen din.
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent>
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="username">
                                Brukernavn
                            </FieldLabel>
                            <Input
                                id="username"
                                type="text"
                                autoComplete="username"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </Field>
                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="password">
                                    Passord
                                </FieldLabel>
                                <Link
                                    to="/forgot-password"
                                    className="text-sm underline underline-offset-4"
                                >
                                    Glemt passord?
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </Field>
                        {error ? <FieldError>{error}</FieldError> : null}
                    </FieldGroup>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={isPending}
                    >
                        {isPending ? "Logger inn …" : "Logg inn"}
                    </Button>
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
            </form>
        </Card>
    );
}
