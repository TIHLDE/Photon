import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
    BriefcaseBusinessIcon,
    PencilIcon,
    PlusIcon,
    Trash2,
} from "lucide-react";
import { addWeeks } from "date-fns";
import { nb } from "date-fns/locale";
import { Suspense, useEffect, useMemo, useState } from "react";

import type { JobListItem } from "@tihlde/sdk";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { DateTimePicker } from "@tihlde/ui/ui/date-time-picker";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Label } from "@tihlde/ui/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import { Textarea } from "@tihlde/ui/ui/textarea";

import { useImageUploader } from "#/api/queries/assets";
import {
    createJobMutation,
    deleteJobMutation,
    getJobsQuery,
    updateJobMutation,
} from "#/api/queries/jobs";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminImageField } from "#/components/admin-image-field";
import { AdminPageHeader } from "#/components/admin-page-header";
import { nextWholeHour } from "#/lib/date";

const JOB_TYPES = ["full_time", "part_time", "summer_job", "other"] as const;
type JobType = (typeof JOB_TYPES)[number];

const CLASSES = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "alumni",
] as const;
type UserClass = (typeof CLASSES)[number];

const JOB_TYPE_LABELS: Record<JobType, string> = {
    full_time: "Fulltid",
    part_time: "Deltid",
    summer_job: "Sommerjobb",
    other: "Annet",
};

const CLASS_LABELS: Record<UserClass, string> = {
    first: "1. klasse",
    second: "2. klasse",
    third: "3. klasse",
    fourth: "4. klasse",
    fifth: "5. klasse",
    alumni: "Alumni",
};

export const Route = createFileRoute("/admin/annonser")({
    component: JobsAdminPage,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(
            getJobsQuery(0, { expired: true }),
        );
        return { breadcrumbs: "Annonser" };
    },
});

