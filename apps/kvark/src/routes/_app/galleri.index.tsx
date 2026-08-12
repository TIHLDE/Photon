import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@tihlde/ui/ui/empty";
import { Stagger } from "@tihlde/ui/ui/motion";
import { PlusIcon } from "lucide-react";

import { authClientWithRedirect } from "#/api/auth";
import { getGalleriesInfiniteQuery } from "#/api/queries/galleries";
import { GalleryCard } from "#/components/gallery-card";
import { LoadMoreButton } from "#/components/load-more-button";
import { PageHeader } from "#/components/page-header";
import { useAnyScopePermission } from "#/hooks/use-permission";

/** Module-level so the permission lookup keeps a stable identity. */
const GALLERY_CREATE_PERMISSIONS = [
    "galleries:create",
    "galleries:manage",
] as const;

export const Route = createFileRoute("/_app/galleri/")({
    component: GalleriesPage,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
    loader: ({ context }) =>
        context.queryClient.ensureInfiniteQueryData(
            getGalleriesInfiniteQuery(),
        ),
});

function GalleriesPage() {
    const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
        useSuspenseInfiniteQuery(getGalleriesInfiniteQuery());

    const galleries = data.pages.flatMap((page) => page.items);
    // Any-scope: scopet er ukjent på en offentlig liste, og API-et avviser
    // uansett den enkelte forespørselen som ikke treffer.
    const canCreateGallery = useAnyScopePermission(GALLERY_CREATE_PERMISSIONS);

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <PageHeader
                title="Galleri"
                description="Bilder fra arrangementene våre"
                action={
                    canCreateGallery ? (
                        <Button
                            render={
                                <Link
                                    to="/admin/galleri"
                                    search={{ ny: true }}
                                />
                            }
                        >
                            <PlusIcon className="size-4" />
                            Nytt galleri
                        </Button>
                    ) : null
                }
            />

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
