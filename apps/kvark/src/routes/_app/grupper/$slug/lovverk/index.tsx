import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { authQueryOptions } from "#/api/auth";
import {
    createLawMutation,
    deleteLawMutation,
    getGroupBySlugQuery,
    getGroupLawsQuery,
    updateLawMutation,
} from "#/api/queries/groups";
import type { LawFormValues } from "#/components/group-law-form-dialog";
import { GroupLawFormDialog } from "#/components/group-law-form-dialog";
import { GroupLawItem } from "#/components/group-law-item";
import {
    useIsGroupLeaderOf,
    useIsGroupMemberOf,
    usePermission,
} from "#/hooks/use-permission";
import { extractErrorMessage } from "#/lib/api-error";
import type { Law } from "#/lib/group";
import { mapLaw } from "#/lib/group";

export const Route = createFileRoute("/_app/grupper/$slug/lovverk/")({
    component: GroupLawsPage,
});

function GroupLawsPage() {
    const { slug } = Route.useParams();

    const { data: apiGroup } = useSuspenseQuery(getGroupBySlugQuery(slug));

    const { data: session, isPending: isSessionPending } =
        useQuery(authQueryOptions);

    const isLeader = useIsGroupLeaderOf(slug);

    const isArchived = Boolean(apiGroup.archivedAt);

    const isRoot = usePermission("root");

    // Lovverk er tilgjengelig for medlemmer og botsjef selv når bøter er slått av.
    const isMember = useIsGroupMemberOf(slug);
    const canViewLaws =
        isMember ||
        Boolean(session && apiGroup.finesAdminId === session.user.id) ||
        isRoot;

    const { data: apiLaws } = useQuery({
        ...getGroupLawsQuery(slug),
        enabled: canViewLaws,
    });

    const laws = useMemo(() => (apiLaws ?? []).map(mapLaw), [apiLaws]);

    const createLaw = useMutation(createLawMutation);

    const updateLaw = useMutation(updateLawMutation);

    const deleteLaw = useMutation(deleteLawMutation);

    const isFinesAdmin = Boolean(
        session && apiGroup.finesAdminId === session.user?.id,
    );

    // Lovverk: the fines admin (botsjef) or the leader — same as
    // `canManageLaws` server-side.
    const canManageLaws = (isLeader || isFinesAdmin || isRoot) && !isArchived;

    const onSave = (values: LawFormValues, lawId?: string) =>
        lawId
            ? updateLaw.mutateAsync({
                  groupSlug: slug,
                  lawId,
                  data: values,
              })
            : createLaw.mutateAsync({
                  groupSlug: slug,
                  data: values,
              });
    const onDelete = (lawId: string) =>
        deleteLaw.mutateAsync({
            groupSlug: slug,
            lawId,
        });

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Law | null>(null);
    const [error, setError] = useState<string | null>(null);

    function openCreate() {
        setEditing(null);
        setError(null);
        setDialogOpen(true);
    }

    function openEdit(law: Law) {
        setEditing(law);
        setError(null);
        setDialogOpen(true);
    }

    async function run(action: Promise<unknown>) {
        setError(null);
        try {
            await action;
            setDialogOpen(false);
        } catch (err) {
            setError(await extractErrorMessage(err));
        }
    }

    if (!canViewLaws && !isSessionPending)
        return <Navigate to="/grupper/$slug" params={{ slug }} replace />;
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl">Lovverk</h2>
                {canManageLaws ? (
                    <Button onClick={openCreate}>Ny paragraf</Button>
                ) : undefined}
            </div>
            {laws.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Gruppen har ingen lovparagrafer ennå.
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    {laws.map((law) => (
                        <GroupLawItem
                            key={law.id}
                            law={law}
                            onEdit={
                                canManageLaws ? () => openEdit(law) : undefined
                            }
                        />
                    ))}
                </div>
            )}

            <GroupLawFormDialog
                open={dialogOpen}
                law={editing}
                isSaving={createLaw.isPending || updateLaw.isPending}
                isDeleting={deleteLaw.isPending}
                error={error}
                onClose={() => setDialogOpen(false)}
                onSubmit={(values) => run(onSave(values, editing?.id))}
                onDelete={editing ? () => run(onDelete(editing.id)) : undefined}
            />
        </div>
    );
}
