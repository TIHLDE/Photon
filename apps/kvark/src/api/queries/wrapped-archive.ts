import { infiniteQueryOptions } from "@tanstack/react-query";
import type { components } from "@tihlde/sdk";
import { apiClient } from "#/api/api-client";
import { fetchPrivateObjectUrl } from "#/lib/assets";
import type { Semester } from "#/lib/semester";

/** Arkivet over storyene man har vært med i (tihlde-wrapped). */

export type WrappedArchive = components["schemas"]["WrappedArchive"];
export type WrappedArchiveItem = WrappedArchive["items"][number];

export const WrappedArchiveQueryKeys = {
    archive: ["wrapped", "archive"] as const,
} as const;

const ARCHIVE_PAGE_SIZE = 12;

/** Nyeste arrangement først, eventuelt bare ett semester. */
export const getWrappedArchiveQuery = (semester?: Semester) =>
    infiniteQueryOptions({
        queryKey: [...WrappedArchiveQueryKeys.archive, semester ?? "all"],
        queryFn: ({ pageParam }) =>
            apiClient.get("/api/event/wrapped/archive", {
                searchParams: {
                    page: pageParam,
                    pageSize: ARCHIVE_PAGE_SIZE,
                    ...(semester ? { semester } : {}),
                },
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
    });

/**
 * Forsidebildet er privat og krever sesjonen, så det hentes med credentials
 * og vises som object-URL. En flis på 480 px, aldri originalen.
 */
export function fetchWrappedArchiveCover(imageUrl: string): Promise<string> {
    return fetchPrivateObjectUrl(`${imageUrl}?w=480`);
}
