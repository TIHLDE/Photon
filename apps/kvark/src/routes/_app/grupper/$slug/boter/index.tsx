import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";

import { authQueryOptions } from "#/api/auth";
import {
    batchUpdateUserFinesMutation,
    deleteFineMutation,
    getGroupBySlugQuery,
    getGroupFinesInfiniteQuery,
    getGroupFineStatisticsQuery,
    getGroupFineUsersInfiniteQuery,
    getGroupLawsQuery,
    getGroupMembersQuery,
    updateFineMutation,
} from "#/api/queries/groups";
import {
    GroupEditFineDialog,
    type EditFineValues,
} from "#/components/group-edit-fine-dialog";
import { GroupFinesTab } from "#/components/group-fines-tab";
import { useIsGroupLeaderOf, usePermission } from "#/hooks/use-permission";
import { extractErrorMessage } from "#/lib/api-error";
import {
    mapFine,
    mapFineUser,
    mapLaw,
    mapMember,
    sortMembersByName,
    type Fine,
} from "#/lib/group";

const searchSchema = z.object({
    // Botfiltrene ligger i URL-en, ikke i komponenttilstand: da overlever de
    // en refresh, og en botsjef kan sende «ubetalte bøter for X» som lenke.
    botStatus: z
        .enum(["alle", "pending", "approved", "paid", "rejected"])
        .default("alle")
        .catch("alle"),
    botVisning: z.enum(["alle", "per-medlem"]).default("alle").catch("alle"),
    botBruker: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_app/grupper/$slug/boter/")({
    validateSearch: searchSchema,
    component: GroupFinesPage,
});

