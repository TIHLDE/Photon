import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { nb } from "date-fns/locale";
import {
    ExternalLinkIcon,
    GraduationCapIcon,
    PencilIcon,
    PlusIcon,
    Trash2,
    XIcon,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import type { MasterStudyEntry } from "@tihlde/sdk";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { DateTimePicker } from "@tihlde/ui/ui/date-time-picker";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Stagger } from "@tihlde/ui/ui/motion";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Switch } from "@tihlde/ui/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@tihlde/ui/ui/toggle-group";

import {
    createMasterStudyMutation,
    deleteMasterStudyMutation,
    getMasterStudiesQuery,
    getMasterStudyProgramsQuery,
    updateMasterStudyMutation,
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
    type MasterStudyLocationType,
    formatMasterStudyDate,
} from "#/lib/master-study";

/** The short sidebar name where there is one, else the full name. */
function programLabel(program: { slug: string; displayName: string }) {
    return (
        MASTER_STUDY_PROGRAMS.find((p) => p.slug === program.slug)?.label ??
        program.displayName
    );
}

// `?ny` og `?rediger=<id>` gjør dialogene adresserbare, slik at knappene på
// den offentlige siden lander rett i skjemaet.
const searchSchema = z.object({
    ny: z.boolean().optional().catch(undefined),
    rediger: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/admin/masterveiledning")({
    component: MasterStudyAdminPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "masterveiledning");
    },
    validateSearch: searchSchema,
    loader: async ({ context }) => {
        await Promise.all([
            context.queryClient.ensureQueryData(getMasterStudiesQuery()),
            context.queryClient.ensureQueryData(getMasterStudyProgramsQuery()),
        ]);
        return { breadcrumbs: "Masterveiledning" };
    },
});

type DialogState = { mode: "create" } | { mode: "edit"; id: string } | null;

