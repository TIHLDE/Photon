import { authQueryOptions } from "#/api/auth";
import { ProfileLinksSection } from "#/components/profile-links-section";
import { ProfileOverviewHeader } from "#/components/profile-overview-header";
import { ProfileStatCard } from "#/components/profile-stat-card";
import type { ProfileLink } from "#/components/profile-header";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { SignatureStatus } from "@tihlde/sdk";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { CalendarDays, FileSignature, ListTodo } from "lucide-react";

export const Route = createFileRoute("/_app/profil/$id/")({
    component: RouteComponent,
});

function RouteComponent() {
    const { data: session } = useQuery(authQueryOptions);
    const settings = session?.user.settings;

    const links: ProfileLink[] = [];
    if (settings?.githubUrl) links.push({ kind: "github", label: "github" });
    if (settings?.linkedinUrl)
        links.push({ kind: "linkedin", label: "linkedin" });

    const groups = session?.groups ?? [];
    const membershipTitle = groups.length > 0 ? "Aktiv" : "Ingen medlemskap";
    const membershipDescription =
        groups.length > 0
            ? `${groups.length} ${groups.length === 1 ? "gruppe" : "grupper"}`
            : "Du er ikke medlem i noen grupper";

    return (
        <>
            <ProfileOverviewHeader
                name={session?.user.name ?? ""}
                notifications={0}
            />
            <ProfileLinksSection links={links} />
            <ContractBanner signature={null} />

            <div className="grid gap-4 md:grid-cols-3">
                <ProfileStatCard
                    label="MEDLEMSKAP"
                    title={membershipTitle}
                    description={membershipDescription}
                />
            </div>

            <div className="flex flex-col gap-3">
                <h3>KOMMENDE</h3>
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <CalendarDays />
                        </EmptyMedia>
                        <EmptyTitle>Ingen kommende arrangementer</EmptyTitle>
                        <EmptyDescription>
                            Påmeldingene dine vises her når du melder deg på et
                            arrangement.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </div>

            <div className="flex flex-col gap-3">
                <h3>MÅ GJØRES</h3>
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <ListTodo />
                        </EmptyMedia>
                        <EmptyTitle>Ingenting å gjøre</EmptyTitle>
                        <EmptyDescription>
                            Oppgaver som spørreskjemaer og evalueringer dukker
                            opp her.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </div>
        </>
    );
}

function ContractBanner({ signature }: { signature: SignatureStatus | null }) {
    if (signature?.hasSigned) return null;

    return (
        <Alert>
            <FileSignature className="size-4" />
            <AlertTitle>Frivillighetskontrakt ikke signert</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
                <span>
                    Du må signere frivillighetskontrakten for å bekrefte din
                    frivillighetsavtale.
                </span>
                <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link to="/kontrakt" />}
                >
                    Gå til kontrakt
                </Button>
            </AlertDescription>
        </Alert>
    );
}
