import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
    addGroupMemberMutation,
    getGroupFormerMembersQuery,
    removeGroupMemberMutation,
    updateGroupMemberRoleMutation,
} from "#/api/queries/groups";
import { searchUsersQuery } from "#/api/queries/roles";
import { GroupJoinRequestsPanel } from "#/components/group-join-requests-panel";
import { GroupMembersTab } from "#/components/group-members-tab";
import { extractErrorMessage } from "#/lib/api-error";
import { allowsNonMemberLeader, mapFormerMember } from "#/lib/group";
import { useDebounced } from "#/lib/use-debounced";

import { useGroupDetail } from "../-context";

/**
 * Et feilet søk skal ikke se ut som at ingen matcher — da leter man videre
 * etter en person som aldri ville dukket opp.
 */
const SEARCH_FAILED_MESSAGE = "Søket feilet. Prøv igjen.";

export const Route = createFileRoute("/_app/grupper/$slug/medlemmer/")({
    component: GroupMembersPage,
});

function GroupMembersPage() {
    const { leaders, members, slug, canArchive, isArchived, isInterestGroup } =
        useGroupDetail();

    const { data: apiFormerMembers } = useQuery(
        getGroupFormerMembersQuery(slug),
    );

    const updateMemberRole = useMutation(updateGroupMemberRoleMutation);

    const removeMember = useMutation(removeGroupMemberMutation);

    const addMember = useMutation(addGroupMemberMutation);

    const canManageMembers = canArchive && !isArchived;

    const regularMembers = useMemo(
        () => members.filter((m) => m.role !== "leader"),
        [members],
    );

    const formerMembers = useMemo(
        () => (apiFormerMembers ?? []).map(mapFormerMember),
        [apiFormerMembers],
    );

    // Brukersøk for «Legg til medlem». Søket er billig nok til å ligge her,
    // men vi venter til to tegn så vi ikke slår opp hele medlemsregisteret.
    const [memberQuery, setMemberQuery] = useState("");

    // API-ets egen melding er den nyttige ("Kan ikke legge til medlemmer i en
    // avledet gruppe"), men den må hentes ut av responsen asynkront.
    const [addMemberError, setAddMemberError] = useState<string | null>(null);

    const debouncedMemberQuery = useDebounced(memberQuery);

    const {
        data: memberSearchResults,
        isFetching: isSearchingMembers,
        error: memberSearchFailure,
    } = useQuery({
        // Gruppen sendes med så lederen selv kan søke: uten den svarer API-et
        // 403 for alle uten `users:view`, og en tom liste ser ut som at
        // personen ikke finnes.
        ...searchUsersQuery(debouncedMemberQuery, slug),
        enabled: debouncedMemberQuery.length >= 2,
    });

    // Den som allerede er med skal ikke kunne legges til på nytt — API-et
    // svarer 400, og det er en dårligere forklaring enn å utelate treffet.
    const addableUsers = useMemo(
        () =>
            (memberSearchResults ?? []).filter(
                (user) => !members.some((m) => m.id === user.id),
            ),
        [memberSearchResults, members],
    );

    // Eget søk for lederoverføring i HS: presidenten er ikke medlem ennå, så
    // her filtreres ingen bort — bare den som allerede er leder.
    const canPickLeaderOutsideGroup = allowsNonMemberLeader(slug);

    const [leaderQuery, setLeaderQuery] = useState("");

    const [leaderError, setLeaderError] = useState<string | null>(null);

    const debouncedLeaderQuery = useDebounced(leaderQuery);

    const {
        data: leaderSearchResults,
        isFetching: isSearchingLeader,
        error: leaderSearchFailure,
    } = useQuery({
        ...searchUsersQuery(debouncedLeaderQuery, slug),
        enabled: canPickLeaderOutsideGroup && debouncedLeaderQuery.length >= 2,
    });

    const leaderCandidates = useMemo(
        () =>
            (leaderSearchResults ?? []).filter(
                (user) => !leaders.some((m) => m.id === user.id),
            ),
        [leaderSearchResults, leaders],
    );

    return (
        <GroupMembersTab
            leaders={leaders}
            members={regularMembers}
            formerMembers={formerMembers}
            isAdmin={canManageMembers}
            canPromote={canManageMembers}
            joinRequests={
                canManageMembers && isInterestGroup ? (
                    <GroupJoinRequestsPanel groupSlug={slug} />
                ) : null
            }
            leaderTransfer={
                canManageMembers && canPickLeaderOutsideGroup
                    ? {
                          copy: {
                              trigger: "Overfør",
                              title: "Overfør lederverv",
                              description:
                                  "Den nye lederen legges til i gruppen om hen ikke er medlem. Avtroppende leder mister plassen med mindre et verv gir den.",
                              submit: "Overfør lederverv",
                              submitting: "Overfører …",
                          },
                          query: leaderQuery,
                          onQueryChange: setLeaderQuery,
                          results: leaderCandidates,
                          isSearching: isSearchingLeader,
                          isAdding: updateMemberRole.isPending,
                          error:
                              leaderError ??
                              (leaderSearchFailure
                                  ? SEARCH_FAILED_MESSAGE
                                  : null),
                          onAdd: async (userId) => {
                              setLeaderError(null);
                              try {
                                  await updateMemberRole.mutateAsync({
                                      groupSlug: slug,
                                      userId,
                                      data: {
                                          role: "leader",
                                      },
                                  });
                              } catch (error) {
                                  setLeaderError(
                                      await extractErrorMessage(error),
                                  );
                                  throw error;
                              }
                          },
                      }
                    : undefined
            }
            memberSearch={{
                query: memberQuery,
                onQueryChange: setMemberQuery,
                results: addableUsers,
                isSearching: isSearchingMembers,
                isAdding: addMember.isPending,
                error:
                    addMemberError ??
                    (memberSearchFailure ? SEARCH_FAILED_MESSAGE : null),
                onAdd: async (userId) => {
                    setAddMemberError(null);
                    try {
                        await addMember.mutateAsync({
                            groupSlug: slug,
                            data: { userId, role: "member" },
                        });
                    } catch (error) {
                        setAddMemberError(await extractErrorMessage(error));
                        throw error;
                    }
                },
            }}
            onPromote={(member) =>
                updateMemberRole.mutate({
                    groupSlug: slug,
                    userId: member.id,
                    data: { role: "leader" },
                })
            }
            onRemove={(member) =>
                removeMember.mutate({
                    groupSlug: slug,
                    userId: member.id,
                })
            }
        />
    );
}
