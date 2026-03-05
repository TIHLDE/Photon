import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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
import { eventKeys } from "~/lib/queries/events";
import { listGroupsQuery } from "~/lib/queries/groups";

function toLocalDT(iso?: string | null): string {
    if (!iso) return "";
    return iso.slice(0, 16);
}

type EventFormProps = {
    eventId?: string;
    initialData?: {
        title?: string;
        description?: string;
        categorySlug?: string;
        organizerGroupSlug?: string;
        location?: string;
        imageUrl?: string | null;
        start?: string;
        end?: string;
        registrationStart?: string | null;
        registrationEnd?: string;
        cancellationDeadline?: string | null;
        capacity?: number | null;
        requiresSigningUp?: boolean;
        isRegistrationClosed?: boolean;
        allowWaitlist?: boolean;
        onlyAllowPrioritized?: boolean;
        canCauseStrikes?: boolean;
        enforcesPreviousStrikes?: boolean;
        isPaidEvent?: boolean;
        price?: number | null;
        paymentGracePeriodMinutes?: number | null;
        contactPersonUserId?: string | null;
        reactionsAllowed?: boolean;
    };
};

export function EventForm({ eventId, initialData }: EventFormProps) {
    const isEditing = !!eventId;
    const queryClient = useQueryClient();
    const { data: groups } = useSuspenseQuery(listGroupsQuery());
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        title: initialData?.title ?? "",
        description: initialData?.description ?? "",
        categorySlug: initialData?.categorySlug ?? "",
        organizerGroupSlug: initialData?.organizerGroupSlug ?? "",
        location: initialData?.location ?? "",
        imageUrl: initialData?.imageUrl ?? "",
        start: toLocalDT(initialData?.start),
        end: toLocalDT(initialData?.end),
        registrationStart: toLocalDT(initialData?.registrationStart),
        registrationEnd: toLocalDT(initialData?.registrationEnd),
        cancellationDeadline: toLocalDT(initialData?.cancellationDeadline),
        capacity: initialData?.capacity?.toString() ?? "",
        requiresSigningUp: initialData?.requiresSigningUp ?? true,
        isRegistrationClosed: initialData?.isRegistrationClosed ?? false,
        allowWaitlist: initialData?.allowWaitlist ?? false,
        onlyAllowPrioritized: initialData?.onlyAllowPrioritized ?? false,
        canCauseStrikes: initialData?.canCauseStrikes ?? false,
        enforcesPreviousStrikes: initialData?.enforcesPreviousStrikes ?? false,
        isPaidEvent: initialData?.isPaidEvent ?? false,
        price: initialData?.price?.toString() ?? "",
        paymentGracePeriodMinutes:
            initialData?.paymentGracePeriodMinutes?.toString() ?? "",
        contactPersonUserId: initialData?.contactPersonUserId ?? "",
        reactionsAllowed: initialData?.reactionsAllowed ?? true,
    });

    const set = (key: string, value: string | boolean) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const body = {
            title: form.title,
            description: form.description,
            categorySlug: form.categorySlug,
            organizerGroupSlug: form.organizerGroupSlug,
            location: form.location,
            imageUrl: form.imageUrl || null,
            start: new Date(form.start).toISOString(),
            end: new Date(form.end).toISOString(),
            registrationStart: form.registrationStart
                ? new Date(form.registrationStart).toISOString()
                : null,
            registrationEnd: new Date(form.registrationEnd).toISOString(),
            cancellationDeadline: form.cancellationDeadline
                ? new Date(form.cancellationDeadline).toISOString()
                : null,
            capacity: form.capacity ? Number(form.capacity) : null,
            requiresSigningUp: form.requiresSigningUp,
            isRegistrationClosed: form.isRegistrationClosed,
            allowWaitlist: form.allowWaitlist,
            onlyAllowPrioritized: form.onlyAllowPrioritized,
            canCauseStrikes: form.canCauseStrikes,
            enforcesPreviousStrikes: form.enforcesPreviousStrikes,
            isPaidEvent: form.isPaidEvent,
            price: form.price ? Number(form.price) : null,
            paymentGracePeriodMinutes: form.paymentGracePeriodMinutes
                ? Number(form.paymentGracePeriodMinutes)
                : null,
            contactPersonUserId: form.contactPersonUserId || null,
            priorityPools: null,
            reactionsAllowed: form.reactionsAllowed,
        };

        try {
            const result = isEditing
                ? await photon.PUT("/api/event/{id}", {
                      params: { path: { id: eventId } },
                      body,
                  })
                : await photon.POST("/api/event", { body });

            if (result.error) {
                toast.error(
                    isEditing
                        ? "Kunne ikke oppdatere arrangement"
                        : "Kunne ikke opprette arrangement",
                );
                return;
            }

            await queryClient.invalidateQueries({
                queryKey: eventKeys.all,
            });
            toast.success(
                isEditing ? "Arrangement oppdatert" : "Arrangement opprettet",
            );
            window.location.href = "/admin/arrangementer";
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
                    <Field label="Tittel" required>
                        <Input
                            value={form.title}
                            onChange={(e) => set("title", e.target.value)}
                            required
                        />
                    </Field>
                    <Field label="Beskrivelse" required>
                        <Textarea
                            value={form.description}
                            onChange={(e) => set("description", e.target.value)}
                            rows={6}
                            required
                        />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Kategori (slug)" required>
                            <Input
                                value={form.categorySlug}
                                onChange={(e) =>
                                    set("categorySlug", e.target.value)
                                }
                                placeholder="f.eks. bedpres, sosialt, kurs"
                                required
                            />
                        </Field>
                        <Field label="Arrangerende gruppe" required>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                value={form.organizerGroupSlug}
                                onChange={(e) =>
                                    set("organizerGroupSlug", e.target.value)
                                }
                                required
                            >
                                <option value="">Velg gruppe</option>
                                {groups?.map((g) => (
                                    <option key={g.slug} value={g.slug}>
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <Field label="Sted" required>
                        <Input
                            value={form.location}
                            onChange={(e) => set("location", e.target.value)}
                            required
                        />
                    </Field>
                    <Field label="Bilde-URL">
                        <Input
                            value={form.imageUrl}
                            onChange={(e) => set("imageUrl", e.target.value)}
                            type="url"
                            placeholder="https://..."
                        />
                    </Field>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Tidspunkt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Start" required>
                            <Input
                                type="datetime-local"
                                value={form.start}
                                onChange={(e) => set("start", e.target.value)}
                                required
                            />
                        </Field>
                        <Field label="Slutt" required>
                            <Input
                                type="datetime-local"
                                value={form.end}
                                onChange={(e) => set("end", e.target.value)}
                                required
                            />
                        </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Påmelding åpner">
                            <Input
                                type="datetime-local"
                                value={form.registrationStart}
                                onChange={(e) =>
                                    set("registrationStart", e.target.value)
                                }
                            />
                        </Field>
                        <Field label="Påmelding stenger" required>
                            <Input
                                type="datetime-local"
                                value={form.registrationEnd}
                                onChange={(e) =>
                                    set("registrationEnd", e.target.value)
                                }
                                required
                            />
                        </Field>
                        <Field label="Avmeldingsfrist">
                            <Input
                                type="datetime-local"
                                value={form.cancellationDeadline}
                                onChange={(e) =>
                                    set("cancellationDeadline", e.target.value)
                                }
                            />
                        </Field>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Påmelding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Field label="Kapasitet (antall plasser)">
                        <Input
                            type="number"
                            min={0}
                            value={form.capacity}
                            onChange={(e) => set("capacity", e.target.value)}
                            placeholder="Tom = ubegrenset"
                        />
                    </Field>
                    <Separator />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <CheckboxField
                            label="Krever påmelding"
                            checked={form.requiresSigningUp}
                            onChange={(v) => set("requiresSigningUp", v)}
                        />
                        <CheckboxField
                            label="Påmelding stengt"
                            checked={form.isRegistrationClosed}
                            onChange={(v) => set("isRegistrationClosed", v)}
                        />
                        <CheckboxField
                            label="Tillat venteliste"
                            checked={form.allowWaitlist}
                            onChange={(v) => set("allowWaitlist", v)}
                        />
                        <CheckboxField
                            label="Kun prioriterte"
                            checked={form.onlyAllowPrioritized}
                            onChange={(v) => set("onlyAllowPrioritized", v)}
                        />
                        <CheckboxField
                            label="Kan gi prikker"
                            checked={form.canCauseStrikes}
                            onChange={(v) => set("canCauseStrikes", v)}
                        />
                        <CheckboxField
                            label="Håndhev tidligere prikker"
                            checked={form.enforcesPreviousStrikes}
                            onChange={(v) => set("enforcesPreviousStrikes", v)}
                        />
                        <CheckboxField
                            label="Tillat reaksjoner"
                            checked={form.reactionsAllowed}
                            onChange={(v) => set("reactionsAllowed", v)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Betaling</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <CheckboxField
                        label="Betalt arrangement"
                        checked={form.isPaidEvent}
                        onChange={(v) => set("isPaidEvent", v)}
                    />
                    {form.isPaidEvent && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Pris (kr)">
                                <Input
                                    type="number"
                                    min={0}
                                    value={form.price}
                                    onChange={(e) =>
                                        set("price", e.target.value)
                                    }
                                />
                            </Field>
                            <Field label="Betalingsfrist (min etter påmelding)">
                                <Input
                                    type="number"
                                    min={0}
                                    value={form.paymentGracePeriodMinutes}
                                    onChange={(e) =>
                                        set(
                                            "paymentGracePeriodMinutes",
                                            e.target.value,
                                        )
                                    }
                                />
                            </Field>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                    {loading
                        ? "Lagrer..."
                        : isEditing
                          ? "Oppdater arrangement"
                          : "Opprett arrangement"}
                </Button>
                <a href="/admin/arrangementer">
                    <Button type="button" variant="outline">
                        Avbryt
                    </Button>
                </a>
            </div>
        </form>
    );
}

function Field({
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

function CheckboxField({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        // biome-ignore lint/a11y/noLabelWithoutControl: checkbox is child
        <label className="flex items-center gap-2 text-sm">
            <Checkbox
                checked={checked}
                onCheckedChange={(v) => onChange(v === true)}
            />
            {label}
        </label>
    );
}