function JobsAdminPage() {
    const [search, setSearch] = useState("");
    const [jobType, setJobType] = useState<JobType | "all">("all");
    const [showExpired, setShowExpired] = useState(true);
    const [dialog, setDialog] = useState<
        { mode: "create" } | { mode: "edit"; job: JobListItem } | null
    >(null);

    return (
        <div className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Annonser"
                description="Opprett og administrer stillingsannonser fra bedrifter."
                action={
                    <Button onClick={() => setDialog({ mode: "create" })}>
                        <PlusIcon className="size-4" />
                        Ny annonse
                    </Button>
                }
            />

            <Card>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <Field className="flex-1">
                        <FieldLabel htmlFor="job-search">Søk</FieldLabel>
                        <Input
                            id="job-search"
                            type="search"
                            placeholder="Tittel eller bedrift"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </Field>
                    <Field className="sm:w-52">
                        <FieldLabel htmlFor="job-type-filter">Type</FieldLabel>
                        <Select
                            items={[
                                { value: "all", label: "Alle typer" },
                                ...JOB_TYPES.map((type) => ({
                                    value: type,
                                    label: JOB_TYPE_LABELS[type],
                                })),
                            ]}
                            value={jobType}
                            onValueChange={(value) =>
                                setJobType((value as JobType | "all") ?? "all")
                            }
                        >
                            <SelectTrigger id="job-type-filter">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle typer</SelectItem>
                                {JOB_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {JOB_TYPE_LABELS[type]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <div className="flex items-center gap-2 sm:pb-2">
                        <Checkbox
                            id="job-show-expired"
                            checked={showExpired}
                            onCheckedChange={(checked) =>
                                setShowExpired(Boolean(checked))
                            }
                        />
                        <Label htmlFor="job-show-expired">Vis utløpte</Label>
                    </div>
                </CardContent>
            </Card>

            <Suspense fallback={<TableSkeleton />}>
                <JobsTable
                    search={search}
                    jobType={jobType}
                    showExpired={showExpired}
                    onEdit={(job) => setDialog({ mode: "edit", job })}
                />
            </Suspense>

            <JobDialog
                key={dialog?.mode === "edit" ? dialog.job.id : "create"}
                open={dialog !== null}
                job={dialog?.mode === "edit" ? dialog.job : null}
                onOpenChange={(open) => {
                    if (!open) setDialog(null);
                }}
            />
        </div>
    );
}

function JobsTable({
    search,
    jobType,
    showExpired,
    onEdit,
}: {
    search: string;
    jobType: JobType | "all";
    showExpired: boolean;
    onEdit: (job: JobListItem) => void;
}) {
    const { data } = useSuspenseQuery(getJobsQuery(0, { expired: true }));
    const remove = useMutation(deleteJobMutation);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return data.items.filter((job) => {
            if (!showExpired && job.expired) return false;
            if (jobType !== "all" && job.jobType !== jobType) return false;
            if (
                term &&
                !job.title.toLowerCase().includes(term) &&
                !job.company.toLowerCase().includes(term)
            ) {
                return false;
            }
            return true;
        });
    }, [data.items, search, jobType, showExpired]);

    if (filtered.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={BriefcaseBusinessIcon}
                        title="Ingen annonser"
                        description="Ingen annonser matcher filtrene, eller ingen er opprettet ennå."
                    />
                </CardContent>
            </Card>
        );
    }

    function handleDelete(job: JobListItem) {
        if (
            window.confirm(
                `Slette annonsen "${job.title}"? Dette kan ikke angres.`,
            )
        ) {
            remove.mutate({ jobId: job.id });
        }
    }

    return (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tittel</TableHead>
                            <TableHead>Bedrift</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Frist</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">
                                Handlinger
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map((job) => (
                            <TableRow key={job.id}>
                                <TableCell>{job.title}</TableCell>
                                <TableCell>{job.company}</TableCell>
                                <TableCell>
                                    {JOB_TYPE_LABELS[job.jobType as JobType] ??
                                        job.jobType}
                                </TableCell>
                                <TableCell>
                                    {job.isContinuouslyHiring
                                        ? "Fortløpende"
                                        : formatDeadline(job.deadline)}
                                </TableCell>
                                <TableCell>
                                    {job.expired ? (
                                        <Badge variant="outline">Utløpt</Badge>
                                    ) : (
                                        <Badge variant="secondary">Aktiv</Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onEdit(job)}
                                        >
                                            <PencilIcon className="size-4" />
                                            Rediger
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            disabled={remove.isPending}
                                            onClick={() => handleDelete(job)}
                                        >
                                            <Trash2 className="size-4" />
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

function JobDialog({
    open,
    job,
    onOpenChange,
}: {
    open: boolean;
    job: JobListItem | null;
    onOpenChange: (open: boolean) => void;
}) {
    const isEdit = job !== null;

    const [title, setTitle] = useState(job?.title ?? "");
    const [company, setCompany] = useState(job?.company ?? "");
    const [location, setLocation] = useState(job?.location ?? "");
    const [jobType, setJobType] = useState<JobType>(
        (job?.jobType as JobType) ?? "other",
    );
    const [classStart, setClassStart] = useState<UserClass>(
        (job?.classStart as UserClass) ?? "first",
    );
    const [classEnd, setClassEnd] = useState<UserClass>(
        (job?.classEnd as UserClass) ?? "fifth",
    );
    const [deadline, setDeadline] = useState<Date | null>(
        job?.deadline ? new Date(job.deadline) : null,
    );
    const [isContinuouslyHiring, setIsContinuouslyHiring] = useState(
        job?.isContinuouslyHiring ?? false,
    );
    const [email, setEmail] = useState(job?.email ?? "");
    const [link, setLink] = useState(job?.link ?? "");
    const [ingress, setIngress] = useState(job?.ingress ?? "");
    const [body, setBody] = useState(job?.body ?? "");
    const [image, setImage] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Ny annonse: foreslå en søknadsfrist to uker fram på en hel time.
    useEffect(() => {
        if (isEdit) return;
        setDeadline((current) => current ?? addWeeks(nextWholeHour(), 2));
    }, [isEdit]);

    const create = useMutation(createJobMutation);
    const update = useMutation(updateJobMutation);
    const { uploadImage, isUploading } = useImageUploader();
    const isPending = create.isPending || update.isPending || isUploading;

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        const deadlineIso = deadline ? deadline.toISOString() : null;

        try {
            // Uploaded before the write, so a failing upload cannot save an ad
            // that quietly lost its image.
            const imageUrl = image ? await uploadImage(image) : undefined;

            if (isEdit && job) {
                await update.mutateAsync({
                    jobId: job.id,
                    data: {
                        title,
                        company,
                        location,
                        jobType,
                        classStart,
                        classEnd,
                        deadline: deadlineIso,
                        isContinuouslyHiring,
                        email: email || null,
                        link: link || null,
                        ingress,
                        body,
                        // Left out when unchanged, so editing other fields
                        // never clears an existing image.
                        ...(imageUrl ? { imageUrl } : {}),
                    },
                });
            } else {
                await create.mutateAsync({
                    data: {
                        title,
                        company,
                        location,
                        jobType,
                        classStart,
                        classEnd,
                        deadline: deadlineIso ?? undefined,
                        isContinuouslyHiring,
                        email: email || undefined,
                        link: link || undefined,
                        ingress,
                        body,
                        imageUrl,
                    },
                });
            }
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit ? "Rediger annonse" : "Ny annonse"}
                        </DialogTitle>
                    </DialogHeader>
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="job-title">Tittel</FieldLabel>
                            <Input
                                id="job-title"
                                required
                                value={title}
                                onChange={(event) =>
                                    setTitle(event.target.value)
                                }
                            />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="job-company">
                                    Bedrift
                                </FieldLabel>
                                <Input
                                    id="job-company"
                                    required
                                    value={company}
                                    onChange={(event) =>
                                        setCompany(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="job-location">
                                    Sted
                                </FieldLabel>
                                <Input
                                    id="job-location"
                                    required
                                    value={location}
                                    onChange={(event) =>
                                        setLocation(event.target.value)
                                    }
                                />
                            </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field>
                                <FieldLabel htmlFor="job-type">Type</FieldLabel>
                                <Select
                                    items={JOB_TYPES.map((type) => ({
                                        value: type,
                                        label: JOB_TYPE_LABELS[type],
                                    }))}
                                    value={jobType}
                                    onValueChange={(value) =>
                                        setJobType(
                                            (value as JobType) ?? "other",
                                        )
                                    }
                                >
                                    <SelectTrigger id="job-type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {JOB_TYPES.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {JOB_TYPE_LABELS[type]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="job-class-start">
                                    Fra klasse
                                </FieldLabel>
                                <Select
                                    items={CLASSES.map((cls) => ({
                                        value: cls,
                                        label: CLASS_LABELS[cls],
                                    }))}
                                    value={classStart}
                                    onValueChange={(value) =>
                                        setClassStart(
                                            (value as UserClass) ?? "first",
                                        )
                                    }
                                >
                                    <SelectTrigger id="job-class-start">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CLASSES.map((cls) => (
                                            <SelectItem key={cls} value={cls}>
                                                {CLASS_LABELS[cls]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="job-class-end">
                                    Til klasse
                                </FieldLabel>
                                <Select
                                    items={CLASSES.map((cls) => ({
                                        value: cls,
                                        label: CLASS_LABELS[cls],
                                    }))}
                                    value={classEnd}
                                    onValueChange={(value) =>
                                        setClassEnd(
                                            (value as UserClass) ?? "fifth",
                                        )
                                    }
                                >
                                    <SelectTrigger id="job-class-end">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CLASSES.map((cls) => (
                                            <SelectItem key={cls} value={cls}>
                                                {CLASS_LABELS[cls]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="job-deadline">
                                    Søknadsfrist
                                </FieldLabel>
                                <DateTimePicker
                                    id="job-deadline"
                                    locale={nb}
                                    placeholder="Velg søknadsfrist"
                                    value={deadline}
                                    disabled={isContinuouslyHiring}
                                    onValueChange={setDeadline}
                                />
                            </Field>
                            <div className="flex items-center gap-2 sm:self-end sm:pb-2">
                                <Checkbox
                                    id="job-continuous"
                                    checked={isContinuouslyHiring}
                                    onCheckedChange={(checked) =>
                                        setIsContinuouslyHiring(
                                            Boolean(checked),
                                        )
                                    }
                                />
                                <Label htmlFor="job-continuous">
                                    Fortløpende ansettelse
                                </Label>
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="job-email">
                                    Kontakt-e-post
                                </FieldLabel>
                                <Input
                                    id="job-email"
                                    type="email"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="job-link">
                                    Søknadslenke
                                </FieldLabel>
                                <Input
                                    id="job-link"
                                    type="url"
                                    value={link}
                                    onChange={(event) =>
                                        setLink(event.target.value)
                                    }
                                    placeholder="https://"
                                />
                            </Field>
                        </div>
                        <Field>
                            <FieldLabel htmlFor="job-ingress">
                                Ingress
                            </FieldLabel>
                            <Textarea
                                id="job-ingress"
                                rows={2}
                                value={ingress}
                                onChange={(event) =>
                                    setIngress(event.target.value)
                                }
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="job-body">
                                Beskrivelse
                            </FieldLabel>
                            <Textarea
                                id="job-body"
                                rows={6}
                                value={body}
                                onChange={(event) =>
                                    setBody(event.target.value)
                                }
                            />
                        </Field>
                        <AdminImageField
                            label={`Bilde${isEdit ? " (la stå tom for å beholde)" : ""}`}
                            preset="cover-wide"
                            value={image}
                            onChange={setImage}
                            existingImageUrl={job?.imageUrl}
                            disabled={isPending}
                        />
                    </FieldGroup>
                    {error && (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Avbryt
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isEdit ? "Lagre" : "Opprett"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function formatDeadline(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("nb-NO");
}

function TableSkeleton() {
    return (
        <Card>
            <CardContent className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                ))}
            </CardContent>
        </Card>
    );
}
