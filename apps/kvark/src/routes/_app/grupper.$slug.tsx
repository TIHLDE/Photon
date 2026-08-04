import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { LockIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { authQueryOptions } from "#/api/auth";
import { useImageUploader } from "#/api/queries/assets";
import {
    useIsGroupLeaderOf,
    useIsGroupMemberOf,
    usePermission,
    useScopedPermission,
} from "#/hooks/use-permission";
import {
    createFineMutation,
    createLawMutation,
    deleteFineMutation,
    deleteLawMutation,
    getGroupBySlugQuery,
    getGroupFinesQuery,
    getGroupFormerMembersQuery,
    getGroupFormsQuery,
    getGroupLawsQuery,
    getGroupMembersQuery,
    removeGroupMemberMutation,
    updateFineMutation,
    updateGroupMemberRoleMutation,
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
import {
    GroupGiveFineDialog,
    type GiveFineValues,
} from "#/components/group-give-fine-dialog";
import { GroupLawsTab } from "#/components/group-laws-tab";
import { GroupMembersTab } from "#/components/group-members-tab";
import { GROUP_NAV_ITEMS, type GroupNavKey } from "#/components/group-nav";
import { GroupOmTab } from "#/components/group-om-tab";
import {
    mapFine,
    mapForm,
    mapFormerMember,
    mapGroup,
    mapLaw,
    mapMember,
    sortMembersByName,
} from "#/lib/group";

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
    loader: async ({ context, params }) => {
        try {
            await context.queryClient.ensureQueryData(
                getGroupBySlugQuery(params.slug),
            );
            return { restricted: false };
        } catch (error) {
            // Private grupper svarer 403 for alle andre enn medlemmene. Det
            // avgjøres her og ikke i en errorComponent fordi statuskoden ikke
            // overlever hydreringen — bare selve feilmeldingen gjør det.
            if (errorStatus(error) === 403) return { restricted: true };
            throw error;
        }
    },
});

/** HTTP-statusen bak en feil fra API-klienten, om den finnes. */
function errorStatus(error: unknown): number | undefined {
    const response = (error as { response?: { status?: number } })?.response;
    return typeof response?.status === "number" ? response.status : undefined;
}

/** Vist i stedet for gruppesiden når gruppa er privat og du står utenfor. */
function GroupRestricted() {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <LockIcon />
                </EmptyMedia>
                <EmptyTitle>Privat gruppe</EmptyTitle>
                <EmptyDescription>
                    Denne gruppen er bare for medlemmene sine.
                </EmptyDescription>
            </EmptyHeader>
            <Button render={<Link to="/grupper" />}>Se alle grupper</Button>
        </Empty>
    );
}

function GroupDetailPage() {
    const { restricted } = Route.useLoaderData();
    // Egen komponent: den henter gruppa med useSuspenseQuery, som ville kastet
    // den samme 403-en på nytt hvis den ble montert her.
    return restricted ? <GroupRestricted /> : <GroupDetail />;
}

