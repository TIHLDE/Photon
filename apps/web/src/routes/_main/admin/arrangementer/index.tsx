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
import { listEventsQuery } from "~/lib/queries/events";

export const Route = createFileRoute("/_main/admin/arrangementer/")({
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(listEventsQuery({ pageSize: 50 })),
    component: AdminEventsPage,
});

function AdminEventsPage() {
    const { data } = useSuspenseQuery(listEventsQuery({ pageSize: 50 }));

    const handleDelete = async (eventId: string, title: string) => {
        if (!window.confirm(`Er du sikker på at du vil slette "${title}"?`))
            return;
        const { error } = await photon.DELETE("/api/event/{eventId}", {
            params: { path: { eventId } },
        });
        if (error) {
            toast.error("Kunne ikke slette arrangement");
            return;
        }
        toast.success("Arrangement slettet");
        window.location.reload();
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="font-heading text-2xl font-bold">
                    Arrangementer
                </h1>
                <a href="/admin/arrangementer/ny">
                    <Button size="sm">
                        <Plus className="mr-1 size-3.5" />
                        Nytt arrangement
                    </Button>
                </a>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tittel</TableHead>
                        <TableHead>Dato</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="w-24" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data?.items?.map((event) => (
                        <TableRow key={event.id}>
                            <TableCell className="font-medium">
                                {event.title}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatDateTime(event.startTime)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {event.category.label}
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-1">
                                    <a
                                        href={`/admin/arrangementer/${event.id}`}
                                    >
                                        <Button variant="ghost" size="sm">
                                            <Pencil className="size-3.5" />
                                        </Button>
                                    </a>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            handleDelete(event.id, event.title)
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
                                colSpan={4}
                                className="text-center text-muted-foreground"
                            >
                                Ingen arrangementer
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
