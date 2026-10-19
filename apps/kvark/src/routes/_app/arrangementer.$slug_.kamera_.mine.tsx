import { Suspense, useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import { toast } from "@tihlde/ui/ui/sonner";
import { ArrowLeft } from "lucide-react";

import { authClientWithRedirect } from "#/api/auth";
import { getEventByIdQuery } from "#/api/queries/events";
import {
    fetchMyWrappedPhotoThumb,
    getMyWrappedPhotosQuery,
    getWrappedCameraQuery,
    invalidateMine,
    myWrappedPhotoImagePath,
    submitMyWrappedPhotosMutation,
} from "#/api/queries/wrapped";
import {
    WrappedMyPhotos,
    WrappedMyPhotosSkeleton,
    type WrappedMyPhotoTile,
} from "#/components/wrapped-my-photos";
import { useObjectUrls } from "#/hooks/use-object-urls";
import { extractErrorMessage } from "#/lib/api-error";
import { formatInOslo } from "#/lib/date";
import { errorStatus } from "#/lib/utils";

/**
 * Mine bilder: /arrangementer/<slug>/kamera/mine.
 *
 * `kamera_` og ikke `kamera`: kamerasida har ingen `<Outlet />`, så en nøstet
 * rute ville aldri blitt vist.
 */
export const Route = createFileRoute("/_app/arrangementer/$slug_/kamera_/mine")(
    {
        component: WrappedMyPhotosPage,
        beforeLoad: ({ location }) => authClientWithRedirect(location.href),
        loader: async ({ context, params }) => {
            const event = await context.queryClient.ensureQueryData(
                getEventByIdQuery(params.slug),
            );
            await Promise.all([
                context.queryClient.ensureQueryData(
                    getWrappedCameraQuery(event.id),
                ),
                context.queryClient.ensureQueryData(
                    getMyWrappedPhotosQuery(event.id),
                ),
            ]);
        },
    },
);

function WrappedMyPhotosPage() {
    const { slug } = Route.useParams();

    return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon-lg"
                    className="size-13"
                    aria-label="Tilbake til kameraet"
                    render={
                        <Link
                            to="/arrangementer/$slug/kamera"
                            params={{ slug }}
                        />
                    }
                >
                    <ArrowLeft />
                </Button>
                <h1 className="text-3xl">Mine bilder</h1>
            </div>
            <Suspense fallback={<WrappedMyPhotosSkeleton />}>
                <WrappedMyPhotosContainer slug={slug} />
            </Suspense>
        </div>
    );
}

function WrappedMyPhotosContainer({ slug }: { slug: string }) {
    const queryClient = useQueryClient();
    const { data: event } = useSuspenseQuery(getEventByIdQuery(slug));
    const { data: camera } = useSuspenseQuery(getWrappedCameraQuery(event.id));
    const { data: photos } = useSuspenseQuery(
        getMyWrappedPhotosQuery(event.id),
    );
    const submit = useMutation(submitMyWrappedPhotosMutation);

    const paths = useMemo(
        () =>
            photos.map((photo) => myWrappedPhotoImagePath(event.id, photo.id)),
        [photos, event.id],
    );
    const thumbnails = useObjectUrls(paths, fetchMyWrappedPhotoThumb);

    // API-et gir bildene eldste først, så nummeret er rekkefølgen de ble
    // tatt i.
    const tiles: WrappedMyPhotoTile[] = photos.map((photo, index) => ({
        id: photo.id,
        number: index + 1,
        src: thumbnails.get(paths[index] ?? ""),
        fromCameraRoll: photo.source === "camera_roll",
        submitted: photo.submitted,
    }));

    function handleSubmit() {
        submit.mutate(
            { eventId: event.id },
            {
                onSuccess: ({ submittedCount }) => {
                    toast.success(
                        `${submittedCount} ${submittedCount === 1 ? "bilde" : "bilder"} sendt til arrangøren`,
                    );
                },
                onError: async (error) => {
                    console.error("Innsending av kamerabilder feilet", error);
                    // 409: kameraet har stengt. Lista og statusen hentes på
                    // nytt, så det som vises stemmer med serveren.
                    if (errorStatus(error) === 409) {
                        await invalidateMine(queryClient, event.id);
                    }
                    toast.error(await extractErrorMessage(error));
                },
            },
        );
    }

    return (
        <WrappedMyPhotos
            photos={tiles}
            shotsLeft={camera.canShoot ? camera.shotsLeft : 0}
            draftCount={camera.draftCount}
            closesAt={formatInOslo(camera.closesAt, "HH:mm")}
            cameraLink={
                <Link to="/arrangementer/$slug/kamera" params={{ slug }} />
            }
            isSubmitting={submit.isPending}
            onSubmit={handleSubmit}
        />
    );
}
