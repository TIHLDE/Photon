import { Button } from "@tihlde/ui/ui/button";
import { Plus } from "lucide-react";

import {
    GroupFormEditDialog,
    type GroupFormEditValues,
} from "#/components/group-form-edit-dialog";
import { GroupFormRow } from "#/components/group-form-row";
import { GroupNewFormDialog } from "#/components/group-new-form-dialog";
import { GroupPageHeader } from "#/components/group-page-header";
import type { FormQuestionValues } from "#/lib/form";
import type { Form } from "#/lib/group";

type GroupFormsTabProps = {
    forms: Form[];
    isAdmin: boolean;
    isCreateOpen: boolean;
    onOpenCreate: () => void;
    onCloseCreate: () => void;
    onCreate: (values: { title: string }) => void;
    isCreating: boolean;
    createError: string | null;
    /** Skjemaet som redigeres. Null når dialogen er lukket. */
    editingForm: Form | null;
    /** Spørsmålene til skjemaet som redigeres. Null mens de lastes. */
    editingQuestions: FormQuestionValues[] | null;
    editingAnswerCount: number;
    onEditForm: (form: Form | null) => void;
    onSave: (values: GroupFormEditValues) => void;
    isSaving: boolean;
    saveError: string | null;
};

export function GroupFormsTab({
    forms,
    isAdmin,
    isCreateOpen,
    onOpenCreate,
    onCloseCreate,
    onCreate,
    isCreating,
    createError,
    editingForm,
    editingQuestions,
    editingAnswerCount,
    onEditForm,
    onSave,
    isSaving,
    saveError,
}: GroupFormsTabProps) {
    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader
                title="Spørreskjema"
                action={
                    isAdmin ? (
                        <Button onClick={onOpenCreate}>
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
                                canManage={isAdmin}
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
            <GroupNewFormDialog
                open={isCreateOpen}
                onClose={onCloseCreate}
                onSubmit={onCreate}
                isSubmitting={isCreating}
                error={createError}
            />
            <GroupFormEditDialog
                open={editingForm !== null}
                form={editingForm}
                questions={editingQuestions}
                answerCount={editingAnswerCount}
                onClose={() => onEditForm(null)}
                onSubmit={onSave}
                isSubmitting={isSaving}
                error={saveError}
            />
        </div>
    );
}
