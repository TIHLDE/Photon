import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { getEventsInfiniteQuery } from "#/api/queries/events";
import { EventCard } from "#/components/event-card";
import { GroupPageHeader } from "#/components/group-page-header";
import { LoadMoreButton } from "#/components/load-more-button";
import { formatEventDateTime } from "#/lib/event";

type EventPeriod = "kommende" | "tidligere";

const PERIODS: { value: EventPeriod; label: string }[] = [
    { value: "kommende", label: "Kommende" },
    { value: "tidligere", label: "Tidligere" },
];

type GroupEventsTabProps = {
    /** Slug of the group whose events to list. */
    slug: string;
    /** Whether the viewer may arrange events for THIS group. */
    canCreateEvent?: boolean;
};

export function GroupEventsTab({
    slug,
    canCreateEvent = false,
}: GroupEventsTabProps) {
    const [period, setPeriod] = useState<EventPeriod>("kommende");

    const { data, isPending, hasNextPage, fetchNextPage, isFetchingNextPage } =
        useInfiniteQuery(
            getEventsInfiniteQuery({
                organizerGroupSlug: slug,
                expired: period === "tidligere",
            }),
        );

    const events = data?.pages.flatMap((page) => page.items) ?? [];

    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader
                title="Arrangementer"
                action={
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Tabs
                            value={period}
                            onValueChange={(next) =>
                                setPeriod(next as EventPeriod)
                            }
                        >
                            <TabsList>
                                {PERIODS.map((p) => (
                                    <TabsTrigger key={p.value} value={p.value}>
                                        {p.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                        {canCreateEvent ? (
                            <Button
                                size="sm"
                                render={
                                    <Link
                                        to="/admin/arrangementer/ny"
                                        search={{ gruppe: slug }}
                                    />
                                }
                            >
                                <PlusIcon className="size-4" />
                                Nytt arrangement
                            </Button>
                        ) : null}
                    </div>
                }
            />

            {isPending ? (
                <div className="flex flex-col gap-4 sm:gap-1">
                    {[0, 1, 2].map((row) => (
                        <Skeleton key={row} className="h-24 w-full" />
                    ))}
                </div>
            ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {period === "kommende"
                        ? "Gruppen har ingen kommende arrangementer."
                        : "Gruppen har ingen tidligere arrangementer."}
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {events.map((event) => (
                        <li key={event.id}>
                            <EventCard
                                slug={event.slug}
                                title={event.title}
                                startsAt={formatEventDateTime(event.startTime)}
                                location={event.location ?? ""}
                                organizer={event.organizer?.name ?? ""}
                                category={event.category?.label}
                                imageUrl={event.image || undefined}
                                imageAlt={event.imageAlt || undefined}
                            />
                        </li>
                    ))}
                </ul>
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