function MasterStudyAdminPage() {
    const canCreate = useAnyScopePermission([
        "master-study:create",
        "master-study:manage",
    ]);
    const { ny, rediger } = Route.useSearch();
    const navigate = Route.useNavigate();
    const [dialog, setDialog] = useState<DialogState>(null);

    // `canCreate` er false ved første render på en kald sidelast, siden
    // sesjonen ikke er hentet enda — derfor en effekt.
    useEffect(() => {
        if (rediger) setDialog({ mode: "edit", id: rediger });
        else if (ny && canCreate) setDialog({ mode: "create" });
    }, [ny, rediger, canCreate]);

    function closeDialog() {
        setDialog(null);
        if (ny || rediger) navigate({ search: {}, replace: true });
    }

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
                                onClick={() => setDialog({ mode: "create" })}
                            >
                                <PlusIcon className="size-4" />
                                Ny masterstudie
                            </Button>
                        ) : null}
                    </>
                }
            />

            <Suspense fallback={<TableSkeleton />}>
                <EntriesTable
                    onEdit={(entry) =>
                        setDialog({ mode: "edit", id: entry.id })
                    }
                />
            </Suspense>

            {dialog && (
                <Suspense fallback={null}>
                    <EntryDialog
                        key={dialog.mode === "edit" ? dialog.id : "create"}
                        editId={dialog.mode === "edit" ? dialog.id : null}
                        onClose={closeDialog}
                    />
                </Suspense>
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

function EntriesTable({
    onEdit,
}: {
    onEdit: (entry: MasterStudyEntry) => void;
}) {
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
                                                    onClick={() =>
                                                        onEdit(entry)
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

type QuoteDraft = { key: string; name: string; quote: string };

let quoteKey = 0;
function newQuoteDraft(
    quote: { name: string | null; quote: string } = { name: null, quote: "" },
): QuoteDraft {
    quoteKey += 1;
    return { key: `q${quoteKey}`, name: quote.name ?? "", quote: quote.quote };
}

/** Same rule as the API: any http(s) address. */
function isWebLink(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

function EntryDialog({
    editId,
    onClose,
}: {
    editId: string | null;
    onClose: () => void;
}) {
    const { data } = useSuspenseQuery(getMasterStudiesQuery());
    const { data: programs } = useSuspenseQuery(getMasterStudyProgramsQuery());
    const entry = editId
        ? (data.items.find((e) => e.id === editId) ?? null)
        : null;
    const isEdit = entry !== null;

    // Only the three programmes the page is organised by. Drift and
    // Informasjonsbehandling are closed programmes still in the table.
    const selectablePrograms = MASTER_STUDY_PROGRAMS.flatMap((program) =>
        programs.filter((p) => p.slug === program.slug),
    );

    const [studyProgramId, setStudyProgramId] = useState<string>(
        entry ? String(entry.studyProgramId) : "",
    );
    const [name, setName] = useState(entry?.name ?? "");
    const [location, setLocation] = useState(entry?.location ?? "");
    const [locationType, setLocationType] = useState<MasterStudyLocationType>(
        entry?.locationType ?? "innland",
    );
    const [link, setLink] = useState(entry?.link ?? "");
    const [applicationDeadline, setApplicationDeadline] = useState<Date | null>(
        entry?.applicationDeadline ? new Date(entry.applicationDeadline) : null,
    );
    const [hasFinancialSupport, setHasFinancialSupport] = useState(
        entry?.hasFinancialSupport ?? false,
    );
    const [financialSupport, setFinancialSupport] = useState(
        entry?.financialSupport ?? "",
    );
    const [summary, setSummary] = useState(entry?.summary ?? "");
    const [subjectRequirements, setSubjectRequirements] = useState(
        entry?.subjectRequirements ?? "",
    );
    const [otherRequirements, setOtherRequirements] = useState(
        entry?.otherRequirements ?? "",
    );
    const [quotes, setQuotes] = useState<QuoteDraft[]>(() =>
        (entry?.quotes ?? []).map((q) => newQuoteDraft(q)),
    );
    const [error, setError] = useState<string | null>(null);

    const errorRef = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
        if (error) errorRef.current?.scrollIntoView({ block: "nearest" });
    }, [error]);

    const create = useMutation(createMasterStudyMutation);
    const update = useMutation(updateMasterStudyMutation);
    const isPending = create.isPending || update.isPending;

    // `?rediger=<id>` for an entry that has since been deleted.
    useEffect(() => {
        if (editId && !entry) onClose();
    }, [editId, entry, onClose]);
    if (editId && !entry) return null;

    function updateQuote(key: string, patch: Partial<QuoteDraft>) {
        setQuotes((prev) =>
            prev.map((q) => (q.key === key ? { ...q, ...patch } : q)),
        );
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        if (!studyProgramId) {
            setError("Velg hvilket studieprogram masterstudiet bygger på.");
            return;
        }
        if (!isWebLink(link.trim())) {
            setError("Lenken må være en nettadresse som starter med https://.");
            return;
        }
        if (quotes.some((q) => !q.quote.trim())) {
            setError(
                "Et sitat kan ikke være tomt. Fjern det eller fyll det ut.",
            );
            return;
        }

        // Tomme felt betyr «ikke oppgitt»: utelatt ved oppretting, null ved
        // redigering så en tidligere verdi faktisk blir fjernet.
        const blank = isEdit ? null : undefined;
        const text = (value: string) => value.trim() || blank;

        const payload = {
            studyProgramId: Number(studyProgramId),
            name: name.trim(),
            location: location.trim(),
            locationType,
            link: link.trim(),
            hasFinancialSupport,
            financialSupport: hasFinancialSupport
                ? text(financialSupport)
                : blank,
            summary: text(summary),
            subjectRequirements: text(subjectRequirements),
            otherRequirements: text(otherRequirements),
            applicationDeadline: applicationDeadline
                ? applicationDeadline.toISOString()
                : blank,
            quotes: quotes.map((q) => ({
                name: q.name.trim() || null,
                quote: q.quote.trim(),
            })),
        };

        try {
            if (isEdit) {
                await update.mutateAsync({ id: entry.id, data: payload });
            } else {
                await create.mutateAsync({
                    data: {
                        ...payload,
                        financialSupport: payload.financialSupport ?? undefined,
                        summary: payload.summary ?? undefined,
                        subjectRequirements:
                            payload.subjectRequirements ?? undefined,
                        otherRequirements:
                            payload.otherRequirements ?? undefined,
                        applicationDeadline:
                            payload.applicationDeadline ?? undefined,
                    },
                });
            }
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    const programItems = selectablePrograms.map((p) => ({
        value: String(p.id),
        label: p.displayName,
    }));
    const locationItems = (["innland", "utland"] as const).map((value) => ({
        value,
        label: LOCATION_TYPE_LABELS[value],
    }));

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <form
                    onSubmit={handleSubmit}
                    className="flex min-h-0 flex-auto flex-col gap-4"
                >
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit
                                ? `Rediger ${entry.name}`
                                : "Ny masterstudie"}
                        </DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="ms-program">
                                    Bygger på studieprogram *
                                </FieldLabel>
                                <Select
                                    items={programItems}
                                    value={studyProgramId || null}
                                    onValueChange={(value) =>
                                        setStudyProgramId(value ?? "")
                                    }
                                >
                                    <SelectTrigger
                                        id="ms-program"
                                        className="w-full"
                                    >
                                        <SelectValue placeholder="Velg studieprogram" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {programItems.map((item) => (
                                            <SelectItem
                                                key={item.value}
                                                value={item.value}
                                            >
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="ms-name">
                                    Navn *
                                </FieldLabel>
                                <Input
                                    id="ms-name"
                                    required
                                    maxLength={300}
                                    placeholder="Master i informatikk"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                                <Field>
                                    <FieldLabel htmlFor="ms-location">
                                        Sted *
                                    </FieldLabel>
                                    <Input
                                        id="ms-location"
                                        required
                                        maxLength={300}
                                        placeholder="NTNU Trondheim"
                                        value={location}
                                        onChange={(e) =>
                                            setLocation(e.target.value)
                                        }
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="ms-location-type">
                                        Innland/utland *
                                    </FieldLabel>
                                    <Select
                                        items={locationItems}
                                        value={locationType}
                                        onValueChange={(value) =>
                                            setLocationType(
                                                (value as MasterStudyLocationType) ??
                                                    "innland",
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            id="ms-location-type"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {locationItems.map((item) => (
                                                <SelectItem
                                                    key={item.value}
                                                    value={item.value}
                                                >
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            </div>
                            <Field>
                                <FieldLabel htmlFor="ms-url">
                                    Lenke til studiet *
                                </FieldLabel>
                                <Input
                                    id="ms-url"
                                    type="url"
                                    required
                                    maxLength={500}
                                    placeholder="https://…"
                                    value={link}
                                    onChange={(e) => setLink(e.target.value)}
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="ms-deadline">
                                    Søknadsfrist
                                </FieldLabel>
                                <div className="flex items-center gap-2">
                                    <DateTimePicker
                                        id="ms-deadline"
                                        locale={nb}
                                        placeholder="Ikke oppgitt"
                                        value={applicationDeadline}
                                        onValueChange={setApplicationDeadline}
                                    />
                                    {applicationDeadline ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Fjern søknadsfrist"
                                            onClick={() =>
                                                setApplicationDeadline(null)
                                            }
                                        >
                                            <XIcon />
                                        </Button>
                                    ) : null}
                                </div>
                            </Field>
                            <Field orientation="horizontal">
                                <Switch
                                    id="ms-support"
                                    checked={hasFinancialSupport}
                                    onCheckedChange={setHasFinancialSupport}
                                />
                                <FieldLabel htmlFor="ms-support">
                                    Økonomisk støtte tilgjengelig
                                </FieldLabel>
                            </Field>
                            {hasFinancialSupport ? (
                                <Field>
                                    <FieldLabel htmlFor="ms-support-details">
                                        Om støtten
                                    </FieldLabel>
                                    <Textarea
                                        id="ms-support-details"
                                        placeholder="Stipend, Lånekassen, dekning av skolepenger …"
                                        value={financialSupport}
                                        onChange={(e) =>
                                            setFinancialSupport(e.target.value)
                                        }
                                    />
                                </Field>
                            ) : null}
                            <Field>
                                <FieldLabel htmlFor="ms-summary">
                                    Om studiet
                                </FieldLabel>
                                <Textarea
                                    id="ms-summary"
                                    rows={4}
                                    value={summary}
                                    onChange={(e) => setSummary(e.target.value)}
                                />
                                <FieldDescription>
                                    Støtter Markdown.
                                </FieldDescription>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="ms-subject-req">
                                    Fagkrav
                                </FieldLabel>
                                <Textarea
                                    id="ms-subject-req"
                                    value={subjectRequirements}
                                    onChange={(e) =>
                                        setSubjectRequirements(e.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="ms-other-req">
                                    Øvrige krav
                                </FieldLabel>
                                <Textarea
                                    id="ms-other-req"
                                    value={otherRequirements}
                                    onChange={(e) =>
                                        setOtherRequirements(e.target.value)
                                    }
                                />
                            </Field>

                            <FieldSet>
                                <FieldLegend>Sitater</FieldLegend>
                                <FieldDescription>
                                    Erfaringer fra de som har tatt studiet. La
                                    navnet stå tomt for et anonymt sitat.
                                </FieldDescription>
                                <div className="flex flex-col gap-4">
                                    {quotes.map((quote, index) => (
                                        <Card key={quote.key} size="sm">
                                            <CardContent className="flex flex-col gap-3">
                                                <div className="flex items-end gap-2">
                                                    <Field className="flex-1">
                                                        <FieldLabel
                                                            htmlFor={`${quote.key}-name`}
                                                        >
                                                            Navn
                                                        </FieldLabel>
                                                        <Input
                                                            id={`${quote.key}-name`}
                                                            maxLength={200}
                                                            placeholder="Anonym"
                                                            value={quote.name}
                                                            onChange={(e) =>
                                                                updateQuote(
                                                                    quote.key,
                                                                    {
                                                                        name: e
                                                                            .target
                                                                            .value,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    </Field>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Fjern sitat ${index + 1}`}
                                                        onClick={() =>
                                                            setQuotes((prev) =>
                                                                prev.filter(
                                                                    (q) =>
                                                                        q.key !==
                                                                        quote.key,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                </div>
                                                <Field>
                                                    <FieldLabel
                                                        htmlFor={`${quote.key}-quote`}
                                                    >
                                                        Sitat
                                                    </FieldLabel>
                                                    <Textarea
                                                        id={`${quote.key}-quote`}
                                                        required
                                                        value={quote.quote}
                                                        onChange={(e) =>
                                                            updateQuote(
                                                                quote.key,
                                                                {
                                                                    quote: e
                                                                        .target
                                                                        .value,
                                                                },
                                                            )
                                                        }
                                                    />
                                                </Field>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    <div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setQuotes((prev) => [
                                                    ...prev,
                                                    newQuoteDraft(),
                                                ])
                                            }
                                        >
                                            <PlusIcon className="size-4" />
                                            Legg til sitat
                                        </Button>
                                    </div>
                                </div>
                            </FieldSet>
                        </FieldGroup>

                        {error && (
                            <p
                                ref={errorRef}
                                className="text-destructive text-sm"
                            >
                                {error}
                            </p>
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
                                  : "Opprett"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
