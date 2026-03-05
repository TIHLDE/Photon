import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { photon } from "~/lib/api";
import { jobKeys } from "~/lib/queries/jobs";

const JOB_TYPES = [
    { value: "full_time", label: "Fulltid" },
    { value: "part_time", label: "Deltid" },
    { value: "summer_job", label: "Sommerjobb" },
    { value: "other", label: "Annet" },
] as const;

const CLASS_YEARS = [
    { value: "first", label: "1. klasse" },
    { value: "second", label: "2. klasse" },
    { value: "third", label: "3. klasse" },
    { value: "fourth", label: "4. klasse" },
    { value: "fifth", label: "5. klasse" },
    { value: "alumni", label: "Alumni" },
] as const;

type JobPostFormProps = {
    jobId?: string;
    initialData?: {
        title?: string;
        ingress?: string;
        body?: string;
        company?: string;
        location?: string;
        deadline?: string | null;
        isContinuouslyHiring?: boolean;
        jobType?: string;
        email?: string | null;
        link?: string | null;
        classStart?: string;
        classEnd?: string;
        imageUrl?: string | null;
        imageAlt?: string | null;
    };
};

function toLocalDT(iso?: string | null): string {
    if (!iso) return "";
    return iso.slice(0, 16);
}

export function JobPostForm({ jobId, initialData }: JobPostFormProps) {
    const isEditing = !!jobId;
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        title: initialData?.title ?? "",
        ingress: initialData?.ingress ?? "",
        body: initialData?.body ?? "",
        company: initialData?.company ?? "",
        location: initialData?.location ?? "",
        deadline: toLocalDT(initialData?.deadline),
        isContinuouslyHiring: initialData?.isContinuouslyHiring ?? false,
        jobType: initialData?.jobType ?? "other",
        email: initialData?.email ?? "",
        link: initialData?.link ?? "",
        classStart: initialData?.classStart ?? "first",
        classEnd: initialData?.classEnd ?? "fifth",
        imageUrl: initialData?.imageUrl ?? "",
        imageAlt: initialData?.imageAlt ?? "",
    });

    const set = (key: string, value: string | boolean) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const body = {
            title: form.title,
            ingress: form.ingress || undefined,
            body: form.body || undefined,
            company: form.company,
            location: form.location,
            deadline: form.deadline
                ? new Date(form.deadline).toISOString()
                : undefined,
            isContinuouslyHiring: form.isContinuouslyHiring,
            jobType: form.jobType as
                | "full_time"
                | "part_time"
                | "summer_job"
                | "other",
            email: form.email || undefined,
            link: form.link || undefined,
            classStart: form.classStart as
                | "first"
                | "second"
                | "third"
                | "fourth"
                | "fifth"
                | "alumni",
            classEnd: form.classEnd as
                | "first"
                | "second"
                | "third"
                | "fourth"
                | "fifth"
                | "alumni",
            imageUrl: form.imageUrl || undefined,
            imageAlt: form.imageAlt || undefined,
        };

        try {
            const result = isEditing
                ? await photon.PATCH("/api/jobs/{id}", {
                      params: { path: { id: jobId } },
                      body,
                  })
                : await photon.POST("/api/jobs", { body });

            if (result.error) {
                toast.error(
                    isEditing
                        ? "Kunne ikke oppdatere stillingsannonse"
                        : "Kunne ikke opprette stillingsannonse",
                );
                return;
            }

            await queryClient.invalidateQueries({ queryKey: jobKeys.all });
            toast.success(
                isEditing
                    ? "Stillingsannonse oppdatert"
                    : "Stillingsannonse opprettet",
            );
            window.location.href = "/admin/stillingsannonser";
        } catch {
            toast.error("Noe gikk galt");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Grunnleggende info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField label="Tittel" required>
                        <Input
                            value={form.title}
                            onChange={(e) => set("title", e.target.value)}
                            required
                        />
                    </FormField>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Bedrift" required>
                            <Input
                                value={form.company}
                                onChange={(e) => set("company", e.target.value)}
                                required
                            />
                        </FormField>
                        <FormField label="Sted" required>
                            <Input
                                value={form.location}
                                onChange={(e) =>
                                    set("location", e.target.value)
                                }
                                required
                            />
                        </FormField>
                    </div>
                    <FormField label="Ingress">
                        <Textarea
                            value={form.ingress}
                            onChange={(e) => set("ingress", e.target.value)}
                            rows={2}
                        />
                    </FormField>
                    <FormField label="Beskrivelse (Markdown)">
                        <Textarea
                            value={form.body}
                            onChange={(e) => set("body", e.target.value)}
                            rows={10}
                            className="font-mono text-sm"
                        />
                    </FormField>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Detaljer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Type stilling">
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                value={form.jobType}
                                onChange={(e) => set("jobType", e.target.value)}
                            >
                                {JOB_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Søknadsfrist">
                            <Input
                                type="datetime-local"
                                value={form.deadline}
                                onChange={(e) =>
                                    set("deadline", e.target.value)
                                }
                            />
                        </FormField>
                    </div>
                    {/* biome-ignore lint/a11y/noLabelWithoutControl: checkbox is child */}
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                            checked={form.isContinuouslyHiring}
                            onCheckedChange={(v) =>
                                set("isContinuouslyHiring", v === true)
                            }
                        />
                        Løpende opptak
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Relevant fra">
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                value={form.classStart}
                                onChange={(e) =>
                                    set("classStart", e.target.value)
                                }
                            >
                                {CLASS_YEARS.map((y) => (
                                    <option key={y.value} value={y.value}>
                                        {y.label}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Relevant til">
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                value={form.classEnd}
                                onChange={(e) =>
                                    set("classEnd", e.target.value)
                                }
                            >
                                {CLASS_YEARS.map((y) => (
                                    <option key={y.value} value={y.value}>
                                        {y.label}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Kontakt og lenker</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="E-post">
                            <Input
                                type="email"
                                value={form.email}
                                onChange={(e) => set("email", e.target.value)}
                            />
                        </FormField>
                        <FormField label="Søknadslenke">
                            <Input
                                type="url"
                                value={form.link}
                                onChange={(e) => set("link", e.target.value)}
                                placeholder="https://..."
                            />
                        </FormField>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Bilde-URL">
                            <Input
                                type="url"
                                value={form.imageUrl}
                                onChange={(e) =>
                                    set("imageUrl", e.target.value)
                                }
                                placeholder="https://..."
                            />
                        </FormField>
                        <FormField label="Bilde alt-tekst">
                            <Input
                                value={form.imageAlt}
                                onChange={(e) =>
                                    set("imageAlt", e.target.value)
                                }
                            />
                        </FormField>
                    </div>
                </CardContent>
            </Card>

            <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                    {loading
                        ? "Lagrer..."
                        : isEditing
                          ? "Oppdater stillingsannonse"
                          : "Opprett stillingsannonse"}
                </Button>
                <a href="/admin/stillingsannonser">
                    <Button type="button" variant="outline">
                        Avbryt
                    </Button>
                </a>
            </div>
        </form>
    );
}

function FormField({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <Label>
                {label}
                {required && <span className="text-destructive"> *</span>}
            </Label>
            {children}
        </div>
    );
}
