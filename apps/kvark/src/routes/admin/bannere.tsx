import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { BookmarkIcon, PencilIcon, PlusIcon, Trash2 } from "lucide-react";
import { addDays } from "date-fns";
import { nb } from "date-fns/locale";
import { Suspense, useEffect, useState } from "react";

import type { Banner } from "@tihlde/sdk";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { DateTimePicker } from "@tihlde/ui/ui/date-time-picker";
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
import { Textarea } from "@tihlde/ui/ui/textarea";

import {
    createBannerMutation,
    deleteBannerMutation,
    getBannersQuery,
    updateBannerMutation,
} from "#/api/queries/banners";
import { Stagger } from "@tihlde/ui/ui/motion";

import { requireAdminSection } from "#/lib/admin-access";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { OSLO_TIME_ZONE } from "#/lib/date";

export const Route = createFileRoute("/admin/bannere")({
    component: BannersAdminPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "bannere");
    },
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getBannersQuery());
        return { breadcrumbs: "Bannere" };
    },
});

function BannersAdminPage() {
    const canCreate = useAnyScopePermission([
        "banners:create",
        "banners:manage",
    ]);
    const [dialog, setDialog] = useState<
        { mode: "create" } | { mode: "edit"; banner: Banner } | null
    >(null);

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title="Bannere"
                description="Tidsstyrte toppbannere for viktige beskjeder på forsiden."
                action={
                    canCreate ? (
                        <Button onClick={() => setDialog({ mode: "create" })}>
                            <PlusIcon className="size-4" />
                            Nytt banner
                        </Button>
                    ) : null
                }
            />

            <Suspense fallback={<TableSkeleton />}>
                <BannersTable
                    onEdit={(banner) => setDialog({ mode: "edit", banner })}
                />
            </Suspense>

            <BannerDialog
                key={dialog?.mode === "edit" ? dialog.banner.id : "create"}
                open={dialog !== null}
                banner={dialog?.mode === "edit" ? dialog.banner : null}
                onOpenChange={(open) => {
                    if (!open) setDialog(null);
                }}
            />
        </Stagger>
    );
}

