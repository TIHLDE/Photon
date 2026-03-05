import { createFileRoute } from "@tanstack/react-router";
import { Page } from "~/components/layout/page";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export const Route = createFileRoute("/_main/bedrifter")({
    component: CompanyPage,
});

function CompanyPage() {
    return (
        <Page className="max-w-3xl">
            <div className="space-y-8">
                <header className="space-y-2">
                    <h1 className="font-heading text-4xl font-bold">
                        For bedrifter
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Samarbeid med TIHLDE og nå ut til fremtidens
                        IT-spesialister
                    </p>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Bedriftspresentasjon</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <p>
                            En bedriftspresentasjon er en fin måte å presentere
                            bedriften for studentene. Dere får mulighet til å
                            fortelle om bedriften, vise frem prosjekter, og møte
                            potensielle fremtidige ansatte.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Stillingsannonser</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <p>
                            Publiser stillingsannonser på vår side og nå ut til
                            studenter som studerer datateknikk og IT.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Kontakt oss</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <p>
                            Ta kontakt med næringsliv-ansvarlig for å høre mer
                            om mulighetene.
                        </p>
                        <a href="/interesse">
                            <Button>Send interesseskjema</Button>
                        </a>
                    </CardContent>
                </Card>
            </div>
        </Page>
    );
}
