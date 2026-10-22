import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, XCircle } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Stagger } from "@tihlde/ui/ui/motion";

import {
    createMasterStudyMutation,
    getMasterStudyProgramsQuery,
} from "#/api/queries/master-study";
import { AdminNoAccess } from "#/components/admin-no-access";
import { AdminPageHeader } from "#/components/admin-page-header";
import {
    MasterStudyForm,
    type MasterStudyFormValues,
    emptyMasterStudyFormValues,
    masterStudyPayload,
    validateMasterStudyForm,
} from "#/components/master-study-form";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { requireAdminSection } from "#/lib/admin-access";
import { selectableMasterStudyPrograms } from "#/lib/master-study";

export const Route = createFileRoute("/admin/masterveiledning/ny")({
    component: NewMasterStudyPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "masterveiledning", {
            permission: ["master-study:create", "master-study:manage"],
        });
    },
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(
            getMasterStudyProgramsQuery(),
        );
        return { breadcrumbs: "Ny masterstudie" };
    },
});

function NewMasterStudyPage() {
    const navigate = useNavigate();
    const canCreate = useAnyScopePermission([
        "master-study:create",
        "master-study:manage",
    ]);
    const { data: programs } = useSuspenseQuery(getMasterStudyProgramsQuery());
    const [values, setValues] = useState<MasterStudyFormValues>(
        emptyMasterStudyFormValues,
    );
    const [formError, setFormError] = useState<string | null>(null);
    const create = useMutation(createMasterStudyMutation);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const error = validateMasterStudyForm(values);
        setFormError(error);
        if (error) return;

        // Creating takes «ikke oppgitt» as a missing field, not as null.
        const payload = masterStudyPayload(values);
        create.mutate(
            {
                data: {
                    ...payload,
                    financialSupport: payload.financialSupport ?? undefined,
                    summary: payload.summary ?? undefined,
                    subjectRequirements:
                        payload.subjectRequirements ?? undefined,
                    otherRequirements: payload.otherRequirements ?? undefined,
                    applicationDeadline:
                        payload.applicationDeadline ?? undefined,
                },
            },
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

            <AdminPageHeader title="Ny masterstudie" />

            {canCreate ? (
                <MasterStudyForm
                    values={values}
                    onChange={(patch) =>
                        setValues((current) => ({ ...current, ...patch }))
                    }
                    programs={selectableMasterStudyPrograms(programs)}
                    onSubmit={handleSubmit}
                    submitLabel={create.isPending ? "Lagrer …" : "Opprett"}
                    isSubmitting={create.isPending}
                    secondaryAction={
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                navigate({ to: "/admin/masterveiledning" })
                            }
                            disabled={create.isPending}
                        >
                            Avbryt
                        </Button>
                    }
                >
                    {formError && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke opprette</AlertTitle>
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}
                    {create.isError && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke opprette</AlertTitle>
                            <AlertDescription>
                                {create.error.message}
                            </AlertDescription>
                        </Alert>
                    )}
                </MasterStudyForm>
            ) : (
                <AdminNoAccess action="opprette masterstudier" />
            )}
        </Stagger>
    );
}
