import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { photon } from "~/lib/api";
import { formatDate } from "~/lib/date";
import { listJobsQuery } from "~/lib/queries/jobs";

export const Route = createFileRoute("/_main/admin/stillingsannonser/")({
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(listJobsQuery({ pageSize: 50 })),
    component: AdminJobsPage,
});

const TYPE_LABELS: Record<string, string> = {
    full_time: "Fulltid",
    part_time: "Deltid",
    summer_job: "Sommerjobb",
    other: "Annet",
};

function AdminJobsPage() {
    const { data } = useSuspenseQuery(listJobsQuery({ pageSize: 50 }));

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`Er du sikker på at du vil slette "${title}"?`))
            return;
        const { error } = await photon.DELETE("/api/jobs/{id}", {
            params: { path: { id } },
        });
        if (error) {
            toast.error("Kunne ikke slette stillingsannonse");
            return;
        }
        toast.success("Stillingsannonse slettet");
        window.location.reload();
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="font-heading text-2xl font-bold">
                    Stillingsannonser
                </h1>
                <a href="/admin/stillingsannonser/ny">
                    <Button size="sm">
                        <Plus className="mr-1 size-3.5" />
                        Ny annonse
                    </Button>
                </a>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tittel</TableHead>
                        <TableHead>Bedrift</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Frist</TableHead>
                        <TableHead className="w-24" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data?.items?.map((job) => (
                        <TableRow key={job.id}>
                            <TableCell className="font-medium">
                                {job.title}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {job.company}
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary">
                                    {TYPE_LABELS[job.jobType] ?? job.jobType}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {job.deadline
                                    ? formatDate(job.deadline)
                                    : "Løpende"}
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-1">
                                    <a
                                        href={`/admin/stillingsannonser/${job.id}`}
                                    >
                                        <Button variant="ghost" size="sm">
                                            <Pencil className="size-3.5" />
                                        </Button>
                                    </a>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            handleDelete(job.id, job.title)
                                        }
                                    >
                                        <Trash2 className="size-3.5 text-destructive" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    {(!data?.items || data.items.length === 0) && (
                        <TableRow>
                            <TableCell
                                colSpan={5}
                                className="text-center text-muted-foreground"
                            >
                                Ingen stillingsannonser
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