function BannersTable({ onEdit }: { onEdit: (banner: Banner) => void }) {
    const { data: banners } = useSuspenseQuery(getBannersQuery());
    const remove = useMutation(deleteBannerMutation);
    const canEdit = useAnyScopePermission(["banners:update", "banners:manage"]);
    const canDelete = useAnyScopePermission([
        "banners:delete",
        "banners:manage",
    ]);

    if (banners.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={BookmarkIcon}
                        title="Ingen bannere"
                        description="Ingen bannere er opprettet ennå. Opprett et for å vise en beskjed på forsiden i et gitt tidsrom."
                    />
                </CardContent>
            </Card>
        );
    }

    function handleDelete(banner: Banner) {
        if (
            window.confirm(
                `Slette banneret "${banner.title}"? Dette kan ikke angres.`,
            )
        ) {
            remove.mutate({ bannerId: banner.id });
        }
    }

    return (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tittel</TableHead>
                            <TableHead>Synlig fra</TableHead>
                            <TableHead>Synlig til</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">
                                Handlinger
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {banners.map((banner) => (
                            <TableRow key={banner.id}>
                                <TableCell>{banner.title}</TableCell>
                                <TableCell>
                                    {formatDateTime(banner.visibleFrom)}
                                </TableCell>
                                <TableCell>
                                    {formatDateTime(banner.visibleUntil)}
                                </TableCell>
                                <TableCell>
                                    <BannerStatusBadge banner={banner} />
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-2">
                                        {canEdit ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onEdit(banner)}
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
                                                    handleDelete(banner)
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

function BannerStatusBadge({ banner }: { banner: Banner }) {
    if (banner.isVisible) {
        return <Badge variant="secondary">Synlig nå</Badge>;
    }
    if (new Date(banner.visibleFrom).getTime() > Date.now()) {
        return <Badge variant="outline">Planlagt</Badge>;
    }
    return <Badge variant="outline">Utløpt</Badge>;
}

function BannerDialog({
    open,
    banner,
    onOpenChange,
}: {
    open: boolean;
    banner: Banner | null;
    onOpenChange: (open: boolean) => void;
}) {
    const isEdit = banner !== null;

    const [title, setTitle] = useState(banner?.title ?? "");
    const [description, setDescription] = useState(banner?.description ?? "");
    const [url, setUrl] = useState(banner?.url ?? "");
    const [linkText, setLinkText] = useState(banner?.linkText ?? "");
    const [openInNewTab, setOpenInNewTab] = useState(
        banner?.openInNewTab ?? true,
    );
    const [visibleFrom, setVisibleFrom] = useState<Date | null>(
        banner?.visibleFrom ? new Date(banner.visibleFrom) : null,
    );
    const [visibleUntil, setVisibleUntil] = useState<Date | null>(
        banner?.visibleUntil ? new Date(banner.visibleUntil) : null,
    );
    const [error, setError] = useState<string | null>(null);

    // Nytt banner: synlig fra nå og en uke fram. Redigering beholder verdiene.
    useEffect(() => {
        const now = new Date();
        setVisibleFrom((current) => current ?? now);
        setVisibleUntil((current) => current ?? addDays(now, 7));
    }, []);

    const create = useMutation(createBannerMutation);
    const update = useMutation(updateBannerMutation);
    const isPending = create.isPending || update.isPending;

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        if (!visibleFrom || !visibleUntil) {
            setError("Både synlig fra og synlig til må fylles ut.");
            return;
        }

        const fromIso = visibleFrom.toISOString();
        const untilIso = visibleUntil.toISOString();

        if (fromIso >= untilIso) {
            setError("Synlig fra må være før synlig til.");
            return;
        }

        try {
            if (isEdit && banner) {
                await update.mutateAsync({
                    bannerId: banner.id,
                    data: {
                        title,
                        description,
                        url: url || null,
                        linkText: linkText || null,
                        openInNewTab,
                        visibleFrom: fromIso,
                        visibleUntil: untilIso,
                    },
                });
            } else {
                await create.mutateAsync({
                    data: {
                        title,
                        description,
                        url: url || undefined,
                        linkText: linkText || undefined,
                        openInNewTab,
                        visibleFrom: fromIso,
                        visibleUntil: untilIso,
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
            <DialogContent className="sm:max-w-2xl">
                <form
                    onSubmit={handleSubmit}
                    className="flex min-h-0 flex-auto flex-col gap-4"
                >
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit ? "Rediger banner" : "Nytt banner"}
                        </DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="banner-title">
                                    Tittel
                                </FieldLabel>
                                <Input
                                    id="banner-title"
                                    required
                                    maxLength={200}
                                    value={title}
                                    onChange={(event) =>
                                        setTitle(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="banner-description">
                                    Beskrivelse
                                </FieldLabel>
                                <Textarea
                                    id="banner-description"
                                    required
                                    rows={3}
                                    maxLength={500}
                                    value={description}
                                    onChange={(event) =>
                                        setDescription(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="banner-url">
                                    Lenke (valgfri)
                                </FieldLabel>
                                <Input
                                    id="banner-url"
                                    type="url"
                                    value={url}
                                    onChange={(event) =>
                                        setUrl(event.target.value)
                                    }
                                    placeholder="https://"
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="banner-link-text">
                                    Lenketekst (valgfri)
                                </FieldLabel>
                                <Input
                                    id="banner-link-text"
                                    maxLength={100}
                                    value={linkText}
                                    onChange={(event) =>
                                        setLinkText(event.target.value)
                                    }
                                    placeholder="Les mer"
                                />
                            </Field>
                            <Field orientation="horizontal">
                                <Checkbox
                                    id="banner-open-in-new-tab"
                                    checked={openInNewTab}
                                    onCheckedChange={(next) =>
                                        setOpenInNewTab(next === true)
                                    }
                                />
                                <FieldLabel htmlFor="banner-open-in-new-tab">
                                    Åpne lenken i ny fane
                                </FieldLabel>
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field>
                                    <FieldLabel htmlFor="banner-visible-from">
                                        Synlig fra
                                    </FieldLabel>
                                    <DateTimePicker
                                        id="banner-visible-from"
                                        locale={nb}
                                        placeholder="Velg dato"
                                        value={visibleFrom}
                                        onValueChange={setVisibleFrom}
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="banner-visible-until">
                                        Synlig til
                                    </FieldLabel>
                                    <DateTimePicker
                                        id="banner-visible-until"
                                        locale={nb}
                                        placeholder="Velg dato"
                                        minDate={visibleFrom ?? undefined}
                                        value={visibleUntil}
                                        onValueChange={setVisibleUntil}
                                    />
                                </Field>
                            </div>
                        </FieldGroup>
                        {error && (
                            <p
                                className="text-sm text-destructive"
                                role="alert"
                            >
                                {error}
                            </p>
                        )}
                    </DialogBody>
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

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString("nb-NO", {
        timeZone: OSLO_TIME_ZONE,
        dateStyle: "short",
        timeStyle: "short",
    });
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
