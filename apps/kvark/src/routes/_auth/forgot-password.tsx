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

export const Route = createFileRoute("/_auth/forgot-password")({
    component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
    const [email, setEmail] = useState("");

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
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
                    </FieldGroup>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button type="submit" className="w-full">
                        Send lenke
                    </Button>
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
