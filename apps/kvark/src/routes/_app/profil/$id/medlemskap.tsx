import { authQueryOptions, sessionHasScopedPermission } from "#/api/auth";
import { getUserProfileQuery } from "#/api/queries/user";
import { ProfileMembershipCard } from "#/components/profile-membership-card";
import { groupTypeLabel, isPrivateGroupType } from "#/lib/group";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/profil/$id/medlemskap")({
    component: RouteComponent,
});

/**
 * Grupper man faktisk melder seg inn i. study/studyyear er projeksjoner av
 * Feide-data, og TIHLDE har alle medlemmer — ingen av dem er verv.
 * Typen er UPPERCASE i databasen.
 */
function isRealMembership(group: { type: string }): boolean {
    return !["study", "studyyear", "tihlde"].includes(group.type.toLowerCase());
}

/**
 * Perioden et avsluttet medlemskap varte, som årstall: «2023–2025», eller
 * bare «2024» når det både startet og sluttet samme år.
 */
function membershipPeriod(startedAt: string, endedAt: string): string {
    const from = new Date(startedAt).getFullYear();
    const to = new Date(endedAt).getFullYear();
    return from === to ? `${from}` : `${from}–${to}`;
}

function RouteComponent() {
    const { id } = Route.useParams();
    const { data: profile } = useSuspenseQuery(getUserProfileQuery(id));
    const { data: session } = useQuery(authQueryOptions);
    const isOwnProfile = session?.user.id === profile.id;

    /**
     * Om den som ser på kan åpne gruppesiden. Speiler `assertGroupVisible` i
     * API-et: en privat gruppe er bare for medlemmene, og `groups:manage` er
     * eneste vei inn utenfra. Uten dette lenker profilen til en 403.
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

    // study/studyyear er avledede grupper (projeksjon av Feide-data) og vises
    // ved profilbildet, ikke i medlemskapslisten. TIHLDE er ingen gruppe man
    // melder seg inn i – alle er med – så den skal heller ikke vises her.
    // Typen er UPPERCASE i DB.
    const memberships = profile.groups.filter(isRealMembership);
    // Samme filter på historikken: et kullbytte legger igjen en rad i
    // STUDYYEAR-gruppa man forlot, og «Tidligere: 2023-kullet» er ikke et verv.
    const formerMemberships = profile.formerGroups.filter(isRealMembership);

    if (memberships.length === 0 && formerMemberships.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <UserCircle2 />
                    </EmptyMedia>
                    <EmptyTitle>Ingen medlemskap</EmptyTitle>
                    <EmptyDescription>
                        {isOwnProfile
                            ? "Du er ikke medlem i noen grupper ennå."
                            : `${profile.name} er ikke medlem i noen grupper.`}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {memberships.length > 0 ? (
                <ul className="flex flex-col gap-3">
                    {memberships.map((group) => (
                        <li key={group.slug}>
                            <ProfileMembershipCard
                                slug={group.slug}
                                name={group.name}
                                typeLabel={groupTypeLabel(group.type)}
                                logoUrl={group.logoUrl}
                                role={group.role}
                                canOpen={canOpenGroup(group)}
                            />
                        </li>
                    ))}
                </ul>
            ) : null}

            {formerMemberships.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <h2 className="text-sm text-muted-foreground">
                        Tidligere medlemskap
                    </h2>
                    <ul className="flex flex-col gap-3">
                        {formerMemberships.map((group) => (
                            <li key={group.slug}>
                                <ProfileMembershipCard
                                    slug={group.slug}
                                    name={group.name}
                                    typeLabel={groupTypeLabel(group.type)}
                                    logoUrl={group.logoUrl}
                                    role={group.role}
                                    period={membershipPeriod(
                                        group.startedAt,
                                        group.endedAt,
                                    )}
                                    canOpen={canOpenGroup(group)}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </div>
    );
}
