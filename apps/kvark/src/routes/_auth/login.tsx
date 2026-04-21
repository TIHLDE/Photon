import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";

export const Route = createFileRoute("/_auth/login")({ component: LoginPage });

function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
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
                            <FieldLabel htmlFor="email">E-post</FieldLabel>
                            <Input
                                id="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
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
                    </FieldGroup>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button type="submit" className="w-full">
                        Logg inn
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
