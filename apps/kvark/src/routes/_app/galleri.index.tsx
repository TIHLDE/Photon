import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Empty, EmptyDescription, EmptyTitle } from "@tihlde/ui/ui/empty";
import { Reveal, Stagger } from "@tihlde/ui/ui/motion";

import { getGalleriesInfiniteQuery } from "#/api/queries/galleries";
import { GalleryCard } from "#/components/gallery-card";
import { LoadMoreButton } from "#/components/load-more-button";

export const Route = createFileRoute("/_app/galleri/")({
    component: GalleriesPage,
    loader: ({ context }) =>
        context.queryClient.ensureInfiniteQueryData(
            getGalleriesInfiniteQuery(),
        ),
});

function GalleriesPage() {
    const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
        useSuspenseInfiniteQuery(getGalleriesInfiniteQuery());

    const galleries = data.pages.flatMap((page) => page.items);

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <Reveal render={<div className="flex flex-col gap-1" />}>
                <h1 className="text-3xl">Galleri</h1>
                <p className="text-muted-foreground">
                    Bilder fra arrangementene våre
                </p>
            </Reveal>

            {galleries.length === 0 ? (
                <Empty>
                    <EmptyTitle>Ingen gallerier enda</EmptyTitle>
                    <EmptyDescription>
                        Når det legges ut bilder fra et arrangement dukker de
                        opp her.
                    </EmptyDescription>
                </Empty>
            ) : (
                <Stagger
                    render={
                        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
                    }
                >
                    {galleries.map((gallery) => (
                        <li key={gallery.id}>
                            <GalleryCard
                                slug={gallery.slug}
                                title={gallery.title}
                                description={gallery.description}
                                imageUrl={gallery.imageUrl}
                                pictureCount={gallery.pictureCount}
                            />
                        </li>
                    ))}
                </Stagger>
            )}

            {hasNextPage && (
                <div className="flex justify-center">
                    <LoadMoreButton
                        onClick={() => fetchNextPage()}
                        isLoading={isFetchingNextPage}
                    />
                </div>
            )}
        </div>
    );
}
