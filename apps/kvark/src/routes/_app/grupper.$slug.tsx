import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";

import { authQueryOptions } from "#/api/auth";
import {
    useAnyScopePermission,
    useIsGroupLeaderOf,
    useScopedPermission,
} from "#/hooks/use-permission";
import {
    createLawMutation,
    deleteLawMutation,
    getGroupBySlugQuery,
    getGroupFinesQuery,
    getGroupFormsQuery,
    getGroupLawsQuery,
    getGroupMembersQuery,
    updateLawMutation,
} from "#/api/queries/groups";
import {
    DetailLayout,
    DetailLayoutContent,
    DetailLayoutNav,
} from "#/components/detail-layout";
import { GroupDetailHeader } from "#/components/group-detail-header";
import { GroupEventsTab } from "#/components/group-events-tab";
import { GroupFinesTab } from "#/components/group-fines-tab";
import { GroupFormsTab } from "#/components/group-forms-tab";
import { GroupGiveFineDialog } from "#/components/group-give-fine-dialog";
import { GroupLawsTab } from "#/components/group-laws-tab";
import { GroupMembersTab } from "#/components/group-members-tab";
import { GROUP_NAV_ITEMS, type GroupNavKey } from "#/components/group-nav";
import { GroupOmTab } from "#/components/group-om-tab";
import { mapFine, mapForm, mapGroup, mapLaw, mapMember } from "#/lib/group";

const searchSchema = z.object({
    tab: z
        .enum([
            "om",
            "medlemmer",
            "arrangementer",
            "boter",
            "lovverk",
            "sporreskjema",
        ])
        .default("om")
        .catch("om"),
});

export const Route = createFileRoute("/_app/grupper/$slug")({
    component: GroupDetailPage,
    validateSearch: searchSchema,
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getGroupBySlugQuery(params.slug)),
});

function GroupDetailPage() {
    const { slug } = Route.useParams();
    const { tab: active } = Route.useSearch();
    const navigate = Route.useNavigate();
    const [fineDialogOpen, setFineDialogOpen] = useState(false);

    function setActive(tab: GroupNavKey) {
        navigate({ search: (prev) => ({ ...prev, tab }) });
    }

    const { data: apiGroup } = useSuspenseQuery(getGroupBySlugQuery(slug));
    const { data: session } = useQuery(authQueryOptions);
    const { data: apiMembers } = useQuery(getGroupMembersQuery(slug, 0));
    const { data: apiFines } = useQuery({
        ...getGroupFinesQuery(slug, 0),
        enabled: Boolean(session),
    });
    const { data: apiForms } = useQuery({
        ...getGroupFormsQuery(slug),
        enabled: Boolean(session),
    });
    const { data: apiLaws } = useQuery({
        ...getGroupLawsQuery(slug),
        enabled: Boolean(session),
    });

    const createLaw = useMutation(createLawMutation);
    const updateLaw = useMutation(updateLawMutation);
    const deleteLaw = useMutation(deleteLawMutation);

    // The scope is known here, so these mirror the API exactly: a grant for
    // this group counts, a grant for another group does not.
    const canEditGroup = useScopedPermission(
        ["groups:update", "groups:manage", "groups:delete"],
        `group:${slug}`,
    );
    const isLeader = useIsGroupLeaderOf(slug);
    const canManage = canEditGroup || isLeader;
    // Roster changes: `groups:manage` for this group, or being its leader.
    // Adding someone AS leader still needs `groups:manage` — the dialog only
    // adds plain members, and the API refuses the rest.
    const hasGroupsManage = useScopedPermission(
        "groups:manage",
        `group:${slug}`,
    );
    const canManageMembers = hasGroupsManage || isLeader;
    // Creating forms: forms:create, or being the group's leader.
    const hasFormsPermission = useAnyScopePermission([
        "forms:create",
        "forms:manage",
    ]);
    const canManageForms = hasFormsPermission || isLeader;
    const hasFinesManage = useScopedPermission("fines:manage", `group:${slug}`);
    const hasFinesEdit = useScopedPermission(
        ["fines:update", "fines:delete", "fines:manage"],
        `group:${slug}`,
    );

    const members = useMemo(
        () => (apiMembers ?? []).map(mapMember),
        [apiMembers],
    );
    const leader = useMemo(
        () => members.find((m) => m.role === "leader") ?? null,
        [members],
    );
    const regularMembers = useMemo(
        () => members.filter((m) => m.role !== "leader"),
        [members],
    );
    const group = useMemo(
        () => mapGroup(apiGroup, leader?.name),
        [apiGroup, leader],
    );
    const fines = useMemo(() => (apiFines ?? []).map(mapFine), [apiFines]);
    const forms = useMemo(() => (apiForms ?? []).map(mapForm), [apiForms]);
    const laws = useMemo(() => (apiLaws ?? []).map(mapLaw), [apiLaws]);

    const isFinesAdmin = Boolean(
        session && apiGroup.finesAdminId === session.user?.id,
    );
    // Lovverk: the fines admin (botsjef), the leader, or fines:manage for
    // this group — same as `canManageLaws` server-side.
    const canManageLaws = isLeader || isFinesAdmin || hasFinesManage;
    // Approving, editing and deleting fines: the fines admin, or the
    // matching fines:* permission for this group.
    const canManageFines = isFinesAdmin || hasFinesEdit;

    function openGiveFine() {
        setActive("boter");
        setFineDialogOpen(true);
    }

    return (
        <>
            <DetailLayout
                header={
                    <GroupDetailHeader
                        group={group}
                        isAdmin={canManage}
                        onGiveFine={openGiveFine}
                    />
                }
            >
                <DetailLayoutNav
                    sections={[GROUP_NAV_ITEMS]}
                    active={active}
                    onSelect={setActive}
                />

                <DetailLayoutContent>
                    {active === "om" ? <GroupOmTab group={group} /> : null}
                    {active === "medlemmer" ? (
                        <GroupMembersTab
                            leader={leader}
                            members={regularMembers}
                            isAdmin={canManageMembers}
                        />
                    ) : null}
                    {active === "arrangementer" ? <GroupEventsTab /> : null}
                    {active === "boter" ? (
                        <GroupFinesTab
                            fines={fines}
                            memberCount={members.length}
                            canManage={canManageFines}
                        />
                    ) : null}
                    {active === "lovverk" ? (
                        <GroupLawsTab
                            laws={laws}
                            canManage={canManageLaws}
                            onSave={(values, lawId) => {
                                if (lawId) {
                                    updateLaw.mutate({
                                        groupSlug: slug,
                                        lawId,
                                        data: values,
                                    });
                                } else {
                                    createLaw.mutate({
                                        groupSlug: slug,
                                        data: values,
                                    });
                                }
                            }}
                            onDelete={(lawId) =>
                                deleteLaw.mutate({ groupSlug: slug, lawId })
                            }
                        />
                    ) : null}
                    {active === "sporreskjema" ? (
                        <GroupFormsTab forms={forms} isAdmin={canManageForms} />
                    ) : null}
                </DetailLayoutContent>
            </DetailLayout>

            <GroupGiveFineDialog
                open={fineDialogOpen}
                onOpenChange={setFineDialogOpen}
                users={[]}
                laws={laws}
            />
        </>
    );
}
