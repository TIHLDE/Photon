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
import { newsKeys } from "~/lib/queries/news";

type NewsFormProps = {
    newsId?: string;
    initialData?: {
        title?: string;
        header?: string;
        body?: string;
        imageUrl?: string | null;
        imageAlt?: string | null;
        emojisAllowed?: boolean;
    };
};

export function NewsForm({ newsId, initialData }: NewsFormProps) {
    const isEditing = !!newsId;
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        title: initialData?.title ?? "",
        header: initialData?.header ?? "",
        body: initialData?.body ?? "",
        imageUrl: initialData?.imageUrl ?? "",
        imageAlt: initialData?.imageAlt ?? "",
        emojisAllowed: initialData?.emojisAllowed ?? false,
    });

    const set = (key: string, value: string | boolean) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const body = {
            title: form.title,
            header: form.header,
            body: form.body,
            imageUrl: form.imageUrl || undefined,
            imageAlt: form.imageAlt || undefined,
            emojisAllowed: form.emojisAllowed,
        };

        try {
            const result = isEditing
                ? await photon.PATCH("/api/news/{id}", {
                      params: { path: { id: newsId } },
                      body,
                  })
                : await photon.POST("/api/news", { body });

            if (result.error) {
                toast.error(
                    isEditing
                        ? "Kunne ikke oppdatere nyhet"
                        : "Kunne ikke opprette nyhet",
                );
                return;
            }

            await queryClient.invalidateQueries({ queryKey: newsKeys.all });
            toast.success(isEditing ? "Nyhet oppdatert" : "Nyhet opprettet");
            window.location.href = "/admin/nyheter";
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
                    <CardTitle>Nyhetsartikkel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>
                            Tittel <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            value={form.title}
                            onChange={(e) => set("title", e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>
                            Ingress <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            value={form.header}
                            onChange={(e) => set("header", e.target.value)}
                            rows={2}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>
                            Innhold (Markdown){" "}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            value={form.body}
                            onChange={(e) => set("body", e.target.value)}
                            rows={12}
                            className="font-mono text-sm"
                            required
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Bilde-URL</Label>
                            <Input
                                value={form.imageUrl}
                                onChange={(e) =>
                                    set("imageUrl", e.target.value)
                                }
                                type="url"
                                placeholder="https://..."
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Bilde alt-tekst</Label>
                            <Input
                                value={form.imageAlt}
                                onChange={(e) =>
                                    set("imageAlt", e.target.value)
                                }
                            />
                        </div>
                    </div>
                    {/* biome-ignore lint/a11y/noLabelWithoutControl: checkbox is child */}
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                            checked={form.emojisAllowed}
                            onCheckedChange={(v) =>
                                set("emojisAllowed", v === true)
                            }
                        />
                        Tillat emoji-reaksjoner
                    </label>
                </CardContent>
            </Card>

            <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                    {loading
                        ? "Lagrer..."
                        : isEditing
                          ? "Oppdater nyhet"
                          : "Publiser nyhet"}
                </Button>
                <a href="/admin/nyheter">
                    <Button type="button" variant="outline">
                        Avbryt
                    </Button>
                </a>
            </div>
        </form>
    );
}
