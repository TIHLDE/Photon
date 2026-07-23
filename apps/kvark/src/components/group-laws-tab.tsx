import { Button } from "@tihlde/ui/ui/button";
import { useState } from "react";

import { GroupLawFormDialog } from "#/components/group-law-form-dialog";
import type { LawFormValues } from "#/components/group-law-form-dialog";
import { GroupLawItem } from "#/components/group-law-item";
import { GroupPageHeader } from "#/components/group-page-header";
import type { Law } from "#/lib/group";

type GroupLawsTabProps = {
    laws: Law[];
    canManage: boolean;
    onSave: (values: LawFormValues, lawId?: string) => void;
    onDelete: (lawId: string) => void;
};

export function GroupLawsTab({
    laws,
    canManage,
    onSave,
    onDelete,
}: GroupLawsTabProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Law | null>(null);

    function openCreate() {
        setEditing(null);
        setDialogOpen(true);
    }

    function openEdit(law: Law) {
        setEditing(law);
        setDialogOpen(true);
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
                            onEdit={() => {
                                if (canManage) openEdit(law);
                            }}
                        />
                    ))}
                </div>
            )}

            <GroupLawFormDialog
                open={dialogOpen}
                law={editing}
                onClose={() => setDialogOpen(false)}
                onSubmit={(values) => {
                    onSave(values, editing?.id);
                    setDialogOpen(false);
                }}
                onDelete={
                    editing
                        ? () => {
                              onDelete(editing.id);
                              setDialogOpen(false);
                          }
                        : undefined
                }
            />
        </div>
    );
}
