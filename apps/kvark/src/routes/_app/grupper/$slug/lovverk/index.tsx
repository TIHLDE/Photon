import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";

import {
    createLawMutation,
    deleteLawMutation,
    updateLawMutation,
} from "#/api/queries/groups";
import { GroupLawsTab } from "#/components/group-laws-tab";

import { useGroupDetail } from "../-context";

export const Route = createFileRoute("/_app/grupper/$slug/lovverk/")({
    component: GroupLawsPage,
});

function GroupLawsPage() {
    const {
        laws,
        isLeader,
        session,
        apiGroup,
        isRoot,
        isArchived,
        slug,
        canViewFines,
    } = useGroupDetail();

    const createLaw = useMutation(createLawMutation);

    const updateLaw = useMutation(updateLawMutation);

    const deleteLaw = useMutation(deleteLawMutation);

    const isFinesAdmin = Boolean(
        session && apiGroup.finesAdminId === session.user?.id,
    );

    // Lovverk: the fines admin (botsjef) or the leader — same as
    // `canManageLaws` server-side.
    const canManageLaws = (isLeader || isFinesAdmin || isRoot) && !isArchived;

    if (!canViewFines)
        return <Navigate to="/grupper/$slug" params={{ slug }} />;
    return (
        <GroupLawsTab
            laws={laws}
            canManage={canManageLaws}
            isSaving={createLaw.isPending || updateLaw.isPending}
            isDeleting={deleteLaw.isPending}
            onSave={(values, lawId) =>
                lawId
                    ? updateLaw.mutateAsync({
                          groupSlug: slug,
                          lawId,
                          data: values,
                      })
                    : createLaw.mutateAsync({
                          groupSlug: slug,
                          data: values,
                      })
            }
            onDelete={(lawId) =>
                deleteLaw.mutateAsync({
                    groupSlug: slug,
                    lawId,
                })
            }
        />
    );
}
