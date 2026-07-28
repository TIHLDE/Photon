import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
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
import { Textarea } from "@tihlde/ui/ui/textarea";
import { CheckCircle2, ImagesIcon, Trash2Icon, XCircle } from "lucide-react";
import { useState } from "react";

import { uploadAssetMutation } from "#/api/queries/assets";
import { getEventsQuery } from "#/api/queries/events";
import {
    createGalleryMutation,
    createGalleryPicturesMutation,
    deleteGalleryMutation,
    getGalleriesQuery,
} from "#/api/queries/galleries";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { assetPublicUrl } from "#/lib/assets";

/** The dropzone primitive ships English copy; the admin panel is Norwegian. */
const dropzoneLabels = {
    typeRejected: "Filtypen støttes ikke",
    dropToUpload: "Slipp for å laste opp",
    limitReached: (max: number) => `Maks ${max} bilder lastet opp`,
    addMore: (count: number, max?: number) =>
        max
            ? `Klikk eller dra for å legge til (${count}/${max})`
            : "Klikk eller dra for å legge til flere",
    replaceSingle: "Klikk eller dra for å bytte bilde",
    defaultPlaceholder: "Klikk eller dra bilder hit for å laste opp",
    previewLabel: (name: string) => `Forhåndsvis ${name}`,
    removeLabel: "Fjern bilde",
};

export const Route = createFileRoute("/admin/galleri")({
    component: GalleryAdminPage,
    loader: async ({ context }) => {
        await Promise.all([
            context.queryClient.ensureQueryData(getGalleriesQuery(0)),
            context.queryClient.ensureQueryData(getEventsQuery(0)),
        ]);
        return { breadcrumbs: "Galleri" };
    },
});

function GalleryAdminPage() {
    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Galleri"
                description="Opprett gallerier og last opp bilder fra arrangementer."
            />
            <CreateGalleryCard />
            <UploadPicturesCard />
            <GalleryListCard />
        </div>
    );
}

/** Sentinel for the "no event" choice — Select cannot hold an empty value. */
const NO_EVENT = "none";

function CreateGalleryCard() {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [eventId, setEventId] = useState(NO_EVENT);

    const { data: events } = useSuspenseQuery(getEventsQuery(0));
    const createGallery = useMutation(createGalleryMutation);

    function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
        formEvent.preventDefault();
        createGallery.mutate(
            {
                data: {
                    title,
                    description: description || undefined,
                    eventId: eventId === NO_EVENT ? undefined : eventId,
                },
            },
            {
                onSuccess() {
                    setTitle("");
                    setDescription("");
                    setEventId(NO_EVENT);
                },
            },
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle>Nytt galleri</CardTitle>
                    <CardDescription>
                        Galleriet får en URL basert på tittelen. Bilder legges
                        til etterpå.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
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

                    {createGallery.isError && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke opprette galleri</AlertTitle>
                            <AlertDescription>
                                {createGallery.error.message}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            disabled={createGallery.isPending}
                        >
                            Opprett galleri
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}

function UploadPicturesCard() {
    const { data } = useSuspenseQuery(getGalleriesQuery(0));
    const galleries = data.items;

    const [slug, setSlug] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadedCount, setUploadedCount] = useState<number | null>(null);
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

        try {
            /**
             * Files go to the asset store one by one, then all the resulting
             * URLs are attached to the album in a single request — the same
             * two-step shape Lepton used (blob upload, then Picture rows).
             */
            const uploaded: { imageUrl: string }[] = [];
            for (const file of files) {
                const formData = new FormData();
                formData.append("file", file);
                const asset = await uploadAsset.mutateAsync({ formData });
                uploaded.push({ imageUrl: assetPublicUrl(asset.key) });
            }

            await addPictures.mutateAsync({
                slug,
                data: { pictures: uploaded },
            });

            setUploadedCount(uploaded.length);
            setFiles([]);
            await queryClient.invalidateQueries({
                queryKey: ["galleries"],
                exact: false,
            });
        } catch (error) {
            setUploadError(
                error instanceof Error
                    ? error.message
                    : "Ukjent feil under opplasting",
            );
        } finally {
            setIsUploading(false);
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
                                        value={files}
                                        onValueChange={setFiles}
                                        labels={dropzoneLabels}
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
                                        {uploadError}
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
                                        ? "Laster opp…"
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

function GalleryListCard() {
    const { data } = useSuspenseQuery(getGalleriesQuery(0));
    const deleteGallery = useMutation(deleteGalleryMutation);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gallerier</CardTitle>
                <CardDescription>
                    {data.totalCount === 1
                        ? "1 galleri"
                        : `${data.totalCount} gallerier`}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {data.items.length === 0 ? (
                    <AdminEmptyState
                        icon={ImagesIcon}
                        title="Ingen gallerier"
                        description="Gallerier du oppretter dukker opp her."
                    />
                ) : (
                    data.items.map((gallery) => (
                        <div
                            key={gallery.id}
                            className="flex items-center justify-between gap-4"
                        >
                            <div className="flex flex-col">
                                <Link
                                    to="/galleri/$slug"
                                    params={{ slug: gallery.slug }}
                                >
                                    {gallery.title}
                                </Link>
                                <span className="text-muted-foreground">
                                    {gallery.pictureCount === 1
                                        ? "1 bilde"
                                        : `${gallery.pictureCount} bilder`}
                                </span>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={deleteGallery.isPending}
                                onClick={() => {
                                    if (
                                        !window.confirm(
                                            `Slette "${gallery.title}" og alle bildene i det?`,
                                        )
                                    ) {
                                        return;
                                    }
                                    deleteGallery.mutate({
                                        slug: gallery.slug,
                                    });
                                }}
                            >
                                <Trash2Icon className="size-4" />
                                Slett
                            </Button>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
