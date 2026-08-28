import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import { Stagger } from "@tihlde/ui/ui/motion";
import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import {
    fetchApplicationAttachmentUrl,
    fetchApplicationPdfUrl,
    getApplicationQuery,
    getApplicationsQuery,
    updateApplicationStatusMutation,
} from "#/api/queries/applications";
import { requireAdminSection } from "#/lib/admin-access";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { AdminDetailDialog } from "#/components/soknader/admin-detail-dialog";
import { ApplicationStatusBadge } from "#/components/soknader/status-badge";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { formatOsloDate } from "#/lib/date";

const searchSchema = z.object({
    /** Deep link from the notification email opens this henvendelse directly. */
    id: z.string().optional(),
});

export const Route = createFileRoute("/admin/kontaktskjema")({
    component: AdminCompanyContactPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "kontaktskjema");
    },
    validateSearch: searchSchema,
    loader: () => ({ breadcrumbs: "Kontaktskjema" }),
});

/**
 * Henvendelser bedrifter sender inn via kontaktskjemaet på bedriftssiden.
 *
 * These are stored as applications of type `company_contact`, but they are
 * not søknader in any sense that matters to the people handling them, so
 * they get their own page behind their own `company-contact:*` grant.
 */
function AdminCompanyContactPage() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();

    const canView = useAnyScopePermission([
        "company-contact:view",
        "company-contact:manage",
    ]);
    // Reading the list needs `:view`; changing the status needs `:manage`.
    // Without it the dialog is read-only and the row button says "Se".
    const canManage = useAnyScopePermission(["company-contact:manage"]);

    const { data: applications, isLoading } = useQuery({
        ...getApplicationsQuery({ type: "company_contact" }),
        enabled: canView,
    });

    const selectedId = search.id;
    const { data: selected, isLoading: isLoadingDetail } = useQuery({
        ...getApplicationQuery(selectedId ?? ""),
        enabled: Boolean(selectedId) && canView,
    });

    const updateStatus = useMutation(updateApplicationStatusMutation);

    const [attachmentUrls, setAttachmentUrls] = useState<
        Record<string, string>
    >({});

    // Attachments are private, so each one is fetched with credentials and
    // held as an object URL for as long as the dialog is open.
    useEffect(() => {
        if (!selected) {
            setAttachmentUrls({});
            return;
        }

        let cancelled = false;
        const created: string[] = [];

        (async () => {
            const entries: Record<string, string> = {};
            for (const attachment of selected.attachments) {
                try {
                    const url = await fetchApplicationAttachmentUrl(
                        selected.id,
                        attachment.assetKey,
                    );
                    created.push(url);
                    entries[attachment.assetKey] = url;
                } catch {
                    // A missing attachment should not blank the dialog.
                }
            }
            if (!cancelled) setAttachmentUrls(entries);
        })();

        return () => {
            cancelled = true;
            for (const url of created) URL.revokeObjectURL(url);
        };
    }, [selected]);

    function openApplication(id: string) {
        navigate({ search: (prev) => ({ ...prev, id }) });
    }

    function closeDialog() {
        navigate({ search: (prev) => ({ ...prev, id: undefined }) });
    }

    async function downloadPdf(id: string) {
        const url = await fetchApplicationPdfUrl(id);
        window.open(url, "_blank", "noopener");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }

    const header = (
        <AdminPageHeader
            title="Kontaktskjema"
            description="Henvendelser bedrifter har sendt inn via kontaktskjemaet."
        />
    );

    if (!canView) {
        return (
            <Stagger render={<div className="flex flex-col gap-6" />}>
                {header}
                <AdminEmptyState
                    icon={Building2}
                    title="Ingen tilgang"
                    description="Du har ikke tilgang til å behandle henvendelser fra bedrifter."
                />
            </Stagger>
        );
    }

    return (
        <Stagger render={<div className="flex flex-col gap-6" />}>
            {header}

            {!isLoading && (applications ?? []).length === 0 ? (
                <AdminEmptyState
                    icon={Building2}
                    title="Ingen henvendelser"
                    description="Det har ikke kommet inn noen henvendelser fra bedrifter ennå."
                />
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kontaktperson</TableHead>
                                    <TableHead>Emne</TableHead>
                                    <TableHead>Mottatt</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">
                                        Handlinger
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(applications ?? []).map((application) => (
                                    <TableRow key={application.id}>
                                        <TableCell>
                                            {application.contactName}
                                        </TableCell>
                                        <TableCell>
                                            {application.title}
                                        </TableCell>
                                        <TableCell>
                                            {formatOsloDate(
                                                application.createdAt,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <ApplicationStatusBadge
                                                status={application.status}
                                                label={application.statusLabel}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        openApplication(
                                                            application.id,
                                                        )
                                                    }
                                                >
                                                    {canManage
                                                        ? "Behandle"
                                                        : "Se"}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <AdminDetailDialog
                open={Boolean(selectedId)}
                onOpenChange={(open) => {
                    if (!open) closeDialog();
                }}
                application={selected}
                isLoading={isLoadingDetail}
                attachmentUrls={attachmentUrls}
                isSaving={updateStatus.isPending}
                canManage={canManage}
                onDownloadPdf={() => {
                    if (selectedId) void downloadPdf(selectedId);
                }}
                onSave={(values) => {
                    if (!selectedId) return;
                    updateStatus.mutate({
                        id: selectedId,
                        data: {
                            status: values.status,
                            internalComment: values.internalComment || null,
                            messageToSubmitter:
                                values.messageToSubmitter || undefined,
                        },
                    });
                }}
            />
        </Stagger>
    );
}
