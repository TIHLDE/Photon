import { authQueryOptions, sessionHasScopedPermission } from "#/api/auth";
import { getUnreadNotificationCountQuery } from "#/api/queries/notifications";
import { getUserProfileQuery } from "#/api/queries/user";
import { ProfileLinksSection } from "#/components/profile-links-section";
import { ProfileMembershipChips } from "#/components/profile-membership-chips";
import { ProfileOverviewHeader } from "#/components/profile-overview-header";
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
import { CalendarDays, FileSignature, ListTodo } from "lucide-react";

export const Route = createFileRoute("/_app/profil/$id/")({
    component: RouteComponent,
});

/** Grupper som ikke er reelle medlemskap — de er avledet av Feide-dataene. */
const DERIVED_GROUP_TYPES = ["study", "studyyear", "tihlde"];

function RouteComponent() {
    const { id } = Route.useParams();
    const { data: profile } = useSuspenseQuery(getUserProfileQuery(id));
    const { data: session } = useQuery(authQueryOptions);
    const isOwnProfile = session?.user.id === id;

    // Varselmerket vises bare på egen profil, så andres profiler skal heller
    // ikke koste et kall til det innloggede-scopede endepunktet.
    const { data: unreadNotifications } = useQuery({
        ...getUnreadNotificationCountQuery(),
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
                notifications={unreadNotifications}
            />
            {profile.bio ? (
                <div className="flex flex-col gap-2">
                    <h3 className="text-xs text-muted-foreground">OM</h3>
                    <p className="whitespace-pre-line text-sm">{profile.bio}</p>
                </div>
            ) : null}
            <ProfileLinksSection links={links} />
            {isOwnProfile ? <ContractBanner signature={null} /> : null}

            {/* Gruppene vises direkte i stedet for et telle-kort. Kortet så
                klikkbart ut uten å være det, og på andres profil var det alt
                sidens innhold besto av. */}
            <div className="flex flex-col gap-3">
                <h3>MEDLEMSKAP</h3>
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
                        <h3>KOMMENDE</h3>
                        <Empty>
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <CalendarDays />
                                </EmptyMedia>
                                <EmptyTitle>
                                    Ingen kommende arrangementer
                                </EmptyTitle>
                                <EmptyDescription>
                                    Påmeldingene dine vises her når du melder
                                    deg på et arrangement.
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
