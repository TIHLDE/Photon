import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { createContext, useContext, useMemo } from "react";

import { authQueryOptions } from "#/api/auth";
import {
    getGroupBySlugQuery,
    getGroupLawsQuery,
    getGroupMembersQuery,
} from "#/api/queries/groups";
import {
    useIsGroupLeaderOf,
    usePermission,
    useScopedPermission,
} from "#/hooks/use-permission";
import { mapGroup, mapLaw, mapMember, sortMembersByName } from "#/lib/group";

export function useGroupData() {
    const { slug } = useParams({ from: "/_app/grupper/$slug" });

    const { data: apiGroup } = useSuspenseQuery(getGroupBySlugQuery(slug));

    const { data: session } = useSuspenseQuery(authQueryOptions);

    const { data: apiMembers } = useQuery(getGroupMembersQuery(slug, 0));

    const isLeader = useIsGroupLeaderOf(slug);

    const isArchived = Boolean(apiGroup.archivedAt);

    // Roster changes: `groups:manage` for this group, or being its leader.
    // Det samme gjelder å gi ledervervet videre — men «Legg til medlem»-veien
    // legger fortsatt bare til vanlige medlemmer, slik API-et krever.
    const hasGroupsManage = useScopedPermission(
        "groups:manage",
        `group:${slug}`,
    );

    const canArchive = hasGroupsManage || isLeader;

    const isRoot = usePermission("root");

    // Bøter følger medlemskap, ikke tilganger: er du med i gruppen ser du alt
    // gruppen har gitt hverandre.
    //
    // Selve avgjørelsen tas på serveren og kommer som `viewerCanUseFines`. Den
    // dekker både at gruppen faktisk bruker botsystemet og at et medlemskap i
    // en studiegruppe ikke er nok i seg selv — der er medlemslista en
    // Feide-projeksjon som aldri krymper, så alumni står oppført sammen med
    // dagens studenter. Root er ikke med i serverens svar (den gjelder én
    // gruppe, ikke tilgang på tvers), så den legges på her.
    const canViewFines = Boolean(apiGroup.viewerCanUseFines) || isRoot;

    // Den som har gått ut av gruppen tar ikke lenger del i botsystemet, men
    // bøtene i eget navn — gitt og mottatt — er fortsatt deres å slå opp.
    // Serveren snevrer botlista til dem av seg selv; her styrer flagget bare
    // hva som vises, og at ingenting kan endres.
    const canSeeOwnFines =
        !canViewFines && Boolean(apiGroup.viewerCanSeeOwnFines);

    const finesTabVisible = canViewFines || canSeeOwnFines;

    const isLoggedIn = Boolean(session);

    const { data: apiLaws } = useQuery({
        ...getGroupLawsQuery(slug),
        enabled: canViewFines,
    });

    const members = useMemo(
        () => sortMembersByName((apiMembers ?? []).map(mapMember)),
        [apiMembers],
    );

    const isInterestGroup = apiGroup.type.toUpperCase() === "INTERESTGROUP";

    const leaders = useMemo(
        () => members.filter((m) => m.role === "leader"),
        [members],
    );

    const group = useMemo(
        () => mapGroup(apiGroup, leaders[0]?.name),
        [apiGroup, leaders],
    );

    const laws = useMemo(() => (apiLaws ?? []).map(mapLaw), [apiLaws]);
    return {
        apiMembers,
        group,
        leaders,
        members,
        slug,
        canArchive,
        isArchived,
        isInterestGroup,
        canSeeOwnFines,
        canViewFines,
        session,
        apiGroup,
        isLeader,
        isRoot,
        laws,
        finesTabVisible,
        isLoggedIn,
    };
}

export const GroupDetailContext = createContext<ReturnType<
    typeof useGroupData
> | null>(null);

export function useGroupDetail() {
    const context = useContext(GroupDetailContext);
    if (!context) throw new Error("Group route requires its layout");
    return context;
}
