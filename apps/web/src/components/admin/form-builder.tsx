import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import { photon } from "~/lib/api";
import { formKeys } from "~/lib/queries/forms";

const FIELD_TYPES = [
    { value: "text_answer", label: "Tekstsvar" },
    { value: "single_select", label: "Enkeltvalg" },
    { value: "multiple_select", label: "Flervalg" },
] as const;

type FieldOption = { id?: string; title: string; order: number };
type FormField = {
    id?: string;
    title: string;
    type: "text_answer" | "single_select" | "multiple_select";
    required: boolean;
    order: number;
    options: FieldOption[];
};

type FormBuilderProps = {
    formId?: string;
    initialData?: {
        title?: string;
        description?: string;
        template?: boolean;
        fields?: FormField[];
    };
};

export function FormBuilder({ formId, initialData }: FormBuilderProps) {
    const isEditing = !!formId;
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    const [title, setTitle] = useState(initialData?.title ?? "");
    const [description, setDescription] = useState(
        initialData?.description ?? "",
    );
    const [template, setTemplate] = useState(initialData?.template ?? false);
    const [fields, setFields] = useState<FormField[]>(
        initialData?.fields ?? [],
    );

    const addField = () => {
        setFields((prev) => [
            ...prev,
            {
                title: "",
                type: "text_answer",
                required: false,
                order: prev.length,
                options: [],
            },
        ]);
    };

    const updateField = (index: number, updates: Partial<FormField>) => {
        setFields((prev) =>
            prev.map((f, i) => (i === index ? { ...f, ...updates } : f)),
        );
    };

    const removeField = (index: number) => {
        setFields((prev) => prev.filter((_, i) => i !== index));
    };

    const addOption = (fieldIndex: number) => {
        setFields((prev) =>
            prev.map((f, i) =>
                i === fieldIndex
                    ? {
                          ...f,
                          options: [
                              ...f.options,
                              { title: "", order: f.options.length },
                          ],
                      }
                    : f,
            ),
        );
    };

    const updateOption = (
        fieldIndex: number,
        optionIndex: number,
        title: string,
    ) => {
        setFields((prev) =>
            prev.map((f, i) =>
                i === fieldIndex
                    ? {
                          ...f,
                          options: f.options.map((o, j) =>
                              j === optionIndex ? { ...o, title } : o,
                          ),
                      }
                    : f,
            ),
        );
    };

    const removeOption = (fieldIndex: number, optionIndex: number) => {
        setFields((prev) =>
            prev.map((f, i) =>
                i === fieldIndex
                    ? {
                          ...f,
                          options: f.options.filter(
                              (_, j) => j !== optionIndex,
                          ),
                      }
                    : f,
            ),
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const body = {
            title,
            description: description || undefined,
            template,
            fields: fields.map((f, i) => ({
                ...(f.id ? { id: f.id } : {}),
                title: f.title,
                type: f.type,
                required: f.required,
                order: i,
                options: f.options.map((o, j) => ({
                    ...(o.id ? { id: o.id } : {}),
                    title: o.title,
                    order: j,
                })),
            })),
        };

        try {
            const result = isEditing
                ? await photon.PATCH("/api/forms/{id}", {
                      params: { path: { id: formId } },
                      body,
                  })
                : await photon.POST("/api/forms", { body });

            if (result.error) {
                toast.error(
                    isEditing
                        ? "Kunne ikke oppdatere skjema"
                        : "Kunne ikke opprette skjema",
                );
                return;
            }

            await queryClient.invalidateQueries({ queryKey: formKeys.all });
            toast.success(isEditing ? "Skjema oppdatert" : "Skjema opprettet");
            window.location.href = "/admin/skjemaer";
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
                    <CardTitle>Skjemainfo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>
                            Tittel <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Beskrivelse</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>
                    {/* biome-ignore lint/a11y/noLabelWithoutControl: checkbox is child */}
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                            checked={template}
                            onCheckedChange={(v) => setTemplate(v === true)}
                        />
                        Mal (kan gjenbrukes)
                    </label>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle>Felt</CardTitle>
                    <Button type="button" size="sm" onClick={addField}>
                        <Plus className="mr-1 size-3.5" />
                        Legg til felt
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {fields.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground">
                            Ingen felt enda. Klikk &quot;Legg til felt&quot; for
                            a begynne.
                        </p>
                    )}
                    {fields.map((field, fieldIdx) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: field order is index-based
                        <div key={fieldIdx} className="space-y-3">
                            {fieldIdx > 0 && <Separator />}
                            <div className="flex items-start justify-between gap-2">
                                <span className="mt-1 text-xs font-medium text-muted-foreground">
                                    Felt {fieldIdx + 1}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeField(fieldIdx)}
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Input
                                    value={field.title}
                                    onChange={(e) =>
                                        updateField(fieldIdx, {
                                            title: e.target.value,
                                        })
                                    }
                                    placeholder="Feltnavn"
                                    required
                                />
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                    value={field.type}
                                    onChange={(e) =>
                                        updateField(fieldIdx, {
                                            type: e.target
                                                .value as FormField["type"],
                                        })
                                    }
                                >
                                    {FIELD_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {/* biome-ignore lint/a11y/noLabelWithoutControl: checkbox is child */}
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={field.required}
                                    onCheckedChange={(v) =>
                                        updateField(fieldIdx, {
                                            required: v === true,
                                        })
                                    }
                                />
                                Obligatorisk
                            </label>

                            {(field.type === "single_select" ||
                                field.type === "multiple_select") && (
                                <div className="ml-4 space-y-2">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Alternativer
                                    </span>
                                    {field.options.map((opt, optIdx) => (
                                        <div
                                            // biome-ignore lint/suspicious/noArrayIndexKey: option order is index-based
                                            key={optIdx}
                                            className="flex items-center gap-2"
                                        >
                                            <Input
                                                value={opt.title}
                                                onChange={(e) =>
                                                    updateOption(
                                                        fieldIdx,
                                                        optIdx,
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder={`Alternativ ${optIdx + 1}`}
                                                className="flex-1"
                                                required
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    removeOption(
                                                        fieldIdx,
                                                        optIdx,
                                                    )
                                                }
                                            >
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addOption(fieldIdx)}
                                    >
                                        <Plus className="mr-1 size-3.5" />
                                        Alternativ
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                    {loading
                        ? "Lagrer..."
                        : isEditing
                          ? "Oppdater skjema"
                          : "Opprett skjema"}
                </Button>
                <a href="/admin/skjemaer">
                    <Button type="button" variant="outline">
                        Avbryt
                    </Button>
                </a>
            </div>
        </form>
    );
}
