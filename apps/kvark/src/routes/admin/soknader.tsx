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
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { authQueryOptions, sessionHasPermission } from "#/api/auth";
import {
    type ApplicationType,
    fetchApplicationAttachmentUrl,
    fetchApplicationPdfUrl,
    getApplicationQuery,
    getApplicationsQuery,
    updateApplicationStatusMutation,
} from "#/api/queries/applications";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { AdminDetailDialog } from "#/components/soknader/admin-detail-dialog";
import { ApplicationStatusBadge } from "#/components/soknader/status-badge";

const searchSchema = z.object({
    /** Deep link from the notification email opens this søknad directly. */
    id: z.string().optional(),
    type: z
        .enum(["expense", "support", "sports_support", "hs_case"])
        .optional(),
});

export const Route = createFileRoute("/admin/soknader")({
    component: AdminApplicationsPage,
    validateSearch: searchSchema,
    loader: () => ({ breadcrumbs: "Søknader" }),
});

/**
 * Which type tab a viewer sees depends on what they may handle: the
 * Finansminister gets Utlegg and Støtte, HS gets Støtte and HS-saker, IdKom
 * only Idrettslag. The API narrows the data the same way — this just keeps
 * the UI from offering empty tabs.
 */
const TYPE_TABS: {
    value: ApplicationType;
    label: string;
    permissions: string[];
}[] = [
    {
        value: "expense",
        label: "Utlegg",
        permissions: ["applications:view", "applications:expense:view"],
    },
    {
        value: "support",
        label: "Støtte",
        permissions: ["applications:view", "applications:support:view"],
    },
    {
        value: "sports_support",
        label: "Idrettslag",
        permissions: ["applications:view", "applications:sports-support:view"],
    },
    {
        value: "hs_case",
        label: "Saker til HS",
        permissions: ["applications:view", "applications:hs-case:view"],
    },
];

function AdminApplicationsPage() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();

    const { data: session } = useQuery(authQueryOptions);
    const visibleTabs = TYPE_TABS.filter((tab) =>
        sessionHasPermission(session?.permissions, tab.permissions),
    );

    const activeType = search.type ?? visibleTabs[0]?.value;

    const { data: applications, isLoading } = useQuery({
        ...getApplicationsQuery(activeType ? { type: activeType } : undefined),
        enabled: Boolean(session) && visibleTabs.length > 0,
    });

    const selectedId = search.id;
    const { data: selected, isLoading: isLoadingDetail } = useQuery({
        ...getApplicationQuery(selectedId ?? ""),
        enabled: Boolean(selectedId),
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

    if (visibleTabs.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <AdminPageHeader
                    title="Søknader"
                    description="Utlegg, søknader om støtte og saker meldt inn til Hovedstyret."
                />
                <AdminEmptyState
                    icon={FileText}
                    title="Ingen tilgang"
                    description="Du har ikke tilgang til å behandle noen søknadstyper."
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <AdminPageHeader
                title="Søknader"
                description="Utlegg, søknader om støtte og saker meldt inn til Hovedstyret."
            />

            <Tabs
                value={activeType}
                onValueChange={(value) =>
                    navigate({
                        search: (prev) => ({
                            ...prev,
                            type: value as ApplicationType,
                        }),
                    })
                }
            >
                <TabsList>
                    {visibleTabs.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {!isLoading && (applications ?? []).length === 0 ? (
                <AdminEmptyState
                    icon={FileText}
                    title="Ingen søknader"
                    description="Det har ikke kommet inn noen søknader av denne typen ennå."
                />
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Innsender</TableHead>
                                    <TableHead>Beskrivelse</TableHead>
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
                                            {new Date(
                                                application.createdAt,
                                            ).toLocaleDateString("nb-NO")}
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
                                                    Behandle
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
        </div>
    );
}
