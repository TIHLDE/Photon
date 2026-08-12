import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { NewspaperIcon, PencilIcon, PlusIcon, Trash2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";

import type { NewsListItem } from "@tihlde/sdk";
import { RichEditor } from "@tihlde/ui/complex/markdown";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import {
    Dialog,
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
import { Textarea } from "@tihlde/ui/ui/textarea";
import z from "zod";

import { Stagger } from "@tihlde/ui/ui/motion";

import { useImageUploader } from "#/api/queries/assets";
import {
    createNewsMutation,
    deleteNewsMutation,
    getNewsQuery,
    updateNewsMutation,
} from "#/api/queries/news";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminImageField } from "#/components/admin-image-field";
import { AdminPageHeader } from "#/components/admin-page-header";
import { richRegistry } from "#/components/markdown/directives/presets";
import { useAnyScopePermission } from "#/hooks/use-permission";

// `?rediger=<id>` gjør redigeringsdialogen adresserbar, slik at «Rediger
// nyhet» på nyhetssiden kan lenke rett til riktig artikkel i stedet for å
// slippe deg av på listen. `?ny` gjør det samme for opprettelsesdialogen,
// slik at «Ny nyhet» andre steder i appen lander rett i skjemaet.
const searchSchema = z.object({
    rediger: z.string().optional().catch(undefined),
    ny: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/admin/nyheter")({
    component: NewsAdminPage,
    validateSearch: searchSchema,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getNewsQuery(0));
        return { breadcrumbs: "Nyheter" };
    },
});

function NewsAdminPage() {
    const canCreate = useAnyScopePermission(["news:create", "news:manage"]);
    const { rediger, ny } = Route.useSearch();
    const navigate = Route.useNavigate();
    const [dialog, setDialog] = useState<
        { mode: "create" } | { mode: "edit"; news: NewsListItem } | null
    >(null);

    // `canCreate` er false ved første render på en kald sidelast, siden
    // sesjonen ikke er hentet enda. Derfor en effekt og ikke en lazy
    // initialisering. Lukking fjerner `ny` fra URL-en, så dialogen tvinges
    // ikke opp igjen etterpå.
    useEffect(() => {
        if (!ny || !canCreate) return;
        setDialog({ mode: "create" });
    }, [ny, canCreate]);

    function closeDialog() {
        setDialog(null);
        // Ellers ville dialogen åpnet seg igjen med en gang, siden id-en
        // fortsatt sto i URL-en.
        if (rediger || ny) navigate({ search: {}, replace: true });
    }

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title="Nyheter"
                description="Alle publiserte nyheter. Brødteksten lagres som markdown."
                action={
                    canCreate ? (
                        <Button onClick={() => setDialog({ mode: "create" })}>
                            <PlusIcon className="size-4" />
                            Ny nyhet
                        </Button>
                    ) : null
                }
            />

            <Suspense fallback={<TableSkeleton />}>
                <NewsTable
                    autoEditId={rediger}
                    onEdit={(news) => setDialog({ mode: "edit", news })}
                />
            </Suspense>

            <NewsDialog
                key={dialog?.mode === "edit" ? dialog.news.id : "create"}
                open={dialog !== null}
                news={dialog?.mode === "edit" ? dialog.news : null}
                onOpenChange={(open) => {
                    if (!open) closeDialog();
                }}
            />
        </Stagger>
    );
}

