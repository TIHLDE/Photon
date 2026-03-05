import { createFileRoute } from "@tanstack/react-router";
import { Page } from "~/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export const Route = createFileRoute("/_main/ny-student")({
    component: NewStudentPage,
});

function NewStudentPage() {
    return (
        <Page className="max-w-3xl">
            <div className="space-y-8">
                <header className="space-y-2">
                    <h1 className="font-heading text-4xl font-bold">
                        Ny student?
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Velkommen til TIHLDE! Her finner du alt du trenger for å
                        komme i gang.
                    </p>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Hva er TIHLDE?</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        <p>
                            TIHLDE er linjeforeningen for Databehandling,
                            Digital infrastruktur og cybersikkerhet, Digital
                            forretningsutvikling, og Drift av datasystemer og
                            tjenester ved NTNU. Vi arrangerer sosiale og faglige
                            arrangementer for våre medlemmer.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Bli medlem</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        <p>
                            For å bli medlem av TIHLDE trenger du bare å
                            registrere deg med Feide. Da får du tilgang til alle
                            arrangementer og tjenester.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Grupper og komiteer</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        <p>
                            TIHLDE har mange undergrupper og komiteer du kan
                            engasjere deg i. Sjekk ut{" "}
                            <a
                                href="/grupper"
                                className="text-primary hover:underline"
                            >
                                gruppene våre
                            </a>{" "}
                            for å finne noe som passer for deg.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </Page>
    );
}
