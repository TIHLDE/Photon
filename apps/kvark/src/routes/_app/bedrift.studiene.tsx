import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";

import { StudyProgrammeCard } from "#/components/study-programme-card";
import { STUDY_PROGRAMMES, TIHLDE_DESCRIPTION } from "#/data/company";

export const Route = createFileRoute("/_app/bedrift/studiene")({
    component: StudiesPage,
});

function StudiesPage() {
    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-16">
            <section className="flex flex-col gap-8 md:flex-row md:items-center">
                <div className="flex flex-col gap-4 md:w-1/2">
                    <h1 className="text-4xl md:text-5xl">Om TIHLDE</h1>
                    <p className="text-muted-foreground">
                        {TIHLDE_DESCRIPTION}
                    </p>
                </div>
                <div className="md:w-1/2">
                    <img
                        src="/bedrift/tihlde.webp"
                        alt="TIHLDE"
                        className="h-auto w-full rounded-lg object-cover"
                    />
                </div>
            </section>

            <section className="flex flex-col gap-4">
                <h2 className="text-3xl md:text-4xl">Studiene</h2>
                <div className="flex flex-col gap-4">
                    {STUDY_PROGRAMMES.map((programme) => (
                        <StudyProgrammeCard
                            key={programme.title}
                            title={programme.title}
                            description={programme.description}
                        />
                    ))}
                </div>
            </section>

            <section className="flex flex-col items-center gap-4 text-center">
                <h2 className="text-3xl md:text-4xl">Ta kontakt med oss</h2>
                <p className="max-w-xl text-muted-foreground">
                    Bedrifter kan ta kontakt med oss for å få mer informasjon om
                    hva vi tilbyr og hvordan vi kan hjelpe dem med å nå ut til
                    våre medlemmer.
                </p>
                <Button
                    size="lg"
                    className="mt-2"
                    render={<Link to="/bedrift" hash="kontakt" />}
                >
                    Kontakt oss
                </Button>
            </section>
        </div>
    );
}