function NewsTable({
    autoEditId,
    onEdit,
}: {
    autoEditId?: string;
    onEdit: (news: NewsListItem) => void;
}) {
    const { data } = useSuspenseQuery(getNewsQuery(0, {}, 100));
    const remove = useMutation(deleteNewsMutation);
    const canEdit = useAnyScopePermission(["news:update", "news:manage"]);
    const canDelete = useAnyScopePermission(["news:delete", "news:manage"]);

    // Listen ligger her, ikke i forelderen, så oppslaget av `?rediger=<id>`
    // må også gjøres her. Kjører kun når id-en endrer seg, slik at dialogen
    // ikke tvinges opp igjen etter at man har lukket den.
    // biome-ignore lint/correctness/useExhaustiveDependencies: onEdit er ny hver render
    useEffect(() => {
        if (!autoEditId || !canEdit) return;
        const match = data.items.find((news) => news.id === autoEditId);
        if (match) onEdit(match);
    }, [autoEditId, canEdit, data.items]);

    if (data.items.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={NewspaperIcon}
                        title="Ingen nyheter"
                        description="Ingen nyheter er publisert ennå. Opprett en for å vise den på forsiden."
                    />
                </CardContent>
            </Card>
        );
    }

    function handleDelete(news: NewsListItem) {
        if (
            window.confirm(
                `Slette nyheten «${news.title}»? Dette kan ikke angres.`,
            )
        ) {
            remove.mutate({ newsId: news.id });
        }
    }

    return (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tittel</TableHead>
                            <TableHead>Utdrag</TableHead>
                            <TableHead>Publisert</TableHead>
                            <TableHead className="text-right">
                                Handlinger
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.items.map((news) => (
                            <TableRow key={news.id}>
                                <TableCell>{news.title}</TableCell>
                                <TableCell>{news.header}</TableCell>
                                <TableCell>
                                    {formatDate(news.createdAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        {canEdit ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onEdit(news)}
                                            >
                                                <PencilIcon className="size-4" />
                                                Rediger
                                            </Button>
                                        ) : null}
                                        {canDelete ? (
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                aria-label={`Slett ${news.title}`}
                                                disabled={remove.isPending}
                                                onClick={() =>
                                                    handleDelete(news)
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

function NewsDialog({
    open,
    news,
    onOpenChange,
}: {
    open: boolean;
    news: NewsListItem | null;
    onOpenChange: (open: boolean) => void;
}) {
    const [title, setTitle] = useState(news?.title ?? "");
    const [excerpt, setExcerpt] = useState(news?.header ?? "");
    const [body, setBody] = useState(news?.body ?? "");
    const [image, setImage] = useState<File | null>(null);
    const [imageAlt, setImageAlt] = useState(news?.imageAlt ?? "");
    const [error, setError] = useState<string | null>(null);

    const createNews = useMutation(createNewsMutation);
    const updateNews = useMutation(updateNewsMutation);
    const { uploadImage, isUploading } = useImageUploader();

    const isPending =
        createNews.isPending || updateNews.isPending || isUploading;

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        // Uploaded first: a failed upload must not leave a news item behind
        // that silently lost its cover.
        let imageUrl: string | undefined;
        if (image) {
            try {
                imageUrl = await uploadImage(image);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                return;
            }
        }

        try {
            if (news) {
                await updateNews.mutateAsync({
                    newsId: news.id,
                    data: {
                        title,
                        header: excerpt,
                        body,
                        // Only send an image when a new one was picked, so
                        // editing never clears the existing cover.
                        ...(imageUrl ? { imageUrl, imageAlt } : {}),
                    },
                });
            } else {
                await createNews.mutateAsync({
                    data: {
                        title,
                        header: excerpt,
                        body,
                        emojisAllowed: false,
                        imageUrl,
                        imageAlt: imageUrl ? imageAlt || undefined : undefined,
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
                            {news ? "Rediger nyhet" : "Ny nyhet"}
                        </DialogTitle>
                    </DialogHeader>

                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="news-title">Tittel</FieldLabel>
                            <Input
                                id="news-title"
                                type="text"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="news-excerpt">
                                Utdrag
                            </FieldLabel>
                            <Textarea
                                id="news-excerpt"
                                rows={2}
                                required
                                value={excerpt}
                                onChange={(e) => setExcerpt(e.target.value)}
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Brødtekst</FieldLabel>
                            <RichEditor
                                registry={richRegistry}
                                value={body}
                                onChange={setBody}
                            />
                        </Field>
                        <AdminImageField
                            label="Forsidebilde"
                            description="Vises på nyhetskortet og øverst på nyhetssiden."
                            preset="cover-wide"
                            value={image}
                            onChange={setImage}
                            existingImageUrl={news?.imageUrl ?? undefined}
                        />
                        <Field>
                            <FieldLabel htmlFor="news-image-alt">
                                Bildebeskrivelse
                            </FieldLabel>
                            <Input
                                id="news-image-alt"
                                type="text"
                                maxLength={255}
                                placeholder="Kort beskrivelse for skjermlesere"
                                value={imageAlt}
                                onChange={(e) => setImageAlt(e.target.value)}
                            />
                        </Field>
                    </FieldGroup>

                    {error && <p role="alert">{error}</p>}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Avbryt
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isUploading
                                ? "Laster opp bilde …"
                                : news
                                  ? "Lagre"
                                  : "Publiser"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function formatDate(iso: string) {
    return format(new Date(iso), "d. MMM yyyy", { locale: nb });
}

function TableSkeleton() {
    return (
        <Card>
            <CardContent className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                    <Skeleton key={index} className="h-10 w-full" />
                ))}
            </CardContent>
        </Card>
    );
}
