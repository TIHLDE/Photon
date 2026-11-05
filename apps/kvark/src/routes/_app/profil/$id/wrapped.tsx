import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { Images } from "lucide-react";
import { Suspense } from "react";
import z from "zod";
import { requireOwnProfile } from "#/api/auth";
import {
    fetchWrappedArchiveCover,
    getWrappedArchiveQuery,
} from "#/api/queries/wrapped-archive";
import { LoadMoreButton } from "#/components/load-more-button";
import {
    WrappedArchiveCard,
    WrappedArchiveGridSkeleton,
} from "#/components/wrapped-archive-card";
import { WrappedArchiveSemesterPicker } from "#/components/wrapped-archive-semester-picker";
import { useObjectUrls } from "#/hooks/use-object-urls";
import { type Semester, isSemester, semesterLabel } from "#/lib/semester";

const searchSchema = z.object({
    semester: z
        .string()
        .refine(isSemester)
        .optional()
        .catch(undefined)
        .transform((value) => value as Semester | undefined),
});

export const Route = createFileRoute("/_app/profil/$id/wrapped")({
    component: RouteComponent,
    validateSearch: searchSchema,
    // Arkivet sier hvilke arrangementer man har vært på, så det er bare ditt.
    beforeLoad: ({ location, params }) =>
        requireOwnProfile(params.id, location.href),
    loaderDeps: ({ search }) => ({ semester: search.semester }),
    loader: ({ context, deps }) =>
        context.queryClient.ensureInfiniteQueryData(
            getWrappedArchiveQuery(deps.semester),
        ),
});

function RouteComponent() {
    const { semester } = Route.useSearch();

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h2>Wrapped</h2>
                <p className="text-sm text-muted-foreground">
                    Storyene fra arrangementene du har vært med på.
                </p>
            </div>
            <Suspense fallback={<WrappedArchiveGridSkeleton />}>
                <ArchiveSection semester={semester} />
            </Suspense>
        </div>
    );
}

function ArchiveSection({ semester }: { semester: Semester | undefined }) {
    const navigate = Route.useNavigate();
    const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
        useSuspenseInfiniteQuery(getWrappedArchiveQuery(semester));

    const stories = data.pages.flatMap((page) => page.items);
    // Lista dekker hele arkivet uansett filter, så den kan leses fra første side.
    const semesters = (data.pages[0]?.semesters ?? []).filter(isSemester);

    const coverPaths = stories.flatMap((story) =>
        story.coverImageUrl ? [story.coverImageUrl] : [],
    );
    const covers = useObjectUrls(coverPaths, fetchWrappedArchiveCover);

    if (semesters.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Images />
                    </EmptyMedia>
                    <EmptyTitle>Ingen Wrapped ennå</EmptyTitle>
                    <EmptyDescription>
                        Når en story fra et arrangement du har vært med på blir
                        publisert, dukker den opp her.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <WrappedArchiveSemesterPicker
                semesters={semesters}
                value={semester ?? null}
                onValueChange={(next) =>
                    navigate({
                        search: next ? { semester: next } : {},
                        replace: true,
                    })
                }
            />
            {stories.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Images />
                        </EmptyMedia>
                        <EmptyTitle>
                            Ingen Wrapped{" "}
                            {semester
                                ? semesterLabel(semester).toLowerCase()
                                : ""}
                        </EmptyTitle>
                        <EmptyDescription>
                            Velg et annet semester for å se flere.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {stories.map((story) => (
                        <li key={story.event.id}>
                            <WrappedArchiveCard
                                title={story.event.title}
                                start={story.event.start}
                                photoCount={story.photoCount}
                                myPhotoCount={story.myPhotoCount}
                                coverUrl={
                                    story.coverImageUrl
                                        ? covers.get(story.coverImageUrl)
                                        : null
                                }
                                link={
                                    <Link
                                        to="/arrangementer/$slug/story"
                                        params={{ slug: story.event.slug }}
                                    />
                                }
                            />
                        </li>
                    ))}
                </ul>
            )}
            {hasNextPage ? (
                <div className="flex justify-center">
                    <LoadMoreButton
                        onClick={() => fetchNextPage()}
                        isLoading={isFetchingNextPage}
                    />
                </div>
            ) : null}
        </div>
    );
}
