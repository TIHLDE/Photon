import { Button } from "@tihlde/ui/ui/button";
import { Plus } from "lucide-react";

import { GroupFormRow } from "#/components/group-form-row";
import { GroupPageHeader } from "#/components/group-page-header";
import type { Form } from "#/lib/group";

type GroupFormsTabProps = {
    forms: Form[];
    /** Får opprette nye skjema for gruppen — `forms:create` her, eller ledervervet. */
    canCreate: boolean;
    /** Får redigere skjemaene og lese svarene — `forms:update`, eller ledervervet. */
    canManage: boolean;
    onNewForm: () => void;
    onEditForm: (form: Form) => void;
};

export function GroupFormsTab({
    forms,
    canCreate,
    canManage,
    onNewForm,
    onEditForm,
}: GroupFormsTabProps) {
    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader
                title="Spørreskjema"
                action={
                    canCreate ? (
                        <Button onClick={onNewForm}>
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
                            <GroupFormRow
                                form={form}
                                canManage={canManage}
                                onEdit={() => onEditForm(form)}
                            />
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Ingen spørreskjema tilgjengelig ennå.
                </p>
            )}
        </div>
    );
}
