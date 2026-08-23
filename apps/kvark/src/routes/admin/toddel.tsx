import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpenIcon, PencilIcon, PlusIcon, Trash2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { z } from "zod";

import type { ToddelIssue } from "@tihlde/sdk";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";

import { Stagger } from "@tihlde/ui/ui/motion";

import { requireAdminSection } from "#/lib/admin-access";
import { uploadAssetMutation } from "#/api/queries/assets";
import {
    createToddelMutation,
    deleteToddelMutation,
    getToddelIssuesQuery,
    updateToddelMutation,
} from "#/api/queries/toddel";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminImageField } from "#/components/admin-image-field";
import { AdminPageHeader } from "#/components/admin-page-header";
import { errorStatus } from "#/lib/utils";
import { useAnyScopePermission } from "#/hooks/use-permission";

// `?ny` gjør opprettelsesdialogen adresserbar, slik at «Ny utgave» på den
// offentlige TÖDDEL-siden lander rett i skjemaet i stedet for bare på listen.
const searchSchema = z.object({
    ny: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/admin/toddel")({
    component: ToddelAdminPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "toddel");
    },
    validateSearch: searchSchema,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getToddelIssuesQuery());
        return { breadcrumbs: "TÖDDEL" };
    },
});

/**
 * The upload route rejects anything larger, so say so before the round trip.
 * Mirrors `MAX_FILE_SIZE` in the API's asset lib — the archive's largest issue
 * is just under 40 MB, so 50 MB leaves real margin.
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function ToddelAdminPage() {
    const canCreate = useAnyScopePermission(["toddel:create", "toddel:manage"]);
    const { ny } = Route.useSearch();
    const navigate = Route.useNavigate();
    const [dialog, setDialog] = useState<
        { mode: "create" } | { mode: "edit"; issue: ToddelIssue } | null
    >(null);

    // `canCreate` er false ved første render på en kald sidelast, siden
    // sesjonen ikke er hentet enda. Derfor en effekt og ikke en lazy
    // initialisering.
    useEffect(() => {
        if (!ny || !canCreate) return;
        setDialog({ mode: "create" });
    }, [ny, canCreate]);

    function closeDialog() {
        setDialog(null);
        // Ellers ville dialogen åpnet seg igjen med en gang, siden `ny`
        // fortsatt sto i URL-en.
        if (ny) navigate({ search: {}, replace: true });
    }

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title="TÖDDEL"
                description="Legg ut nye utgaver av studentbladet, og rediger de som allerede ligger ute."
                action={
                    canCreate ? (
                        <Button onClick={() => setDialog({ mode: "create" })}>
                            <PlusIcon className="size-4" />
                            Ny utgave
                        </Button>
                    ) : null
                }
            />

            <Suspense fallback={<TableSkeleton />}>
                <IssuesTable
                    onEdit={(issue) => setDialog({ mode: "edit", issue })}
                />
            </Suspense>

            {dialog && (
                <IssueDialog
                    key={
                        dialog.mode === "edit" ? dialog.issue.edition : "create"
                    }
                    issue={dialog.mode === "edit" ? dialog.issue : null}
                    onClose={closeDialog}
                />
            )}
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

function IssuesTable({ onEdit }: { onEdit: (issue: ToddelIssue) => void }) {
    const { data: issues } = useSuspenseQuery(getToddelIssuesQuery());
    const remove = useMutation(deleteToddelMutation);
    const canEdit = useAnyScopePermission(["toddel:update", "toddel:manage"]);
    const canDelete = useAnyScopePermission(["toddel:delete", "toddel:manage"]);

    if (issues.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={BookOpenIcon}
                        title="Ingen utgaver"
                        description="Ingen utgaver er lagt ut ennå."
                    />
                </CardContent>
            </Card>
        );
    }

    function handleDelete(issue: ToddelIssue) {
        if (
            window.confirm(
                `Fjerne utgave ${issue.edition} – "${issue.title}" fra arkivet?`,
            )
        ) {
            remove.mutate({ edition: issue.edition });
        }
    }

    return (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Utgave</TableHead>
                            <TableHead>Tittel</TableHead>
                            <TableHead>Publisert</TableHead>
                            <TableHead>Filer</TableHead>
                            <TableHead className="text-right">
                                Handlinger
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {issues.map((issue) => (
                            <TableRow key={issue.edition}>
                                <TableCell>{issue.edition}</TableCell>
                                <TableCell>{issue.title}</TableCell>
                                <TableCell>{issue.publishedAt}</TableCell>
                                <TableCell>
                                    <div className="flex gap-3">
                                        <a
                                            className="underline"
                                            href={issue.pdfUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            PDF
                                        </a>
                                        {issue.imageUrl ? (
                                            <a
                                                className="underline"
                                                href={issue.imageUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Forside
                                            </a>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                Ingen forside
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-2">
                                        {canEdit ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onEdit(issue)}
                                            >
                                                <PencilIcon className="size-4" />
                                                Rediger
                                            </Button>
                                        ) : null}
                                        {canDelete ? (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                disabled={remove.isPending}
                                                onClick={() =>
                                                    handleDelete(issue)
                                                }
                                            >
                                                <Trash2 className="size-4" />
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
    );
}

/**
 * API-et svarer på engelsk, og meldingen ble vist rått til brukeren i et
 * ellers norsk skjema. Den ene feilen en redaktør faktisk treffer på er
 * duplikat utgavenummer, så den oversettes; resten faller tilbake til
 * API-teksten, som fortsatt er bedre enn ingenting.
 */
