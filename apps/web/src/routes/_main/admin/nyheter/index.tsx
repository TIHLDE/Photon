import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { formatDateTime } from "~/lib/date";
import { listNewsQuery } from "~/lib/queries/news";

export const Route = createFileRoute("/_main/admin/nyheter/")({
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(listNewsQuery({ pageSize: 50 })),
    component: AdminNewsPage,
});

function AdminNewsPage() {
    const { data } = useSuspenseQuery(listNewsQuery({ pageSize: 50 }));

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`Er du sikker på at du vil slette "${title}"?`))
            return;
        const { error } = await photon.DELETE("/api/news/{id}", {
            params: { path: { id } },
        });
        if (error) {
            toast.error("Kunne ikke slette nyhet");
            return;
        }
        toast.success("Nyhet slettet");
        window.location.reload();
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="font-heading text-2xl font-bold">Nyheter</h1>
                <a href="/admin/nyheter/ny">
                    <Button size="sm">
                        <Plus className="mr-1 size-3.5" />
                        Ny artikkel
                    </Button>
                </a>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tittel</TableHead>
                        <TableHead>Opprettet</TableHead>
                        <TableHead className="w-24" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data?.items?.map((article) => (
                        <TableRow key={article.id}>
                            <TableCell className="font-medium">
                                {article.title}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {article.createdAt
                                    ? formatDateTime(article.createdAt)
                                    : "-"}
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-1">
                                    <a href={`/admin/nyheter/${article.id}`}>
                                        <Button variant="ghost" size="sm">
                                            <Pencil className="size-3.5" />
                                        </Button>
                                    </a>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            handleDelete(
                                                article.id,
                                                article.title,
                                            )
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
                                colSpan={3}
                                className="text-center text-muted-foreground"
                            >
                                Ingen nyheter
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
