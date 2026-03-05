import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

export const Route = createFileRoute("/interesse")({
    component: InterestFormPage,
});

function InterestFormPage() {
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        toast.success("Interesseskjema sendt!");
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Toaster position="bottom-right" richColors />
            <Card className="w-full max-w-lg">
                <CardHeader className="text-center">
                    <h1 className="font-display text-2xl font-bold uppercase tracking-wider">
                        TIHLDE
                    </h1>
                    <CardTitle className="font-heading text-xl">
                        Interesseskjema for bedrifter
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {submitted ? (
                        <div className="space-y-3 text-center">
                            <p className="text-lg font-medium">
                                Takk for din interesse!
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Vi tar kontakt så snart som mulig.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="company">Bedriftsnavn</Label>
                                <Input
                                    id="company"
                                    required
                                    placeholder="Bedriftsnavn AS"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="contact">Kontaktperson</Label>
                                <Input
                                    id="contact"
                                    required
                                    placeholder="Ola Nordmann"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="email">E-post</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    placeholder="kontakt@bedrift.no"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="message">Melding</Label>
                                <Textarea
                                    id="message"
                                    rows={4}
                                    placeholder="Fortell oss hva dere er interessert i..."
                                />
                            </div>
                            <Button type="submit" className="w-full">
                                Send
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
