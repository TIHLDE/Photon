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
import { listFormsQuery } from "~/lib/queries/forms";

export const Route = createFileRoute("/_main/admin/skjemaer/")({
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(listFormsQuery()),
    component: AdminFormsPage,
});

function AdminFormsPage() {
    const { data: forms } = useSuspenseQuery(listFormsQuery());

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`Er du sikker på at du vil slette "${title}"?`))
            return;
        const { error } = await photon.DELETE("/api/forms/{id}", {
            params: { path: { id } },
        });
        if (error) {
            toast.error("Kunne ikke slette skjema");
            return;
        }
        toast.success("Skjema slettet");
        window.location.reload();
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="font-heading text-2xl font-bold">Skjemaer</h1>
                <a href="/admin/skjemaer/ny">
                    <Button size="sm">
                        <Plus className="mr-1 size-3.5" />
                        Nytt skjema
                    </Button>
                </a>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tittel</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="w-24" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {forms?.map((form) => (
                        <TableRow key={form.id}>
                            <TableCell className="font-medium">
                                {form.title}
                            </TableCell>
                            <TableCell>
                                {form.template ? (
                                    <Badge variant="secondary">Mal</Badge>
                                ) : (
                                    <Badge variant="outline">Skjema</Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-1">
                                    <a href={`/admin/skjemaer/${form.id}`}>
                                        <Button variant="ghost" size="sm">
                                            <Pencil className="size-3.5" />
                                        </Button>
                                    </a>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            handleDelete(form.id, form.title)
                                        }
                                    >
                                        <Trash2 className="size-3.5 text-destructive" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    {(!forms || forms.length === 0) && (
                        <TableRow>
                            <TableCell
                                colSpan={3}
                                className="text-center text-muted-foreground"
                            >
                                Ingen skjemaer
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
