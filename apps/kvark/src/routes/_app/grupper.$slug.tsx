import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { authQueryOptions } from "#/api/auth";
import {
    getGroupBySlugQuery,
    getGroupFinesQuery,
    getGroupFormsQuery,
    getGroupMembersQuery,
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
import { mapFine, mapForm, mapGroup, mapMember } from "#/lib/group";

export const Route = createFileRoute("/_app/grupper/$slug")({
    component: GroupDetailPage,
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getGroupBySlugQuery(params.slug)),
});

const ADMIN_PERMISSIONS = ["groups:update", "groups:manage", "groups:delete"];

function GroupDetailPage() {
    const { slug } = Route.useParams();
    const [active, setActive] = useState<GroupNavKey>("om");
    const [fineDialogOpen, setFineDialogOpen] = useState(false);

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

    const isAdmin = Boolean(
        session?.permissions?.some(
            (p) => ADMIN_PERMISSIONS.includes(p) || p === "root",
        ),
    );
    const isLeader = Boolean(
        session?.groups?.some((g) => g.slug === slug && g.role === "leader"),
    );
    const canManage = isAdmin || isLeader;

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
                            isAdmin={canManage}
                        />
                    ) : null}
                    {active === "arrangementer" ? <GroupEventsTab /> : null}
                    {active === "boter" ? (
                        <GroupFinesTab
                            fines={fines}
                            memberCount={members.length}
                        />
                    ) : null}
                    {active === "lovverk" ? <GroupLawsTab /> : null}
                    {active === "sporreskjema" ? (
                        <GroupFormsTab forms={forms} isAdmin={canManage} />
                    ) : null}
                </DetailLayoutContent>
            </DetailLayout>

            <GroupGiveFineDialog
                open={fineDialogOpen}
                onOpenChange={setFineDialogOpen}
                users={[]}
                laws={[]}
            />
        </>
    );
}
