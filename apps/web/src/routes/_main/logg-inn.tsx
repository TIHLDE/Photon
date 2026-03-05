import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "~/components/layout/page";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { authClient } from "~/lib/auth";
import { authKeys } from "~/lib/queries/auth";

export const Route = createFileRoute("/_main/logg-inn")({
    component: LoginPage,
});

function LoginPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleFeideLogin = () => {
        authClient.signIn.social({
            provider: "feide",
            callbackURL: "/",
        });
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await authClient.signIn.username({
                username: email,
                password,
            });
            await queryClient.invalidateQueries({ queryKey: authKeys.all });
            navigate({ to: "/" });
        } catch {
            toast.error("Innlogging feilet. Sjekk brukernavn og passord.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Page className="flex items-center justify-center">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="font-heading text-2xl">
                        Logg inn
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button className="w-full" onClick={handleFeideLogin}>
                        Logg inn med Feide
                    </Button>

                    <div className="flex items-center gap-3">
                        <Separator className="flex-1" />
                        <span className="text-xs text-muted-foreground">
                            eller
                        </span>
                        <Separator className="flex-1" />
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="email">Brukernavn</Label>
                            <Input
                                id="email"
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ditt brukernavn"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="password">Passord</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="ditt passord"
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            variant="outline"
                            className="w-full"
                            disabled={loading}
                        >
                            {loading ? "Logger inn..." : "Logg inn"}
                        </Button>
                    </form>

                    <div className="text-center text-sm">
                        <a
                            href="/glemt-passord"
                            className="text-primary hover:underline"
                        >
                            Glemt passord?
                        </a>
                    </div>
                </CardContent>
            </Card>
        </Page>
    );
}
