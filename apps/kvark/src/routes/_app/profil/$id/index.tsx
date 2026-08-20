import { authQueryOptions, sessionHasScopedPermission } from "#/api/auth";
import {
    getActiveContractQuery,
    getMySignatureQuery,
} from "#/api/queries/contracts";
import { getMyUpcomingEventsQuery } from "#/api/queries/events";
import { getUserProfileQuery } from "#/api/queries/user";
import { ProfileLinksSection } from "#/components/profile-links-section";
import { ProfileMembershipChips } from "#/components/profile-membership-chips";
import { ProfileOverviewHeader } from "#/components/profile-overview-header";
import { ProfileUpcomingEvents } from "#/components/profile-upcoming-events";
import type { ProfileLink } from "#/components/profile-header";
import { isPrivateGroupType } from "#/lib/group";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
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
import { FileSignature, ListTodo, UtensilsCrossed } from "lucide-react";

export const Route = createFileRoute("/_app/profil/$id/")({
    component: RouteComponent,
});

/** Grupper som ikke er reelle medlemskap — de er avledet av Feide-dataene. */
const DERIVED_GROUP_TYPES = ["study", "studyyear", "tihlde"];

function RouteComponent() {
    const { id } = Route.useParams();
    const { data: profile } = useSuspenseQuery(getUserProfileQuery(id));
    const { data: session } = useQuery(authQueryOptions);
    const isOwnProfile = session?.user.id === profile.id;

    // Kontraktbanneret gjelder bare egen profil, så begge kallene hoppes over
    // på andres. Begge nøklene deles med /kontrakt, så signeringen der
    // invaliderer banneret her uten et ekstra kall.
    // Egne påmeldinger, så listen hentes bare på egen profil.
    const { data: upcomingEvents, isPending: isUpcomingPending } = useQuery({
        ...getMyUpcomingEventsQuery(),
        enabled: isOwnProfile,
    });

    const { data: activeContract } = useQuery({
        ...getActiveContractQuery(),
        enabled: isOwnProfile,
    });
    const { data: mySignature } = useQuery({
        ...getMySignatureQuery(),
        enabled: isOwnProfile,
    });

    const links: ProfileLink[] = [];
    if (profile.githubUrl)
        links.push({ kind: "github", label: "GitHub", url: profile.githubUrl });
    if (profile.linkedinUrl)
        links.push({
            kind: "linkedin",
            label: "LinkedIn",
            url: profile.linkedinUrl,
        });

    const memberships = profile.groups.filter(
        (g) => !DERIVED_GROUP_TYPES.includes(g.type.toLowerCase()),
    );

    /**
     * Om den som ser på kan åpne gruppesiden. Speiler `assertGroupVisible` i
     * API-et — samme regel som medlemskapsfanen bruker. Uten dette ville
     * chipsene lenket private grupper rett i en 403.
     */
    const canOpenGroup = (group: { slug: string; type: string }): boolean => {
        if (!isPrivateGroupType(group.type)) return true;
        if (session?.groups?.some((g) => g.slug === group.slug)) return true;
        return sessionHasScopedPermission(
            session?.permissions,
            "groups:manage",
            `group:${group.slug}`,
        );
    };

    const membershipDescription =
        memberships.length > 0
            ? `${memberships.length} ${memberships.length === 1 ? "gruppe" : "grupper"}`
            : isOwnProfile
              ? "Du er ikke medlem i noen grupper"
              : "Ikke medlem i noen grupper";

    return (
        <>
            <ProfileOverviewHeader
                name={profile.name}
                isOwnProfile={isOwnProfile}
            />
            {profile.bio ? (
                <div className="flex flex-col gap-2">
                    <h3 className="text-xs text-muted-foreground">Om</h3>
                    <p className="whitespace-pre-line text-sm">{profile.bio}</p>
                </div>
            ) : null}
            <ProfileLinksSection links={links} />
            {isOwnProfile ? (
                <>
                    <ContractBanner
                        hasActiveContract={Boolean(activeContract)}
                        signature={mySignature}
                    />
                    <AllergyBanner
                        hasAnswered={
                            session?.user.settings?.allergiesConfirmedAt != null
                        }
                    />
                </>
            ) : null}

            {/* Gruppene vises direkte i stedet for et telle-kort. Kortet så
                klikkbart ut uten å være det, og på andres profil var det alt
                sidens innhold besto av. */}
            <div className="flex flex-col gap-3">
                <h3>Medlemskap</h3>
                {memberships.length > 0 ? (
                    <ProfileMembershipChips
                        groups={memberships.map((group) => ({
                            slug: group.slug,
                            name: group.name,
                            canOpen: canOpenGroup(group),
                        }))}
                    />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {membershipDescription}
                    </p>
                )}
            </div>

            {/* Kommende arrangementer og oppgaver er personlige og vises kun på
                egen profil. */}
            {isOwnProfile ? (
                <>
                    <div className="flex flex-col gap-3">
                        <h3>Kommende</h3>
                        <ProfileUpcomingEvents
                            events={upcomingEvents ?? []}
                            isPending={isUpcomingPending}
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <h3>Må gjøres</h3>
                        <Empty>
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <ListTodo />
                                </EmptyMedia>
                                <EmptyTitle>Ingenting å gjøre</EmptyTitle>
                                <EmptyDescription>
                                    Oppgaver som spørreskjemaer og evalueringer
                                    dukker opp her.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    </div>
                </>
            ) : null}
        </>
    );
}

/**
 * Vises til allergispørsmålet er besvart.
 *
 * Prikken i headeren peker hit, og et merke uten forklaring er bare irritasjon
 * — så det er her det står hva som mangler og hvor man svarer. Forsvinner også
 * når svaret er «jeg har ingen»: det er et svar, ikke en tom liste.
 */
function AllergyBanner({ hasAnswered }: { hasAnswered: boolean }) {
    if (hasAnswered) return null;

    return (
        <Alert>
            <UtensilsCrossed className="size-4" />
            <AlertTitle>Du har ikke sagt om du har allergier</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
                <span>
                    Arrangørene bruker svaret når de bestiller mat. Har du
                    ingen, tar det ett trykk.
                </span>
                <Button
                    size="sm"
                    variant="outline"
                    render={
                        <Link
                            to="/profil/$id/innstillinger"
                            params={{ id: "me" }}
                        />
                    }
                >
                    Svar nå
                </Button>
            </AlertDescription>
        </Alert>
    );
}

/**
 * Vises bare når det finnes en aktiv kontrakt som ikke er signert. Uten
 * `signature` er statusen fortsatt ukjent — da sier vi ingenting, framfor å
 * påstå at den ikke er signert.
 */
function ContractBanner({
    hasActiveContract,
    signature,
}: {
    hasActiveContract: boolean;
    signature: SignatureStatus | undefined;
}) {
    if (!hasActiveContract) return null;
    if (!signature || signature.hasSigned) return null;

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
                    render={<Link to="/kontrakt" />}
                >
                    Gå til kontrakt
                </Button>
            </AlertDescription>
        </Alert>
    );
}
