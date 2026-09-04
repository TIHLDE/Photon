import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { Gallery } from "@tihlde/sdk";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { ImageDropzone } from "@tihlde/ui/ui/image-dropzone";
import { Input } from "@tihlde/ui/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
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
    CheckCircle2,
    ImagesIcon,
    PencilIcon,
    PlusIcon,
    Trash2Icon,
    XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Stagger } from "@tihlde/ui/ui/motion";

import { requireAdminSection } from "#/lib/admin-access";
import { uploadAssetMutation } from "#/api/queries/assets";
import { getEventsQuery } from "#/api/queries/events";
import {
    createGalleryMutation,
    createGalleryPicturesMutation,
    deleteGalleryMutation,
    getGalleriesQuery,
    updateGalleryMutation,
} from "#/api/queries/galleries";
import {
    ConfirmDeleteDialog,
    usePendingConfirm,
} from "#/components/confirm-delete-dialog";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { TeknologiministerMessage } from "#/components/teknologiminister-message";
import z from "zod";

import { useAnyScopePermission } from "#/hooks/use-permission";
import { assetPublicUrl } from "#/lib/assets";
import { imageDropzoneLabels } from "#/lib/image";

/** The dropzone primitive ships English copy; the admin panel is Norwegian. */
const dropzoneLabels = {
    ...imageDropzoneLabels,
    defaultPlaceholder: "Klikk eller dra bilder hit for å laste opp",
};

// `?ny` gjør opprettelsesdialogen adresserbar, slik at «Nytt galleri» andre
// steder i appen lander rett i skjemaet i stedet for på listen.
const searchSchema = z.object({
    ny: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/admin/galleri")({
    component: GalleryAdminPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "galleri");
    },
    validateSearch: searchSchema,
    loader: async ({ context }) => {
        await Promise.all([
            context.queryClient.ensureQueryData(getGalleriesQuery(0)),
            context.queryClient.ensureQueryData(getEventsQuery(0)),
        ]);
        return { breadcrumbs: "Galleri" };
    },
});

function GalleryAdminPage() {
    const canCreateGallery = useAnyScopePermission([
        "galleries:create",
        "galleries:manage",
    ]);
    const canUploadPictures = useAnyScopePermission([
        "galleries:pictures:create",
        "galleries:manage",
    ]);
    const { ny } = Route.useSearch();
    const navigate = Route.useNavigate();
    const [dialog, setDialog] = useState<
        { mode: "create" } | { mode: "edit"; gallery: Gallery } | null
    >(null);

    // `canCreateGallery` er false ved første render på en kald sidelast,
    // siden sesjonen ikke er hentet enda. Derfor en effekt og ikke en lazy
    // initialisering. Lukking fjerner `ny` fra URL-en, så dialogen tvinges
    // ikke opp igjen etterpå.
    useEffect(() => {
        if (!ny || !canCreateGallery) return;
        setDialog({ mode: "create" });
    }, [ny, canCreateGallery]);

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
                title="Galleri"
                description="Opprett gallerier og last opp bilder fra arrangementer."
                action={
                    canCreateGallery ? (
                        <Button onClick={() => setDialog({ mode: "create" })}>
                            <PlusIcon className="size-4" />
                            Nytt galleri
                        </Button>
                    ) : null
                }
            />
            {canUploadPictures ? <UploadPicturesCard /> : null}
            <GalleryTable
                onEdit={(gallery) => setDialog({ mode: "edit", gallery })}
            />

            <GalleryDialog
                key={dialog?.mode === "edit" ? dialog.gallery.id : "create"}
                open={dialog !== null}
                gallery={dialog?.mode === "edit" ? dialog.gallery : null}
                onOpenChange={(open) => {
                    if (!open) closeDialog();
                }}
            />
        </Stagger>
    );
}

/** Sentinel for the "no event" choice — Select cannot hold an empty value. */
const NO_EVENT = "none";

