import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLinkIcon, XCircle } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Stagger } from "@tihlde/ui/ui/motion";

import {
    deleteMasterStudyMutation,
    getMasterStudyProgramsQuery,
    getMasterStudyQuery,
    updateMasterStudyMutation,
} from "#/api/queries/master-study";
import { AdminNoAccess } from "#/components/admin-no-access";
import { AdminPageHeader } from "#/components/admin-page-header";
import { ConfirmDeleteDialog } from "#/components/confirm-delete-dialog";
import {
    MasterStudyForm,
    type MasterStudyFormValues,
    masterStudyFormValues,
    masterStudyPayload,
    validateMasterStudyForm,
} from "#/components/master-study-form";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { requireAdminSection } from "#/lib/admin-access";
import { selectableMasterStudyPrograms } from "#/lib/master-study";

export const Route = createFileRoute("/admin/masterveiledning/$studyId")({
    component: EditMasterStudyPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "masterveiledning");
    },
    loader: async ({ context, params }) => {
        const [entry] = await Promise.all([
            context.queryClient.ensureQueryData(
                getMasterStudyQuery(params.studyId),
            ),
            context.queryClient.ensureQueryData(getMasterStudyProgramsQuery()),
        ]);
        return { breadcrumbs: entry.name };
    },
});

function EditMasterStudyPage() {
    const { studyId } = Route.useParams();
    const navigate = useNavigate();
    const canEdit = useAnyScopePermission([
        "master-study:update",
        "master-study:manage",
    ]);
    const canDelete = useAnyScopePermission([
        "master-study:delete",
        "master-study:manage",
    ]);
    const { data: entry } = useSuspenseQuery(getMasterStudyQuery(studyId));
    const { data: programs } = useSuspenseQuery(getMasterStudyProgramsQuery());
    const [values, setValues] = useState<MasterStudyFormValues>(() =>
        masterStudyFormValues(entry),
    );
    const [formError, setFormError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const update = useMutation(updateMasterStudyMutation);
    const remove = useMutation(deleteMasterStudyMutation);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const error = validateMasterStudyForm(values);
        setFormError(error);
        if (error) return;

        update.mutate(
            { id: entry.id, data: masterStudyPayload(values) },
            {
                onSuccess() {
                    navigate({ to: "/admin/masterveiledning" });
                },
            },
        );
    }

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" />
            }
        >
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    render={<Link to="/admin/masterveiledning" />}
                >
                    <ArrowLeft />
                    Alle masterstudier
                </Button>
            </div>

            <AdminPageHeader
                title={entry.name}
                action={
                    <Button
                        variant="outline"
                        render={
                            <Link
                                to="/masterveiledning/$id"
                                params={{ id: entry.id }}
                            />
                        }
                    >
                        <ExternalLinkIcon className="size-4" />
                        Se siden
                    </Button>
                }
            />

            {canEdit ? (
                <MasterStudyForm
                    values={values}
                    onChange={(patch) =>
                        setValues((current) => ({ ...current, ...patch }))
                    }
                    programs={selectableMasterStudyPrograms(programs)}
                    onSubmit={handleSubmit}
                    submitLabel={update.isPending ? "Lagrer …" : "Lagre"}
                    isSubmitting={update.isPending}
                    secondaryAction={
                        canDelete ? (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => setConfirmDelete(true)}
                                disabled={remove.isPending}
                            >
                                Slett masterstudie
                            </Button>
                        ) : undefined
                    }
                >
                    {formError && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke lagre</AlertTitle>
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}
                    {update.isError && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke lagre</AlertTitle>
                            <AlertDescription>
                                {update.error.message}
                            </AlertDescription>
                        </Alert>
                    )}
                </MasterStudyForm>
            ) : (
                <AdminNoAccess action="redigere masterstudier" />
            )}

            <ConfirmDeleteDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title={`Slette «${entry.name}»?`}
                description="Masterstudiet og alle sitatene på det forsvinner fra Masterveiledning."
                confirmLabel="Slett masterstudie"
                isPending={remove.isPending}
                onConfirm={() =>
                    remove.mutate(
                        { id: entry.id },
                        {
                            onSuccess() {
                                navigate({ to: "/admin/masterveiledning" });
                            },
                        },
                    )
                }
            />
        </Stagger>
    );
}
