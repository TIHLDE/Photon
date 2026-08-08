import {
    useMutation,
    useSuspenseInfiniteQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Empty, EmptyDescription, EmptyTitle } from "@tihlde/ui/ui/empty";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { CalendarIcon } from "lucide-react";
import { Suspense, useMemo, useState } from "react";

import { authClientWithRedirect } from "#/api/auth";
import {
    deleteGalleryPictureMutation,
    getGalleryPicturesInfiniteQuery,
    getGalleryQuery,
    updateGalleryPictureMutation,
} from "#/api/queries/galleries";
import { GalleryLightbox } from "#/components/gallery-lightbox";
import type { LightboxPicture } from "#/components/gallery-lightbox";
import { GalleryPicture } from "#/components/gallery-picture";
import { GalleryPictureEditorDialog } from "#/components/gallery-picture-editor-dialog";
import { LoadMoreButton } from "#/components/load-more-button";
import { useMediaQuery } from "#/hooks/use-media-query";
import { useAnyScopePermission } from "#/hooks/use-permission";

export const Route = createFileRoute("/_app/galleri/$slug")({
    component: GalleryDetailPage,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getGalleryQuery(params.slug)),
});

function GalleryDetailPage() {
    const { slug } = Route.useParams();
    const { data: gallery } = useSuspenseQuery(getGalleryQuery(slug));

    return (
        <div className="container mx-auto flex w-full flex-col gap-10 px-4 py-8 md:py-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl lg:text-5xl">{gallery.title}</h1>
                {gallery.description && (
                    <p className="text-muted-foreground">
                        {gallery.description}
                    </p>
                )}
                {gallery.event && (
                    <Link
                        to="/arrangementer/$slug"
                        params={{ slug: gallery.event.slug }}
                        className="flex items-center gap-2"
                    >
                        <CalendarIcon className="size-4" />
                        {gallery.event.title}
                    </Link>
                )}
            </div>

            <Suspense fallback={<PictureGridSkeleton />}>
                <PictureGrid slug={slug} />
            </Suspense>
        </div>
    );
}

function PictureGrid({ slug }: { slug: string }) {
    const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
        useSuspenseInfiniteQuery(getGalleryPicturesInfiniteQuery(slug));

    const pictures = data.pages.flatMap((page) => page.items);
    const columnCount = useColumnCount();
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [editing, setEditing] = useState<LightboxPicture | null>(null);

    const canEdit = useAnyScopePermission([
        "galleries:pictures:update",
        "galleries:manage",
    ]);
    const canDelete = useAnyScopePermission([
        "galleries:pictures:delete",
        "galleries:manage",
    ]);

    const updatePicture = useMutation(updateGalleryPictureMutation);
    const deletePicture = useMutation(deleteGalleryPictureMutation);

    function closeEditor() {
        setEditing(null);
        updatePicture.reset();
        deletePicture.reset();
    }

    const columns = useMemo(() => {
        const result: (typeof pictures)[] = Array.from(
            { length: columnCount },
            () => [],
        );
        pictures.forEach((picture, index) => {
            result[index % columnCount]?.push(picture);
        });
        return result;
    }, [pictures, columnCount]);

    if (pictures.length === 0) {
        return (
            <Empty>
                <EmptyTitle>Ingen bilder enda</EmptyTitle>
                <EmptyDescription>
                    Det er ikke lastet opp bilder i dette galleriet.
                </EmptyDescription>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/*
             * Columns are built in JS rather than with CSS `columns-*`: a
             * multi-column box sizes itself before the images have loaded, so
             * the last image overflows the container by hundreds of pixels and
             * covers whatever sits below it — on mobile that meant the image
             * swallowed every tap on "Last inn mer".
             */}
            <div className="flex gap-4">
                {columns.map((column, columnIndex) => (
                    <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
                        key={columnIndex}
                        className="flex min-w-0 flex-1 flex-col"
                    >
                        {column.map((picture) => (
                            <GalleryPicture
                                key={picture.id}
                                imageUrl={picture.imageUrl}
                                imageAlt={picture.imageAlt}
                                title={picture.title}
                                onOpen={() =>
                                    setOpenIndex(
                                        pictures.findIndex(
                                            (p) => p.id === picture.id,
                                        ),
                                    )
                                }
                            />
                        ))}
                    </div>
                ))}
            </div>

            {hasNextPage && (
                <div className="flex justify-center">
                    <LoadMoreButton
                        onClick={() => fetchNextPage()}
                        isLoading={isFetchingNextPage}
                    />
                </div>
            )}

            {/* Lightboxen ligger her, ikke i hvert bilde, slik at den kjenner
                hele listen og kan bla videre. */}
            <GalleryLightbox
                pictures={pictures}
                openIndex={openIndex}
                onOpenChange={setOpenIndex}
                canEdit={canEdit}
                onEdit={(picture) => {
                    // Lightboxen lukkes: redigeringsdialogen har sitt eget
                    // forhåndsvisningsbilde, og to dialoger oppå hverandre
                    // stabler to fokusfeller.
                    setOpenIndex(null);
                    setEditing(picture);
                }}
            />

            <GalleryPictureEditorDialog
                open={editing !== null}
                picture={editing}
                canDelete={canDelete}
                isSaving={updatePicture.isPending}
                isDeleting={deletePicture.isPending}
                error={
                    updatePicture.error?.message ??
                    deletePicture.error?.message ??
                    null
                }
                onClose={closeEditor}
                onSubmit={(values) => {
                    if (!editing) return;
                    updatePicture.mutate(
                        {
                            slug,
                            pictureId: editing.id,
                            data: {
                                // Tomt felt betyr «ingen verdi», ikke tom
                                // streng — API-et lagrer null.
                                title: values.title || null,
                                description: values.description || null,
                                imageAlt: values.imageAlt || null,
                            },
                        },
                        { onSuccess: closeEditor },
                    );
                }}
                onDelete={() => {
                    if (!editing) return;
                    deletePicture.mutate(
                        { slug, pictureId: editing.id },
                        { onSuccess: closeEditor },
                    );
                }}
            />
        </div>
    );
}

/**
 * Masonry column count, mirroring the `sm`/`lg`/`xl` Tailwind breakpoints.
 * Falls back to a single column during SSR, which is also the mobile layout.
 */
function useColumnCount(): number {
    const isXl = useMediaQuery("(min-width: 1280px)");
    const isLg = useMediaQuery("(min-width: 1024px)");
    const isSm = useMediaQuery("(min-width: 640px)");

    if (isXl) return 4;
    if (isLg) return 3;
    if (isSm) return 2;
    return 1;
}

function PictureGridSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                <Skeleton key={index} className="h-60 w-full" />
            ))}
        </div>
    );
}
