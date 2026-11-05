import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Link,
    Outlet,
    createFileRoute,
    useLocation,
} from "@tanstack/react-router";
import { Alert, AlertDescription } from "@tihlde/ui/ui/alert";
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

import { useImageUploader } from "#/api/queries/assets";
import {
    GroupQueryKeys,
    archiveGroupMutation,
    createFineMutation,
    getGroupBySlugQuery,
    leaveGroupMutation,
    requestToJoinGroupMutation,
    unarchiveGroupMutation,
    updateGroupMutation,
    withdrawJoinRequestMutation,
} from "#/api/queries/groups";
import {
    DetailLayout,
    DetailLayoutContent,
    DetailLayoutNav,
} from "#/components/detail-layout";
import { GroupDetailHeader } from "#/components/group-detail-header";
import type { GroupEditValues } from "#/components/group-edit-dialog";
import {
    GroupGiveFineDialog,
    type GiveFineValues,
} from "#/components/group-give-fine-dialog";
import { GROUP_NAV_ITEMS, type GroupNavKey } from "#/components/group-nav";
import { usePermission, useScopedPermission } from "#/hooks/use-permission";
import { extractErrorMessage } from "#/lib/api-error";
import { isPrivateGroupType } from "#/lib/group";
import { errorStatus } from "#/lib/utils";

import { GroupDetailContext, useGroupData } from "./-context";
import { GROUP_TAB_ROUTES } from "./-navigation";