function GroupFinesPage() {
    const { slug } = Route.useParams();

    const { data: apiGroup } = useSuspenseQuery(getGroupBySlugQuery(slug));

    const { data: session, isPending: isSessionPending } =
        useQuery(authQueryOptions);

    const { data: apiMembers } = useQuery(getGroupMembersQuery(slug, 0));

    const isLeader = useIsGroupLeaderOf(slug);

    const isArchived = Boolean(apiGroup.archivedAt);

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

    const { data: apiLaws } = useQuery({
        ...getGroupLawsQuery(slug),
        enabled: canViewFines,
    });

    const members = useMemo(
        () => sortMembersByName((apiMembers ?? []).map(mapMember)),
        [apiMembers],
    );

    const laws = useMemo(() => (apiLaws ?? []).map(mapLaw), [apiLaws]);

    const { botStatus, botVisning, botBruker } = Route.useSearch();

    const navigate = Route.useNavigate();

    const [editingFine, setEditingFine] = useState<Fine | null>(null);

    const [editFineError, setEditFineError] = useState<string | null>(null);

    const updateFine = useMutation(updateFineMutation);

    const batchUpdateUserFines = useMutation(batchUpdateUserFinesMutation);

    const deleteFine = useMutation(deleteFineMutation);

    const isFinesAdmin = Boolean(
        session && apiGroup.finesAdminId === session.user?.id,
    );

    // Filtrene går til serveren, ikke gjennom en ferdiglastet liste: en gruppe
    // med noen tusen bøter skal ikke lastes ned i sin helhet for å vise 25.
    const fineFilters = useMemo(
        () => ({
            ...(botStatus === "alle" ? {} : { status: botStatus }),
            ...(botBruker ? { userId: botBruker } : {}),
        }),
        [botStatus, botBruker],
    );

    const {
        data: apiFinePages,
        hasNextPage: hasMoreFines,
        isFetchingNextPage: isLoadingMoreFines,
        fetchNextPage: fetchMoreFines,
    } = useInfiniteQuery({
        ...getGroupFinesInfiniteQuery(slug, fineFilters),
        // Egen-visningen har bare den flate lista, så den henter uansett hva
        // `botVisning` skulle stå til fra en gammel URL.
        enabled: canSeeOwnFines || (canViewFines && botVisning === "alle"),
    });

    const {
        data: apiFineUserPages,
        hasNextPage: hasMoreFineUsers,
        isFetchingNextPage: isLoadingMoreFineUsers,
        fetchNextPage: fetchMoreFineUsers,
    } = useInfiniteQuery({
        ...getGroupFineUsersInfiniteQuery(
            slug,
            botStatus === "alle" ? {} : { status: botStatus },
        ),
        enabled: canViewFines && botVisning === "per-medlem",
    });

    const { data: apiFineStatistics } = useQuery({
        ...getGroupFineStatisticsQuery(slug),
        enabled: canViewFines,
    });

    const fines = useMemo(
        () =>
            (apiFinePages?.pages ?? []).flatMap((page) =>
                page.fines.map(mapFine),
            ),
        [apiFinePages],
    );

    const fineUsers = useMemo(
        () =>
            (apiFineUserPages?.pages ?? []).flatMap((page) =>
                page.users.map(mapFineUser),
            ),
        [apiFineUserPages],
    );

    const selectedFineUserName = useMemo(
        () =>
            botBruker
                ? (fineUsers.find((u) => u.id === botBruker)?.name ??
                  members.find((m) => m.id === botBruker)?.name)
                : undefined,
        [botBruker, fineUsers, members],
    );

    // Å avgjøre en bot — godkjenne, avvise, slette — er botsjefens og lederens
    // jobb. Å gi en er noe alle i gruppen kan.
    const canManageFines = (isFinesAdmin || isLeader || isRoot) && !isArchived;

    function openEditFine(fine: Fine) {
        setEditFineError(null);
        setEditingFine(fine);
    }

    async function handleEditFine(fine: Fine, values: EditFineValues) {
        setEditFineError(null);
        try {
            await updateFine.mutateAsync({
                groupSlug: slug,
                fineId: fine.id,
                data: values,
            });
            setEditingFine(null);
        } catch (error) {
            setEditFineError(await extractErrorMessage(error));
        }
    }

    if (!finesTabVisible && !isSessionPending)
        return <Navigate to="/grupper/$slug" params={{ slug }} replace />;
    return (
        <>
            <GroupFinesTab
                groupSlug={slug}
                fines={fines}
                fineUsers={fineUsers}
                statistics={apiFineStatistics}
                memberCount={members.length}
                finesInfo={apiGroup.finesInfo}
                grouping={canSeeOwnFines ? "alle" : botVisning}
                onGroupingChange={(botVisning) =>
                    navigate({
                        search: (prev) => ({
                            ...prev,
                            botVisning,
                            // Personfilteret hører til den flate
                            // listen; det gir ingen mening i
                            // medlemsoversikten.
                            botBruker: undefined,
                        }),
                        // Filtrene ligger i URL-en, men å bytte
                        // fane er ikke å gå til en ny side: uten
                        // dette kastet ruteren deg til toppen midt
                        // i botlista.
                        resetScroll: false,
                    })
                }
                status={botStatus}
                onStatusChange={(botStatus) =>
                    navigate({
                        search: (prev) => ({ ...prev, botStatus }),
                        resetScroll: false,
                    })
                }
                selectedUserId={botBruker}
                selectedUserName={selectedFineUserName}
                onSelectUser={(botBruker) =>
                    navigate({
                        search: (prev) => ({
                            ...prev,
                            botBruker,
                            botVisning: botBruker ? "alle" : prev.botVisning,
                        }),
                        resetScroll: false,
                    })
                }
                hasMore={
                    botVisning === "alle" ? hasMoreFines : hasMoreFineUsers
                }
                isLoadingMore={
                    botVisning === "alle"
                        ? isLoadingMoreFines
                        : isLoadingMoreFineUsers
                }
                onLoadMore={() => {
                    if (botVisning === "alle") {
                        void fetchMoreFines();
                    } else {
                        void fetchMoreFineUsers();
                    }
                }}
                canManage={canManageFines}
                ownFinesOnly={canSeeOwnFines}
                readOnly={isArchived}
                currentUserId={session?.user?.id}
                onApprove={(fine) =>
                    updateFine.mutate({
                        groupSlug: slug,
                        fineId: fine.id,
                        data: { status: "approved" },
                    })
                }
                onMarkPaid={(fine) =>
                    updateFine.mutate({
                        groupSlug: slug,
                        fineId: fine.id,
                        data: { status: "paid" },
                    })
                }
                onEdit={openEditFine}
                onDelete={(fine) =>
                    deleteFine.mutate({
                        groupSlug: slug,
                        fineId: fine.id,
                    })
                }
                onSaveDefense={(fine, defense) =>
                    updateFine.mutateAsync({
                        groupSlug: slug,
                        fineId: fine.id,
                        data: { defense },
                    })
                }
                onSettleAllForUser={(userId, status) =>
                    batchUpdateUserFines.mutate({
                        groupSlug: slug,
                        userId,
                        data: { status },
                    })
                }
            />
            <GroupEditFineDialog
                fine={editingFine}
                onOpenChange={(open) => {
                    if (!open) setEditingFine(null);
                }}
                laws={laws}
                onSubmit={handleEditFine}
                isSubmitting={updateFine.isPending}
                error={editFineError}
            />
        </>
    );
}
