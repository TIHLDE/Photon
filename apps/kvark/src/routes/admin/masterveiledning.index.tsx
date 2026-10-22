import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
    ExternalLinkIcon,
    GraduationCapIcon,
    PencilIcon,
    PlusIcon,
    Trash2,
} from "lucide-react";
import { Suspense, useMemo, useState } from "react";

import type { MasterStudyEntry } from "@tihlde/sdk";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Stagger } from "@tihlde/ui/ui/motion";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@tihlde/ui/ui/toggle-group";

import {
    deleteMasterStudyMutation,
    getMasterStudiesQuery,
} from "#/api/queries/master-study";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import {
    ConfirmDeleteDialog,
    usePendingConfirm,
} from "#/components/confirm-delete-dialog";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { requireAdminSection } from "#/lib/admin-access";
import {
    LOCATION_TYPE_LABELS,
    MASTER_STUDY_PROGRAMS,
    formatMasterStudyDate,
} from "#/lib/master-study";

/** The short sidebar name where there is one, else the full name. */
function programLabel(program: { slug: string; displayName: string }) {
    return (
        MASTER_STUDY_PROGRAMS.find((p) => p.slug === program.slug)?.label ??
        program.displayName
    );
}

export const Route = createFileRoute("/admin/masterveiledning/")({
    component: MasterStudyAdminPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "masterveiledning");
    },
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getMasterStudiesQuery());
        return { breadcrumbs: "Masterveiledning" };
    },
});

function MasterStudyAdminPage() {
    const canCreate = useAnyScopePermission([
        "master-study:create",
        "master-study:manage",
    ]);

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title="Masterveiledning"
                description="Masterstudier som anbefales etter Dataingeniør, DigSec og DigFor, med sitater fra de som har tatt dem."
                action={
                    <>
                        <Button
                            variant="outline"
                            render={<Link to="/masterveiledning" />}
                        >
                            <ExternalLinkIcon className="size-4" />
                            Se siden
                        </Button>
                        {canCreate ? (
                            <Button
                                render={
                                    <Link to="/admin/masterveiledning/ny" />
                                }
                            >
                                <PlusIcon className="size-4" />
                                Ny masterstudie
                            </Button>
                        ) : null}
                    </>
                }
            />

            <Suspense fallback={<TableSkeleton />}>
                <EntriesTable />
            </Suspense>
        </Stagger>
    );
}

function TableSkeleton() {
    return (
        <Card>
            <CardContent className="flex flex-col gap-3 p-6">
                {Array.from({ length: 5 }, (_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                ))}
            </CardContent>
        </Card>
    );
}

function EntriesTable() {
    const { data } = useSuspenseQuery(getMasterStudiesQuery());
    const remove = useMutation(deleteMasterStudyMutation);
    const canEdit = useAnyScopePermission([
        "master-study:update",
        "master-study:manage",
    ]);
    const canDelete = useAnyScopePermission([
        "master-study:delete",
        "master-study:manage",
    ]);
    const confirmDelete = usePendingConfirm<MasterStudyEntry>();
    const [programFilter, setProgramFilter] = useState<string>("alle");

    const entries = useMemo(
        () =>
            programFilter === "alle"
                ? data.items
                : data.items.filter(
                      (e) => e.studyProgram.slug === programFilter,
                  ),
        [data.items, programFilter],
    );

    function countFor(slug: string) {
        return data.items.filter((e) => e.studyProgram.slug === slug).length;
    }

    if (data.items.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={GraduationCapIcon}
                        title="Ingen masterstudier"
                        description="Ingen masterstudier er lagt inn ennå."
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <ToggleGroup
                variant="outline"
                size="sm"
                className="flex-wrap"
                aria-label="Filtrer på studieprogram"
                value={[programFilter]}
                onValueChange={(value) => {
                    if (value[0]) setProgramFilter(value[0]);
                }}
            >
                <ToggleGroupItem value="alle">
                    Alle ({data.items.length})
                </ToggleGroupItem>
                {MASTER_STUDY_PROGRAMS.map((program) => (
                    <ToggleGroupItem key={program.slug} value={program.slug}>
                        {program.label} ({countFor(program.slug)})
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Masterstudie</TableHead>
                                <TableHead className="hidden sm:table-cell">
                                    Type
                                </TableHead>
                                <TableHead className="hidden lg:table-cell">
                                    Frist
                                </TableHead>
                                <TableHead className="text-right">
                                    <span className="sr-only">Handlinger</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map((entry) => (
                                <TableRow key={entry.id}>
                                    <TableCell className="whitespace-normal">
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <Link
                                                to="/masterveiledning/$id"
                                                params={{ id: entry.id }}
                                                className="underline"
                                            >
                                                {entry.name}
                                            </Link>
                                            <span className="text-muted-foreground text-xs">
                                                {programLabel(
                                                    entry.studyProgram,
                                                )}{" "}
                                                · {entry.location}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                        <Badge variant="outline">
                                            {
                                                LOCATION_TYPE_LABELS[
                                                    entry.locationType
                                                ]
                                            }
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {entry.applicationDeadline
                                            ? formatMasterStudyDate(
                                                  entry.applicationDeadline,
                                              )
                                            : "–"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-1">
                                            {canEdit ? (
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label={`Rediger ${entry.name}`}
                                                    render={
                                                        <Link
                                                            to="/admin/masterveiledning/$studyId"
                                                            params={{
                                                                studyId:
                                                                    entry.id,
                                                            }}
                                                        />
                                                    }
                                                >
                                                    <PencilIcon />
                                                </Button>
                                            ) : null}
                                            {canDelete ? (
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label={`Slett ${entry.name}`}
                                                    disabled={remove.isPending}
                                                    onClick={() =>
                                                        confirmDelete.request(
                                                            entry,
                                                        )
                                                    }
                                                >
                                                    <Trash2 />
                                                </Button>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <ConfirmDeleteDialog
                open={confirmDelete.open}
                onOpenChange={(open) => !open && confirmDelete.clear()}
                title={`Slette «${confirmDelete.shown?.name}»?`}
                description="Masterstudiet og alle sitatene på det forsvinner fra Masterveiledning."
                confirmLabel="Slett masterstudie"
                isPending={remove.isPending}
                onConfirm={() => {
                    if (!confirmDelete.pending) return;
                    remove.mutate({ id: confirmDelete.pending.id });
                    confirmDelete.clear();
                }}
            />
        </>
    );
}
