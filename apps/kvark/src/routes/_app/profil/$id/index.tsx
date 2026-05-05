import { ProfileEventRow } from "#/components/profile-event-row";
import { ProfileLinksSection } from "#/components/profile-links-section";
import { ProfileOverviewHeader } from "#/components/profile-overview-header";
import { ProfileStatCard } from "#/components/profile-stat-card";
import { ProfileTodoRow } from "#/components/profile-todo-row";
import { STATS, TODOS, UPCOMING, USER } from "#/mock/profile";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { SignatureStatus } from "@tihlde/sdk";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { FileSignature } from "lucide-react";

export const Route = createFileRoute("/_app/profil/$id/")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <>
            <ProfileOverviewHeader name={USER.name} notifications={2} />
            <ProfileLinksSection links={USER.links} />
            <ContractBanner signature={null} />

            <div className="grid gap-4 md:grid-cols-3">
                {STATS.map((stat) => (
                    <ProfileStatCard key={stat.label} {...stat} />
                ))}
            </div>

            <div className="flex flex-col gap-3">
                <h3>KOMMENDE</h3>
                <ul className="flex flex-col gap-3">
                    {UPCOMING.map((event) => (
                        // TODO: replace with a unique id field once wired up to the backend
                        <li key={event.title}>
                            <ProfileEventRow {...event} />
                        </li>
                    ))}
                </ul>
            </div>

            <div className="flex flex-col gap-3">
                <h3>MÅ GJØRES</h3>
                <ul className="flex flex-col gap-3">
                    {TODOS.map((todo) => (
                        // TODO: replace with a unique id field once wired up to the backend
                        <li key={todo.title}>
                            <ProfileTodoRow {...todo} />
                        </li>
                    ))}
                </ul>
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
