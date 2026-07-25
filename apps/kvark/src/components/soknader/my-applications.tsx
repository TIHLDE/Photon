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
import { Download, ListChecks } from "lucide-react";
import type { ApplicationSummary } from "#/api/queries/applications";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { ApplicationStatusBadge } from "./status-badge";

type MyApplicationsProps = {
    applications: ApplicationSummary[];
    /** Null while the PDF for that id is being fetched. */
    downloadingId: string | null;
    onDownloadPdf: (id: string) => void;
};

export function MyApplications({
    applications,
    downloadingId,
    onDownloadPdf,
}: MyApplicationsProps) {
    if (applications.length === 0) {
        return (
            <AdminEmptyState
                icon={ListChecks}
                title="Ingen søknader ennå"
                description="Søknadene du sender inn dukker opp her, sammen med statusen på behandlingen."
            />
        );
    }

    return (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Beskrivelse</TableHead>
                            <TableHead>Sendt inn</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">PDF</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {applications.map((application) => (
                            <TableRow key={application.id}>
                                <TableCell>{application.typeLabel}</TableCell>
                                <TableCell>{application.title}</TableCell>
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
                                            variant="ghost"
                                            size="sm"
                                            disabled={
                                                !application.hasPdf ||
                                                downloadingId === application.id
                                            }
                                            onClick={() =>
                                                onDownloadPdf(application.id)
                                            }
                                        >
                                            <Download className="size-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
