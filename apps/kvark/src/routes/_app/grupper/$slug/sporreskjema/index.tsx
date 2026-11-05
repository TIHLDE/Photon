import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { authQueryOptions } from "#/api/auth";
import {
    deleteFormMutation,
    getFormByIdQuery,
    getFormSubmissionsQuery,
    updateFormMutation,
} from "#/api/queries/forms";
import {
    createGroupFormMutation,
    getGroupBySlugQuery,
    getGroupFormsQuery,
} from "#/api/queries/groups";
import {
    FormEditDialog,
    type FormEditValues,
} from "#/components/form-edit-dialog";
import { GroupFormRow } from "#/components/group-form-row";
import {
    NewFormDialog,
    type NewFormValues,
} from "#/components/new-form-dialog";
import {
    useIsGroupLeaderOf,
    useScopedPermission,
} from "#/hooks/use-permission";
import { mapFormQuestions, toFormFieldsPayload } from "#/lib/form";
import { mapForm, type Form } from "#/lib/group";

export const Route = createFileRoute("/_app/grupper/$slug/sporreskjema/")({
    component: GroupFormsPage,
});

function GroupFormsPage() {
    const { slug } = Route.useParams();

    const { data: apiGroup } = useSuspenseQuery(getGroupBySlugQuery(slug));

    const { data: session } = useSuspenseQuery(authQueryOptions);

    const isLeader = useIsGroupLeaderOf(slug);

    const isArchived = Boolean(apiGroup.archivedAt);

    const isLoggedIn = Boolean(session);

    const [formDialogOpen, setFormDialogOpen] = useState(false);

    const [formError, setFormError] = useState<string | null>(null);

    const [editingForm, setEditingForm] = useState<Form | null>(null);

    const [editFormError, setEditFormError] = useState<string | null>(null);

    const [deleteFormError, setDeleteFormError] = useState<string | null>(null);

    const createGroupForm = useMutation(createGroupFormMutation);

    const updateForm = useMutation(updateFormMutation);

    const deleteForm = useMutation(deleteFormMutation);

    // Skjemaene til gruppen er scopet hit, akkurat som resten av siden: et
    // grant for denne gruppen teller, et grant for en annen gruppe gjør ikke.
    // Det var en global sjekk her, og den er strengere enn API-et — «Spørre-
    // skjema» huket av på et verv gir `forms:*` scopet til `group:<slug>`, og
    // da så nestlederen skjemaet uten å komme til «Rediger» og «Se svar»,
    // enda POST /groups/:slug/form og canManageForm begge slipper hen inn.
    //
    // De to spørsmålene stilles hver for seg fordi API-et stiller dem hver for
    // seg: å opprette krever forms:create, å redigere og lese svar krever
    // forms:update. Slått sammen ville et grant på den ene vist knappene for
    // den andre, og de knappene svarer 403.
    const canCreateForms =
        (useScopedPermission(
            ["forms:create", "forms:manage"],
            `group:${slug}`,
        ) ||
            isLeader) &&
        !isArchived;

    const canManageForms =
        (useScopedPermission(
            ["forms:update", "forms:manage"],
            `group:${slug}`,
        ) ||
            isLeader) &&
        !isArchived;

    const { data: apiForms } = useQuery({
        ...getGroupFormsQuery(slug),
        enabled: isLoggedIn,
    });

    // Spørsmålene ligger bare i detaljsvaret, og svarene avgjør om de kan
    // endres i det hele tatt. Begge hentes først når et skjema faktisk åpnes
    // for redigering.
    const { data: apiEditingForm } = useQuery({
        ...getFormByIdQuery(editingForm?.id ?? ""),
        enabled: editingForm !== null,
    });

    const { data: apiEditingSubmissions } = useQuery({
        ...getFormSubmissionsQuery(editingForm?.id ?? "", 0),
        enabled: editingForm !== null,
    });

    const forms = useMemo(() => (apiForms ?? []).map(mapForm), [apiForms]);

    // Redigeringsdialogen venter på begge: uten svarene vet den ikke om
    // spørsmålene er låst, og da ville de rukket å bli redigerbare først.
    const editingQuestions = useMemo(
        () =>
            apiEditingForm && apiEditingSubmissions
                ? mapFormQuestions(apiEditingForm.fields)
                : null,
        [apiEditingForm, apiEditingSubmissions],
    );

    function openNewForm() {
        setFormError(null);
        setFormDialogOpen(true);
    }

    /**
     * Rekkefølgen på spørsmål og alternativer er posisjonen i lista: API-et
     * sorterer på `order`, så uten den ville skjemaet vist spørsmålene i
     * vilkårlig rekkefølge.
     */
    async function handleCreateForm(values: NewFormValues) {
        setFormError(null);
        try {
            await createGroupForm.mutateAsync({
                slug,
                data: {
                    group: slug,
                    title: values.title,
                    template: false,
                    can_submit_multiple: values.canSubmitMultiple,
                    is_open_for_submissions: values.isOpenForSubmissions,
                    opens_at: values.opensAt
                        ? values.opensAt.toISOString()
                        : null,
                    closes_at: values.closesAt
                        ? values.closesAt.toISOString()
                        : null,
                    only_for_group_members: values.onlyForGroupMembers,
                    ...(values.description
                        ? { description: values.description }
                        : {}),
                    ...(values.emailReceiverOnSubmit
                        ? {
                              email_receiver_on_submit:
                                  values.emailReceiverOnSubmit,
                          }
                        : {}),
                    fields: values.questions.map((question, order) => ({
                        title: question.title,
                        type: question.type,
                        required: question.required,
                        order,
                        options:
                            question.type === "text_answer"
                                ? []
                                : question.options.map(
                                      (option, optionOrder) => ({
                                          title: option.title,
                                          order: optionOrder,
                                      }),
                                  ),
                    })),
                },
            });

            setFormDialogOpen(false);
        } catch (error) {
            setFormError(
                error instanceof Error
                    ? error.message
                    : "Ukjent feil da spørreskjemaet skulle opprettes",
            );
        }
    }

    function handleEditForm(form: Form | null) {
        setEditFormError(null);
        setDeleteFormError(null);
        setEditingForm(form);
    }

    /**
     * Sletting følger den samme tilgangen som redigering, og tar med seg
     * svarene: API-et kaskaderer til spørsmål, alternativer og innsendinger.
     */
    async function handleDeleteForm() {
        if (!editingForm) return;
        setDeleteFormError(null);
        try {
            await deleteForm.mutateAsync({ formId: editingForm.id });
            setEditingForm(null);
        } catch (error) {
            setDeleteFormError(
                error instanceof Error
                    ? error.message
                    : "Ukjent feil da skjemaet skulle slettes",
            );
        }
    }

    /**
     * Spørsmålene sendes alltid med, id-ene inkludert: `updateFieldsAndOptions`
     * kjenner igjen spørsmål og alternativer på id og lar svarene stå. API-et
     * avviser bare endringene som ville tatt svar med seg — se
     * `findDestructiveFieldChanges`.
     */
    async function handleSaveForm(values: FormEditValues) {
        if (!editingForm) return;
        setEditFormError(null);
        try {
            await updateForm.mutateAsync({
                formId: editingForm.id,
                data: {
                    title: values.title,
                    description: values.description,
                    is_open_for_submissions: values.isOpen,
                    opens_at: values.opensAt
                        ? values.opensAt.toISOString()
                        : null,
                    closes_at: values.closesAt
                        ? values.closesAt.toISOString()
                        : null,
                    can_submit_multiple: values.canSubmitMultiple,
                    only_for_group_members: values.onlyForMembers,
                    email_receiver_on_submit: values.emailReceiver || null,
                    fields: toFormFieldsPayload(values.questions),
                },
            });
            setEditingForm(null);
        } catch (error) {
            setEditFormError(
                error instanceof Error
                    ? error.message
                    : "Ukjent feil da skjemaet skulle lagres",
            );
        }
    }

    if (!isLoggedIn) return <Navigate to="/grupper/$slug" params={{ slug }} />;
    return (
        <>
            <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl">Spørreskjema</h2>
                    {canCreateForms ? (
                        <Button onClick={openNewForm}>
                            <Plus />
                            Nytt spørreskjema
                        </Button>
                    ) : null}
                </div>
                {forms.length > 0 ? (
                    <ul className="flex flex-col gap-3">
                        {forms.map((form) => (
                            <li key={form.id}>
                                <GroupFormRow
                                    form={form}
                                    canManage={canManageForms}
                                    onEdit={() => handleEditForm(form)}
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
            <NewFormDialog
                open={formDialogOpen}
                onOpenChange={setFormDialogOpen}
                onSubmit={handleCreateForm}
                isSubmitting={createGroupForm.isPending}
                error={formError}
            />
            <FormEditDialog
                open={editingForm !== null}
                form={editingForm}
                questions={editingQuestions}
                answerCount={apiEditingSubmissions?.length ?? 0}
                onClose={() => handleEditForm(null)}
                onSubmit={handleSaveForm}
                isSubmitting={updateForm.isPending}
                error={editFormError}
                onDelete={canManageForms ? handleDeleteForm : undefined}
                isDeleting={deleteForm.isPending}
                deleteError={deleteFormError}
            />
        </>
    );
}
