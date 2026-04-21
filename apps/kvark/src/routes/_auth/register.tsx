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

export const Route = createFileRoute("/_auth/register")({
    component: RegisterPage,
});

function RegisterPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Opprett bruker</CardTitle>
                <CardDescription>
                    Opprett en konto for å delta på arrangementer.
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent>
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="name">Navn</FieldLabel>
                            <Input
                                id="name"
                                autoComplete="name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </Field>
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
                            <FieldLabel htmlFor="password">Passord</FieldLabel>
                            <Input
                                id="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="confirm">
                                Bekreft passord
                            </FieldLabel>
                            <Input
                                id="confirm"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                            />
                        </Field>
                    </FieldGroup>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button type="submit" className="w-full">
                        Opprett bruker
                    </Button>
                    <p className="text-sm text-muted-foreground">
                        Har du allerede konto?{" "}
                        <Link
                            to="/login"
                            className="underline underline-offset-4"
                        >
                            Logg inn
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