function submitErrorMessage(error: unknown, edition: number): string {
    if (errorStatus(error) === 409) {
        return `Utgave ${edition} finnes allerede. Rediger den i stedet, eller velg et ledig nummer.`;
    }
    return error instanceof Error ? error.message : String(error);
}

function IssueDialog({
    issue,
    onClose,
}: {
    issue: ToddelIssue | null;
    onClose: () => void;
}) {
    const isEdit = issue !== null;
    const { data: issues } = useSuspenseQuery(getToddelIssuesQuery());

    // The edition number is a running count, so the only sensible default for
    // a new issue is one past the highest one in the archive.
    const nextEdition =
        issues.reduce((max, i) => Math.max(max, i.edition), 0) + 1;

    const [edition, setEdition] = useState(
        String(issue?.edition ?? nextEdition),
    );
    const [title, setTitle] = useState(issue?.title ?? "Töddel");
    const [publishedAt, setPublishedAt] = useState(
        issue?.publishedAt ?? new Date().toISOString().slice(0, 10),
    );
    const [pdf, setPdf] = useState<File | null>(null);
    const [cover, setCover] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    const uploadAsset = useMutation(uploadAssetMutation);
    const create = useMutation(createToddelMutation);
    const update = useMutation(updateToddelMutation);
    const isPending =
        uploadAsset.isPending || create.isPending || update.isPending;

    async function upload(file: File): Promise<string> {
        const formData = new FormData();
        formData.append("file", file);
        const asset = await uploadAsset.mutateAsync({ formData });
        return asset.key;
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        if (!isEdit && !pdf) {
            setError("Du må velge en PDF-fil for utgaven.");
            return;
        }

        for (const file of [pdf, cover]) {
            if (file && file.size > MAX_FILE_SIZE) {
                setError(
                    `"${file.name}" er ${(file.size / 1024 / 1024).toFixed(1)} MB. Maks filstørrelse er ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
                );
                return;
            }
        }

        try {
            // Uploads happen one at a time so a failing cover cannot leave a
            // half-finished issue behind: nothing is written until both keys
            // exist.
            const pdfKey = pdf ? await upload(pdf) : undefined;
            const imageKey = cover ? await upload(cover) : undefined;

            if (isEdit) {
                await update.mutateAsync({
                    edition: issue.edition,
                    data: { title, publishedAt, pdfKey, imageKey },
                });
            } else {
                await create.mutateAsync({
                    data: {
                        edition: Number(edition),
                        title,
                        publishedAt,
                        // Guarded above; only the edit path may omit the PDF.
                        pdfKey: pdfKey as string,
                        imageKey,
                    },
                });
            }
            onClose();
        } catch (err) {
            setError(submitErrorMessage(err, Number(edition)));
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-xl">
                <form
                    onSubmit={handleSubmit}
                    className="flex min-h-0 flex-auto flex-col gap-4"
                >
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit
                                ? `Rediger utgave ${issue.edition}`
                                : "Ny utgave"}
                        </DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="toddel-edition">
                                    Utgavenummer
                                </FieldLabel>
                                <Input
                                    id="toddel-edition"
                                    type="number"
                                    min={1}
                                    required
                                    disabled={isEdit}
                                    value={edition}
                                    onChange={(event) =>
                                        setEdition(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="toddel-title">
                                    Tittel
                                </FieldLabel>
                                <Input
                                    id="toddel-title"
                                    required
                                    maxLength={200}
                                    value={title}
                                    onChange={(event) =>
                                        setTitle(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="toddel-published">
                                    Publiseringsdato
                                </FieldLabel>
                                <Input
                                    id="toddel-published"
                                    type="date"
                                    required
                                    value={publishedAt}
                                    onChange={(event) =>
                                        setPublishedAt(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="toddel-pdf">
                                    PDF
                                    {isEdit
                                        ? " (la stå tom for å beholde)"
                                        : ""}
                                </FieldLabel>
                                <Input
                                    id="toddel-pdf"
                                    type="file"
                                    accept="application/pdf"
                                    required={!isEdit}
                                    onChange={(event) =>
                                        setPdf(event.target.files?.[0] ?? null)
                                    }
                                />
                            </Field>
                            <AdminImageField
                                label="Forsidebilde (valgfritt)"
                                preset="cover-portrait"
                                value={cover}
                                onChange={setCover}
                                existingImageUrl={issue?.imageUrl}
                                disabled={isPending}
                            />
                        </FieldGroup>

                        {error && (
                            <p className="text-destructive text-sm">{error}</p>
                        )}
                    </DialogBody>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isPending}
                        >
                            Avbryt
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending
                                ? "Lagrer …"
                                : isEdit
                                  ? "Lagre"
                                  : "Publiser"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