function GroupDetail() {
    const { slug } = Route.useParams();
    const { tab: active } = Route.useSearch();
    const navigate = Route.useNavigate();
    const [fineDialogOpen, setFineDialogOpen] = useState(false);
    const [fineError, setFineError] = useState<string | null>(null);

    function setActive(tab: GroupNavKey) {
        navigate({ search: (prev) => ({ ...prev, tab }) });
    }

    const { data: apiGroup } = useSuspenseQuery(getGroupBySlugQuery(slug));
    const { data: session } = useQuery(authQueryOptions);
    const { data: apiMembers } = useQuery(getGroupMembersQuery(slug, 0));
    const { data: apiFormerMembers } = useQuery(
        getGroupFormerMembersQuery(slug),
    );

    const updateMemberRole = useMutation(updateGroupMemberRoleMutation);
    const removeMember = useMutation(removeGroupMemberMutation);
    const createFine = useMutation(createFineMutation);
    const { uploadImage, isUploading } = useImageUploader();
    const updateFine = useMutation(updateFineMutation);
    const deleteFine = useMutation(deleteFineMutation);
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
    // Creating forms: a global forms:create/manage grant, or leadership of
    // THIS group — exactly what POST /groups/:slug/form checks. The previous
    // "in any scope" check let anyone holding forms:create for their own
    // group manage forms on every other group's page.
    const hasFormsPermission = usePermission(["forms:create", "forms:manage"]);
    const canManageForms = hasFormsPermission || isLeader;
    const isMember = useIsGroupMemberOf(slug);
    const hasFinesView = useScopedPermission("fines:view", `group:${slug}`);
    const hasFinesManage = useScopedPermission("fines:manage", `group:${slug}`);
    const hasFinesEdit = useScopedPermission(
        ["fines:update", "fines:delete", "fines:manage"],
        `group:${slug}`,
    );

    const isFinesAdmin = Boolean(
        session && apiGroup.finesAdminId === session.user?.id,
    );
    // Bøter og lovverk er lesbart for gruppens medlemmer, botsjefen og
    // fines:view for denne gruppen — samme regel som GET-endepunktene. Uten
    // dette sto fanene der for alle og spørringene svarte alltid 403.
    //
    // `finesActivated` avgjør først: en gruppe som ikke bruker botsystemet har
    // verken lovverk eller bøter å vise, og fanene sto likevel der for alle
    // medlemmene.
    const canViewFines =
        apiGroup.finesActivated && (isMember || isFinesAdmin || hasFinesView);

    const { data: apiFines } = useQuery({
        ...getGroupFinesQuery(slug, 0),
        enabled: canViewFines,
    });
    const { data: apiForms } = useQuery({
        ...getGroupFormsQuery(slug),
        enabled: Boolean(session),
    });
    const { data: apiLaws } = useQuery({
        ...getGroupLawsQuery(slug),
        enabled: canViewFines,
    });

    const members = useMemo(
        () => sortMembersByName((apiMembers ?? []).map(mapMember)),
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
    const formerMembers = useMemo(
        () => (apiFormerMembers ?? []).map(mapFormerMember),
        [apiFormerMembers],
    );
    const group = useMemo(
        () => mapGroup(apiGroup, leader?.name),
        [apiGroup, leader],
    );
    const fines = useMemo(() => (apiFines ?? []).map(mapFine), [apiFines]);
    const forms = useMemo(() => (apiForms ?? []).map(mapForm), [apiForms]);
    const laws = useMemo(() => (apiLaws ?? []).map(mapLaw), [apiLaws]);

    // Lovverk: the fines admin (botsjef), the leader, or fines:manage for
    // this group — same as `canManageLaws` server-side.
    const canManageLaws = isLeader || isFinesAdmin || hasFinesManage;
    // Approving, editing and deleting fines: the fines admin, or the
    // matching fines:* permission for this group.
    const canManageFines = isFinesAdmin || hasFinesEdit;

    const navItems = useMemo(
        () =>
            GROUP_NAV_ITEMS.filter((item) =>
                item.key === "boter" || item.key === "lovverk"
                    ? canViewFines
                    : true,
            ),
        [canViewFines],
    );
    // ?tab=boter kan stå i URL-en fra før rettighetene ble sjekket, så en fane
    // som ikke lenger finnes faller tilbake til «Om».
    const activeTab = navItems.some((item) => item.key === active)
        ? active
        : "om";

    function openGiveFine() {
        setActive("boter");
        setFineError(null);
        setFineDialogOpen(true);
    }

    /**
     * Én bot per mottaker: API-et tar én bruker om gangen, mens dialogen lar
     * deg bøtelegge flere som brøt samme paragraf samtidig. Bildet lastes opp
     * én gang og deles av alle botene.
     */
    async function handleGiveFine(values: GiveFineValues) {
        setFineError(null);
        try {
            const imageUrl = values.image
                ? await uploadImage(values.image)
                : undefined;

            for (const userId of values.userIds) {
                await createFine.mutateAsync({
                    groupSlug: slug,
                    data: {
                        userId,
                        groupSlug: slug,
                        reason: values.reason,
                        amount: values.amount,
                        ...(values.lawId ? { lawId: values.lawId } : {}),
                        ...(imageUrl ? { image: imageUrl } : {}),
                    },
                });
            }

            setFineDialogOpen(false);
        } catch (error) {
            setFineError(
                error instanceof Error
                    ? error.message
                    : "Ukjent feil da boten skulle opprettes",
            );
        }
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
                    sections={[navItems]}
                    active={activeTab}
                    onSelect={setActive}
                />

                <DetailLayoutContent>
                    {activeTab === "om" ? <GroupOmTab group={group} /> : null}
                    {activeTab === "medlemmer" ? (
                        <GroupMembersTab
                            leader={leader}
                            members={regularMembers}
                            formerMembers={formerMembers}
                            isAdmin={canManageMembers}
                            canPromote={hasGroupsManage}
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
                    ) : null}
                    {activeTab === "arrangementer" ? <GroupEventsTab /> : null}
                    {activeTab === "boter" ? (
                        <GroupFinesTab
                            fines={fines}
                            memberCount={members.length}
                            canManage={canManageFines}
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
                            onDelete={(fine) =>
                                deleteFine.mutate({
                                    groupSlug: slug,
                                    fineId: fine.id,
                                })
                            }
                        />
                    ) : null}
                    {activeTab === "lovverk" ? (
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
                    {activeTab === "sporreskjema" ? (
                        <GroupFormsTab forms={forms} isAdmin={canManageForms} />
                    ) : null}
                </DetailLayoutContent>
            </DetailLayout>

            <GroupGiveFineDialog
                open={fineDialogOpen}
                onOpenChange={setFineDialogOpen}
                members={members}
                laws={laws}
                onSubmit={handleGiveFine}
                isSubmitting={createFine.isPending || isUploading}
                error={fineError}
            />
        </>
    );
}
