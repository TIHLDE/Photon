import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@tihlde/ui/ui/collapsible";
import { Alert, AlertDescription } from "@tihlde/ui/ui/alert";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import {
    addGroupMemberMutation,
    getGroupBySlugQuery,
    getGroupFormerMembersQuery,
    getGroupMembersQuery,
    removeGroupMemberMutation,
    updateGroupMemberRoleMutation,
} from "#/api/queries/groups";
import { searchUsersQuery } from "#/api/queries/roles";
import { GroupAddMemberDialog } from "#/components/group-add-member-dialog";
import { GroupJoinRequestsPanel } from "#/components/group-join-requests-panel";
import { GroupMemberRow } from "#/components/group-member-row";
import {
    useIsGroupLeaderOf,
    useScopedPermission,
} from "#/hooks/use-permission";
import { extractErrorMessage } from "#/lib/api-error";
import type { Member } from "#/lib/group";
import {
    allowsNonMemberLeader,
    mapFormerMember,
    mapMember,
    sortMembersByName,
} from "#/lib/group";
import { useDebounced } from "#/lib/use-debounced";
import { cn } from "#/lib/utils";

/**
 * Et feilet søk skal ikke se ut som at ingen matcher — da leter man videre
 * etter en person som aldri ville dukket opp.
 */
const SEARCH_FAILED_MESSAGE = "Søket feilet. Prøv igjen.";

export const Route = createFileRoute("/_app/grupper/$slug/medlemmer/")({
    component: GroupMembersPage,
});

function GroupMembersPage() {
    const { slug } = Route.useParams();

    const { data: apiGroup } = useSuspenseQuery(getGroupBySlugQuery(slug));

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

    const members = useMemo(
        () => sortMembersByName((apiMembers ?? []).map(mapMember)),
        [apiMembers],
    );

    const isInterestGroup = apiGroup.type.toUpperCase() === "INTERESTGROUP";

    const leaders = useMemo(
        () => members.filter((m) => m.role === "leader"),
        [members],
    );

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
    const [memberActionError, setMemberActionError] = useState<string | null>(
        null,
    );
    async function onPromote(member: Member) {
        setMemberActionError(null);
        try {
            await updateMemberRole.mutateAsync({
                groupSlug: slug,
                userId: member.id,
                data: { role: "leader" },
            });
        } catch (error) {
            setMemberActionError(await extractErrorMessage(error));
        }
    }
    async function onDemote(member: Member) {
        setMemberActionError(null);
        try {
            await updateMemberRole.mutateAsync({
                groupSlug: slug,
                userId: member.id,
                data: { role: "member" },
            });
        } catch (error) {
            setMemberActionError(await extractErrorMessage(error));
        }
    }
    // Speiler API-et: lederen kan bare sette ned en medleder i interessegrupper,
    // og ikke den siste lederen.
    const canDemoteLeaders =
        canManageMembers &&
        (hasGroupsManage || (isInterestGroup && leaders.length > 1));
    async function onRemove(member: Member) {
        setMemberActionError(null);
        try {
            await removeMember.mutateAsync({
                groupSlug: slug,
                userId: member.id,
            });
        } catch (error) {
            setMemberActionError(await extractErrorMessage(error));
        }
    }

    const [showFormer, setShowFormer] = useState(false);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl">{`Medlemmer (${leaders.length + regularMembers.length})`}</h2>
                <div className="flex flex-wrap items-center gap-2">
                    {canManageMembers && canPickLeaderOutsideGroup ? (
                        <GroupAddMemberDialog
                            copy={{
                                trigger: "Overfør",
                                title: "Overfør lederverv",
                                description:
                                    "Den nye lederen legges til i gruppen om hen ikke er medlem. Avtroppende leder mister plassen med mindre et verv gir den.",
                                submit: "Overfør lederverv",
                                submitting: "Overfører …",
                            }}
                            query={leaderQuery}
                            onQueryChange={setLeaderQuery}
                            results={leaderCandidates}
                            isSearching={isSearchingLeader}
                            isAdding={updateMemberRole.isPending}
                            error={
                                leaderError ??
                                (leaderSearchFailure
                                    ? SEARCH_FAILED_MESSAGE
                                    : null)
                            }
                            onAdd={async (userId) => {
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
                            }}
                        />
                    ) : null}
                    {canManageMembers ? (
                        <GroupAddMemberDialog
                            query={memberQuery}
                            onQueryChange={setMemberQuery}
                            results={addableUsers}
                            isSearching={isSearchingMembers}
                            isAdding={addMember.isPending}
                            error={
                                addMemberError ??
                                (memberSearchFailure
                                    ? SEARCH_FAILED_MESSAGE
                                    : null)
                            }
                            onAdd={async (userId) => {
                                setAddMemberError(null);
                                try {
                                    await addMember.mutateAsync({
                                        groupSlug: slug,
                                        data: { userId, role: "member" },
                                    });
                                } catch (error) {
                                    setAddMemberError(
                                        await extractErrorMessage(error),
                                    );
                                    throw error;
                                }
                            }}
                        />
                    ) : null}
                </div>
            </div>

            {canManageMembers && isInterestGroup ? (
                <GroupJoinRequestsPanel groupSlug={slug} />
            ) : null}

            {memberActionError ? (
                <Alert variant="destructive">
                    <AlertDescription>{memberActionError}</AlertDescription>
                </Alert>
            ) : null}
            {/* Lederen ligger øverst i samme liste som resten — badgen skiller den ut. */}
            <ul className="flex flex-col gap-2">
                {leaders.map((m) => (
                    <li key={m.id}>
                        <GroupMemberRow
                            member={m}
                            isLeader
                            onDemote={canDemoteLeaders ? onDemote : undefined}
                            onRemove={canManageMembers ? onRemove : undefined}
                        />
                    </li>
                ))}
                {regularMembers.map((m) => (
                    <li key={m.id}>
                        <GroupMemberRow
                            member={m}
                            onPromote={canManageMembers ? onPromote : undefined}
                            onRemove={canManageMembers ? onRemove : undefined}
                        />
                    </li>
                ))}
            </ul>

            {formerMembers.length > 0 ? (
                <Collapsible open={showFormer} onOpenChange={setShowFormer}>
                    <CollapsibleTrigger
                        render={
                            <button
                                type="button"
                                className="flex w-full cursor-pointer items-center gap-2 text-left"
                            />
                        }
                    >
                        <h3 className="text-lg">
                            Tidligere medlemmer ({formerMembers.length})
                        </h3>
                        <ChevronDown
                            className={cn(
                                "size-4 shrink-0 transition-transform",
                                showFormer && "rotate-180",
                            )}
                        />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <ul className="flex flex-col gap-2 pt-2">
                            {formerMembers.map((m) => (
                                <li key={m.id}>
                                    <GroupMemberRow member={m} historic />
                                </li>
                            ))}
                        </ul>
                    </CollapsibleContent>
                </Collapsible>
            ) : null}
        </div>
    );
}