function GalleryDialog({
    open,
    gallery,
    onOpenChange,
}: {
    open: boolean;
    gallery: Gallery | null;
    onOpenChange: (open: boolean) => void;
}) {
    const [title, setTitle] = useState(gallery?.title ?? "");
    const [description, setDescription] = useState(gallery?.description ?? "");
    const [eventId, setEventId] = useState(gallery?.event?.id ?? NO_EVENT);
    const [error, setError] = useState<string | null>(null);

    const { data: events } = useSuspenseQuery(getEventsQuery(0));
    const createGallery = useMutation(createGalleryMutation);
    const updateGallery = useMutation(updateGalleryMutation);

    const isPending = createGallery.isPending || updateGallery.isPending;

    async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
        formEvent.preventDefault();
        setError(null);

        try {
            if (gallery) {
                await updateGallery.mutateAsync({
                    slug: gallery.slug,
                    data: {
                        title,
                        description: description || null,
                        eventId: eventId === NO_EVENT ? null : eventId,
                    },
                });
            } else {
                await createGallery.mutateAsync({
                    data: {
                        title,
                        description: description || undefined,
                        eventId: eventId === NO_EVENT ? undefined : eventId,
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
            <DialogContent className="sm:max-w-xl">
                <form
                    onSubmit={handleSubmit}
                    className="flex min-h-0 flex-auto flex-col gap-4"
                >
                    <DialogHeader>
                        <DialogTitle>
                            {gallery ? "Rediger galleri" : "Nytt galleri"}
                        </DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="gallery-title">
                                    Tittel
                                </FieldLabel>
                                <Input
                                    id="gallery-title"
                                    type="text"
                                    required
                                    maxLength={100}
                                    value={title}
                                    onChange={(event) =>
                                        setTitle(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="gallery-description">
                                    Beskrivelse
                                </FieldLabel>
                                <Textarea
                                    id="gallery-description"
                                    rows={2}
                                    value={description}
                                    onChange={(event) =>
                                        setDescription(event.target.value)
                                    }
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="gallery-event">
                                    Arrangement (valgfritt)
                                </FieldLabel>
                                <Select
                                    value={eventId}
                                    onValueChange={(value) =>
                                        setEventId(value ?? NO_EVENT)
                                    }
                                >
                                    <SelectTrigger id="gallery-event">
                                        <SelectValue placeholder="Ingen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NO_EVENT}>
                                            Ingen
                                        </SelectItem>
                                        {events.items.map((item) => (
                                            <SelectItem
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {item.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </FieldGroup>

                        {error && <p role="alert">{error}</p>}
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
                            {gallery ? "Lagre" : "Opprett galleri"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/**
 * `POST /api/galleries/:slug/pictures` tar maks 100 bilder om gangen, og en
 * fadderuke-mappe er fort tre ganger så stor. Vi laster opp og fester én pulje
 * av gangen: hver forespørsel holder seg innenfor grensa, og bildene som alt
 * er lagt inn blir liggende selv om noe ryker underveis.
 */
const PICTURES_PER_BATCH = 50;

function batched<T>(items: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        batches.push(items.slice(i, i + size));
    }
    return batches;
}

function UploadPicturesCard() {
    const { data } = useSuspenseQuery(getGalleriesQuery(0));
    const galleries = data.items;

    const [slug, setSlug] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadedCount, setUploadedCount] = useState<number | null>(null);
    const [addedCount, setAddedCount] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const queryClient = useQueryClient();
    const uploadAsset = useMutation(uploadAssetMutation);
    const addPictures = useMutation(createGalleryPicturesMutation);

    async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!slug || files.length === 0) return;

        setIsUploading(true);
        setUploadError(null);
        setUploadedCount(null);
        setAddedCount(0);
        setProgress(0);

        /**
         * Files go to the asset store one by one, then the resulting URLs are
         * attached to the album — the same two-step shape Lepton used (blob
         * upload, then Picture rows), bare pulje for pulje.
         */
        let added = 0;
        try {
            for (const batch of batched(files, PICTURES_PER_BATCH)) {
                const uploaded: { imageUrl: string }[] = [];
                for (const file of batch) {
                    const formData = new FormData();
                    formData.append("file", file);
                    const asset = await uploadAsset.mutateAsync({ formData });
                    uploaded.push({ imageUrl: assetPublicUrl(asset.key) });
                    setProgress((done) => done + 1);
                }

                await addPictures.mutateAsync({
                    slug,
                    data: { pictures: uploaded },
                });

                added += uploaded.length;
                setAddedCount(added);
            }

            setUploadedCount(added);
            setFiles([]);
        } catch (error) {
            setUploadError(
                error instanceof Error
                    ? error.message
                    : "Ukjent feil under opplasting",
            );
            // Puljene som gikk gjennom ligger allerede i galleriet. Lar de
            // resterende filene bli stående i feltet, så «prøv igjen» tar
            // opp tråden i stedet for å legge inn duplikater.
            setFiles(files.slice(added));
        } finally {
            setIsUploading(false);
            await queryClient.invalidateQueries({
                queryKey: ["galleries"],
                exact: false,
            });
        }
    }

    return (
        <form onSubmit={handleUpload}>
            <Card>
                <CardHeader>
                    <CardTitle>Last opp bilder</CardTitle>
                    <CardDescription>
                        Velg et galleri og last opp så mange bilder du vil. Det
                        første bildet blir forsidebilde hvis galleriet mangler
                        ett.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    {galleries.length === 0 ? (
                        <AdminEmptyState
                            icon={ImagesIcon}
                            title="Ingen gallerier enda"
                            description="Opprett et galleri først, så kan du laste opp bilder i det."
                        />
                    ) : (
                        <>
                            <FieldGroup>
                                <Field>
                                    <FieldLabel htmlFor="gallery-select">
                                        Galleri
                                    </FieldLabel>
                                    <Select
                                        value={slug}
                                        onValueChange={(value) =>
                                            setSlug(value ?? "")
                                        }
                                    >
                                        <SelectTrigger id="gallery-select">
                                            <SelectValue placeholder="Velg galleri" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {galleries.map((gallery) => (
                                                <SelectItem
                                                    key={gallery.id}
                                                    value={gallery.slug}
                                                >
                                                    {gallery.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field>
                                    <FieldLabel>Bilder</FieldLabel>
                                    <ImageDropzone
                                        multiple
                                        preset="natural"
                                        value={files}
                                        onValueChange={setFiles}
                                        labels={dropzoneLabels}
                                        // Nye filer midt i en pågående
                                        // opplasting ville verken blitt lastet
                                        // opp eller overlevd opprydningen
                                        // etterpå. Feilgrenen i handleUpload
                                        // regner dessuten ut hva som gjenstår
                                        // med `files.slice(added)`, og det
                                        // regnestykket forutsetter at lista
                                        // står stille mens vi laster opp.
                                        disabled={isUploading}
                                    />
                                </Field>
                            </FieldGroup>

                            {uploadedCount !== null && (
                                <Alert>
                                    <CheckCircle2 className="size-4" />
                                    <AlertTitle>Lastet opp</AlertTitle>
                                    <AlertDescription>
                                        {uploadedCount === 1
                                            ? "1 bilde ble lagt til i galleriet."
                                            : `${uploadedCount} bilder ble lagt til i galleriet.`}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {uploadError && (
                                <Alert variant="destructive">
                                    <XCircle className="size-4" />
                                    <AlertTitle>
                                        Kunne ikke laste opp
                                    </AlertTitle>
                                    <AlertDescription>
                                        <TeknologiministerMessage
                                            message={
                                                addedCount > 0
                                                    ? `${addedCount === 1 ? "1 bilde" : `${addedCount} bilder`} rakk å bli lagt til. Resten ligger klare i feltet – prøv igjen. (${uploadError})`
                                                    : uploadError
                                            }
                                        />
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={
                                        isUploading ||
                                        !slug ||
                                        files.length === 0
                                    }
                                >
                                    {isUploading
                                        ? `Laster opp… ${progress}/${files.length}`
                                        : `Last opp ${files.length || ""}`.trim()}
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </form>
    );
}

/** «og alle 0 bildene» leser feil på et tomt galleri, og «1 bildene» like ille. */
function galleryDeleteScope(pictureCount: number): string {
    if (pictureCount === 0) return "Galleriet slettes for godt.";
    if (pictureCount === 1)
        return "Galleriet og bildet i det slettes for godt.";
    return `Galleriet og alle ${pictureCount} bildene i det slettes for godt.`;
}

function GalleryTable({ onEdit }: { onEdit: (gallery: Gallery) => void }) {
    const { data } = useSuspenseQuery(getGalleriesQuery(0));
    const deleteGallery = useMutation(deleteGalleryMutation);
    const canEdit = useAnyScopePermission([
        "galleries:update",
        "galleries:manage",
    ]);
    const canDelete = useAnyScopePermission([
        "galleries:delete",
        "galleries:manage",
    ]);
    const confirmDelete = usePendingConfirm<Gallery>();

    if (data.items.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={ImagesIcon}
                        title="Ingen gallerier"
                        description="Gallerier du oppretter dukker opp her."
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tittel</TableHead>
                                <TableHead>Arrangement</TableHead>
                                <TableHead>Bilder</TableHead>
                                <TableHead className="text-right">
                                    Handlinger
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.items.map((gallery) => (
                                <TableRow key={gallery.id}>
                                    <TableCell>
                                        <Link
                                            to="/galleri/$slug"
                                            params={{ slug: gallery.slug }}
                                        >
                                            {gallery.title}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        {gallery.event?.title ?? "—"}
                                    </TableCell>
                                    <TableCell>
                                        {gallery.pictureCount}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {canEdit ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        onEdit(gallery)
                                                    }
                                                >
                                                    <PencilIcon className="size-4" />
                                                    Rediger
                                                </Button>
                                            ) : null}
                                            {canDelete ? (
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    aria-label={`Slett ${gallery.title}`}
                                                    disabled={
                                                        deleteGallery.isPending
                                                    }
                                                    onClick={() =>
                                                        confirmDelete.request(
                                                            gallery,
                                                        )
                                                    }
                                                >
                                                    <Trash2Icon className="size-4" />
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
                title={`Slette «${confirmDelete.shown?.title}»?`}
                description={`${galleryDeleteScope(
                    confirmDelete.shown?.pictureCount ?? 0,
                )} Dette kan ikke angres.`}
                confirmLabel="Slett galleri"
                isPending={deleteGallery.isPending}
                onConfirm={() => {
                    if (!confirmDelete.pending) return;
                    deleteGallery.mutate({ slug: confirmDelete.pending.slug });
                    confirmDelete.clear();
                }}
            />
        </>
    );
}
