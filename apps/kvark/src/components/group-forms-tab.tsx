import { Button } from "@tihlde/ui/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";

import { GroupFormRow } from "#/components/group-form-row";
import { GroupNewFormDialog } from "#/components/group-new-form-dialog";
import { GroupPageHeader } from "#/components/group-page-header";
import type { Form } from "#/lib/group";

type GroupFormsTabProps = {
    forms: Form[];
    isAdmin: boolean;
};

export function GroupFormsTab({ forms, isAdmin }: GroupFormsTabProps) {
    const [creating, setCreating] = useState(false);
    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader
                title="Spørreskjema"
                action={
                    isAdmin ? (
                        <Button onClick={() => setCreating(true)}>
                            <Plus />
                            Nytt spørreskjema
                        </Button>
                    ) : null
                }
            />
            {forms.length > 0 ? (
                <ul className="flex flex-col gap-3">
                    {forms.map((form) => (
                        <li key={form.id}>
                            <GroupFormRow form={form} />
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Ingen spørreskjema tilgjengelig ennå.
                </p>
            )}
            <GroupNewFormDialog
                open={creating}
                onClose={() => setCreating(false)}
            />
        </div>
    );
}
