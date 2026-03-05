import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "~/components/layout/page";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

export const Route = createFileRoute("/_main/tilbakemelding")({
    component: FeedbackPage,
});

function FeedbackPage() {
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        toast.success("Tilbakemelding sendt!");
    };

    return (
        <Page className="max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle className="font-heading text-2xl">
                        Tilbakemelding
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Gi oss tilbakemelding på nettsiden eller TIHLDE generelt
                    </p>
                </CardHeader>
                <CardContent>
                    {submitted ? (
                        <p className="text-center text-muted-foreground">
                            Takk for din tilbakemelding!
                        </p>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="feedback">
                                    Din tilbakemelding
                                </Label>
                                <Textarea
                                    id="feedback"
                                    rows={6}
                                    required
                                    placeholder="Skriv din tilbakemelding her..."
                                />
                            </div>
                            <Button type="submit">Send</Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </Page>
    );
}