export const Route = createFileRoute("/_app/grupper/$slug")({
    component: GroupDetailPage,
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
    const context = useGroupData();
    const {
        apiMembers,
        group,
        leaders,
        members,
        slug,
        canArchive,
        isArchived,
        isInterestGroup,
        canViewFines,
        session,
        apiGroup,
        isLeader,
        laws,
        finesTabVisible,
        isLoggedIn,
    } = context;

    const active = useLocation({
        select: (location) => location.pathname.split("/")[3] || "om",
    });

    const navigate = Route.useNavigate();

    const queryClient = useQueryClient();

    const [fineDialogOpen, setFineDialogOpen] = useState(false);

    const [fineError, setFineError] = useState<string | null>(null);

    const [groupError, setGroupError] = useState<string | null>(null);

    const [headerFailure, setHeaderFailure] = useState<{
        slug: string;
        message: string;
    } | null>(null);

    // Siden monteres ikke på nytt når man går til en annen gruppe.
    const headerError =
        headerFailure?.slug === slug ? headerFailure.message : null;

    function setActive(tab: GroupNavKey) {
        void navigate({
            to: GROUP_TAB_ROUTES[tab],
            params: { slug },
            search: {},
        });
    }

    const requestToJoin = useMutation(requestToJoinGroupMutation);

    const withdrawJoinRequest = useMutation(withdrawJoinRequestMutation);

    const leaveGroup = useMutation(leaveGroupMutation);

    const updateGroup = useMutation(updateGroupMutation);

    const archiveGroup = useMutation(archiveGroupMutation);

    const unarchiveGroup = useMutation(unarchiveGroupMutation);

    const createFine = useMutation(createFineMutation);

    const { uploadImage, isUploading } = useImageUploader();

    // The scope is known here, so these mirror the API exactly: a grant for
    // this group counts, a grant for another group does not.
    const canEditGroup = useScopedPermission(
        ["groups:update", "groups:manage", "groups:delete"],
        `group:${slug}`,
    );

    const canManage = (canEditGroup || isLeader) && !isArchived;

    // Gruppetypen er organisasjonens valg, ikke gruppas: API-et krever
    // tilgangen globalt, så verken lederen eller et grant for denne gruppa
    // holder.
    const canChangeType = usePermission(["groups:update", "groups:manage"]);

    const viewerId = session?.user?.id;

    const viewerMembership = members.find((member) => member.id === viewerId);

    const membershipAction: "leave" | "pending" | "request" | null =
        !viewerId || !isInterestGroup || isArchived || !apiMembers
            ? null
            : viewerMembership
              ? // En leder kan bare gå når gruppa har en leder til.
                viewerMembership.role === "leader" &&
                !members.some((m) => m.role === "leader" && m.id !== viewerId)
                  ? null
                  : "leave"
              : apiGroup.viewerHasJoinRequest
                ? "pending"
                : apiGroup.acceptsJoinRequests
                  ? "request"
                  : null;

    // Å gi en bot krever nøyaktig det samme som å lese dem — serveren avviser
    // ellers POST-en med 403 etter at skjemaet er fylt ut.
    const canGiveFine = canViewFines && !isArchived;

    const navItems = useMemo(
        () =>
            GROUP_NAV_ITEMS.filter((item) => {
                if (item.key === "boter") return finesTabVisible;
                // Lovverket er gruppens regelverk, ikke en del av ens egen
                // botlogg: det følger medlemskapet.
                if (item.key === "lovverk") return canViewFines;
                // Spørreskjemaene ligger bak innlogging i API-et, så en
                // utlogget besøkende skal ikke se fanen i det hele tatt — den
                // ville uansett bare stått tom.
                if (item.key === "sporreskjema") return isLoggedIn;
                return true;
            }),
        [canViewFines, finesTabVisible, isLoggedIn],
    );

    const activeTab =
        GROUP_NAV_ITEMS.find((item) => item.key === active)?.key ?? "om";

    async function handleSaveGroup(values: GroupEditValues): Promise<boolean> {
        setGroupError(null);
        try {
            await updateGroup.mutateAsync({
                slug,
                data: {
                    name: values.name,
                    description: values.description,
                    contactEmail: values.contactEmail,
                    ...(values.type ? { type: values.type } : {}),
                    // Lederen kan sette underkategorien uten å få velge
                    // typen, så den sendes for seg selv.
                    ...(values.subtype !== undefined
                        ? { subtype: values.subtype }
                        : {}),
                    finesActivated: values.finesActivated,
                    finesAdminId: values.finesAdminId,
                    finesInfo: values.finesInfo,
                },
            });
            return true;
        } catch (error) {
            setGroupError(
                error instanceof Error
                    ? error.message
                    : "Ukjent feil da gruppen skulle lagres",
            );
            return false;
        }
    }

    function openGiveFine() {
        if (activeTab !== "boter") setActive("boter");
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
            // Privat fordi bildet viser hvem som ble bøtelagt for hva.
            const imageUrl = values.image
                ? await uploadImage(values.image, { visibility: "private" })
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

    async function changeOwnMembership(
        mutation:
            | typeof requestToJoin
            | typeof withdrawJoinRequest
            | typeof leaveGroup,
    ) {
        setHeaderFailure(null);
        try {
            await mutation.mutateAsync({ groupSlug: slug });
        } catch (error) {
            setHeaderFailure({
                slug,
                message: await extractErrorMessage(error),
            });
        }
    }

    async function changeArchived(
        mutation: typeof archiveGroup | typeof unarchiveGroup,
    ) {
        setHeaderFailure(null);
        try {
            await mutation.mutateAsync({ slug });

            // Arkivering tar lederen ut av gruppen, og en privat gruppe er
            // bare for medlemmene. Siden kan være stengt nå, men cachen ville
            // vist den aktive gruppen videre. Tilgangen før arkiveringen sier
            // ikke noe sikkert om den etterpå — groups:manage kan ha kommet
            // fra gruppen selv — så vi går alltid ut. Den som fortsatt har
            // tilgang, finner gruppen under arkiverte grupper.
            if (
                mutation === archiveGroup &&
                isPrivateGroupType(apiGroup.type)
            ) {
                await navigate({ to: "/grupper" });
                queryClient.removeQueries({
                    queryKey: getGroupBySlugQuery(slug).queryKey,
                });
                for (const queryKey of [
                    GroupQueryKeys.members,
                    GroupQueryKeys.formerMembers,
                    GroupQueryKeys.fines,
                ]) {
                    queryClient.removeQueries({
                        queryKey: [...queryKey, slug],
                    });
                }
            }
        } catch (error) {
            setHeaderFailure({
                slug,
                message: await extractErrorMessage(error),
            });
        }
    }
    return (
        <GroupDetailContext value={context}>
            <>
                <DetailLayout
                    header={
                        <GroupDetailHeader
                            group={group}
                            isAdmin={canManage}
                            canChangeType={canChangeType}
                            canArchive={canArchive}
                            onArchive={() => changeArchived(archiveGroup)}
                            onUnarchive={() => changeArchived(unarchiveGroup)}
                            isArchivePending={
                                archiveGroup.isPending ||
                                unarchiveGroup.isPending
                            }
                            canGiveFine={canGiveFine}
                            onGiveFine={openGiveFine}
                            members={members}
                            onSaveGroup={handleSaveGroup}
                            isSavingGroup={updateGroup.isPending}
                            saveGroupError={groupError}
                            membershipAction={membershipAction}
                            leaderCount={leaders.length}
                            onRequest={() => changeOwnMembership(requestToJoin)}
                            onWithdraw={() =>
                                changeOwnMembership(withdrawJoinRequest)
                            }
                            onLeave={() => changeOwnMembership(leaveGroup)}
                            isMembershipPending={
                                requestToJoin.isPending ||
                                withdrawJoinRequest.isPending ||
                                leaveGroup.isPending
                            }
                        />
                    }
                >
                    <DetailLayoutNav
                        sections={[navItems]}
                        active={activeTab}
                        onSelect={setActive}
                    />

                    <DetailLayoutContent>
                        {headerError ? (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    {headerError}
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        <Outlet />
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
        </GroupDetailContext>
    );
}
