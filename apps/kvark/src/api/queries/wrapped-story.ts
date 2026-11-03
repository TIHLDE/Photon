import { infiniteQueryOptions } from "@tanstack/react-query";
import type { components } from "@tihlde/sdk";
import { apiClient } from "#/api/api-client";
import { fetchPrivateObjectUrl } from "#/lib/assets";

/** Storyen etter utvelgelsen (tihlde-wrapped): forsiden og de valgte bildene. */

export type WrappedStory = components["schemas"]["WrappedStory"];
export type WrappedStoryPhoto = components["schemas"]["WrappedStoryPhoto"];

export const WrappedStoryQueryKeys = {
    story: ["wrapped", "story"] as const,
} as const;

const STORY_PAGE_SIZE = 12;

/**
 * Én side om gangen: storyen kan ha hundrevis av bilder, og de fleste ser
 * bare de første. Neste side hentes når man nærmer seg slutten.
 */
export const getWrappedStoryQuery = (eventId: string) =>
    infiniteQueryOptions({
        queryKey: [...WrappedStoryQueryKeys.story, eventId],
        queryFn: ({ pageParam }) =>
            apiClient.get("/api/event/{eventId}/wrapped/story", {
                params: { eventId },
                searchParams: { page: pageParam, pageSize: STORY_PAGE_SIZE },
            }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextPage,
    });

/**
 * Bildene er private og krever sesjonen, så de hentes med credentials og
 * vises som object-URL-er. Alltid 1920 px, aldri originalen.
 */
export function fetchWrappedStoryImage(imageUrl: string): Promise<string> {
    return fetchPrivateObjectUrl(`${imageUrl}?w=1920`);
}
