import { Button } from "@tihlde/ui/ui/button";
import { useState } from "react";

import { GroupLawFormDialog } from "#/components/group-law-form-dialog";
import type { LawFormValues } from "#/components/group-law-form-dialog";
import { GroupLawItem } from "#/components/group-law-item";
import { GroupPageHeader } from "#/components/group-page-header";
import { extractErrorMessage } from "#/lib/api-error";
import type { Law } from "#/lib/group";

type GroupLawsTabProps = {
    laws: Law[];
    canManage: boolean;
    /** Avviser når API-et sier nei, slik at dialogen kan bli stående. */
    onSave: (values: LawFormValues, lawId?: string) => Promise<unknown>;
    onDelete: (lawId: string) => Promise<unknown>;
    isSaving?: boolean;
    isDeleting?: boolean;
};

export function GroupLawsTab({
    laws,
    canManage,
    onSave,
    onDelete,
    isSaving,
    isDeleting,
}: GroupLawsTabProps) {
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

    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader
                title="Lovverk"
                action={
                    canManage ? (
                        <Button onClick={openCreate}>Ny paragraf</Button>
                    ) : undefined
                }
            />
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
                            onEdit={canManage ? () => openEdit(law) : undefined}
                        />
                    ))}
                </div>
            )}

            <GroupLawFormDialog
                open={dialogOpen}
                law={editing}
                isSaving={isSaving}
                isDeleting={isDeleting}
                error={error}
                onClose={() => setDialogOpen(false)}
                onSubmit={(values) => run(onSave(values, editing?.id))}
                onDelete={editing ? () => run(onDelete(editing.id)) : undefined}
            />
        </div>
    );
}
