import { Button } from "@tihlde/ui/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";

import { GroupFormRow } from "#/components/group-form-row";
import { GroupNewFormDialog } from "#/components/group-new-form-dialog";
import { GroupPageHeader } from "#/components/group-page-header";
import { FORMS } from "#/mock/group-detail";

export function GroupFormsTab() {
    const [creating, setCreating] = useState(false);
    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader
                title="Spørreskjema"
                action={
                    <Button onClick={() => setCreating(true)}>
                        <Plus />
                        Nytt spørreskjema
                    </Button>
                }
            />
            <ul className="flex flex-col gap-3">
                {FORMS.map((form) => (
                    <li key={form.id}>
                        <GroupFormRow form={form} />
                    </li>
                ))}
            </ul>
            <GroupNewFormDialog
                open={creating}
                onClose={() => setCreating(false)}
            />
        </div>
    );
}
