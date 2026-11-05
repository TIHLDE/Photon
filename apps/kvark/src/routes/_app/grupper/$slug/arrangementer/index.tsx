import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { getEventsInfiniteQuery } from "#/api/queries/events";
import { getGroupBySlugQuery } from "#/api/queries/groups";
import { SectionError } from "#/components/section-error";
import { EventCard } from "#/components/event-card";
import { LoadMoreButton } from "#/components/load-more-button";
import { useScopedPermission } from "#/hooks/use-permission";
import { formatEventDateTime } from "#/lib/event";

type EventPeriod = "kommende" | "tidligere";
const PERIODS: { value: EventPeriod; label: string }[] = [
    { value: "kommende", label: "Kommende" },
    { value: "tidligere", label: "Tidligere" },
];

/** Module-level so the permission lookup keeps a stable identity. */
const EVENT_CREATE_PERMISSIONS = ["events:create", "events:manage"] as const;
export const Route = createFileRoute("/_app/grupper/$slug/arrangementer/")({
    component: GroupEventsPage,
});

function GroupEventsPage() {
    const { slug } = Route.useParams();

    const { data: apiGroup } = useSuspenseQuery(getGroupBySlugQuery(slug));

    const isArchived = Boolean(apiGroup.archivedAt);

    // Arrangementer er scopet på samme måte: lederskap alene gir ikke
    // events:create — det avhenger av gruppens leaderPermissions — så vi
    // spør om selve tilgangen for nettopp denne gruppen.
    const canCreateEvent =
        useScopedPermission(EVENT_CREATE_PERMISSIONS, `group:${slug}`) &&
        !isArchived;

    const [period, setPeriod] = useState<EventPeriod>("kommende");

    const {
        data,
        isPending,
        isError,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery(
        getEventsInfiniteQuery({
            organizerGroupSlug: slug,
            expired: period === "tidligere",
        }),
    );

    const events = data?.pages.flatMap((page) => page.items) ?? [];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl">Arrangementer</h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Tabs
                        value={period}
                        onValueChange={(next) => setPeriod(next as EventPeriod)}
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
            </div>

            {isPending ? (
                <div className="flex flex-col gap-4 sm:gap-1">
                    {[0, 1, 2].map((row) => (
                        <Skeleton key={row} className="h-24 w-full" />
                    ))}
                </div>
            ) : isError && !data ? (
                <SectionError message="Vi fikk ikke lastet arrangementene. Prøv igjen senere." />
            ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {period === "kommende"
                        ? "Gruppen har ingen kommende arrangementer."
                        : "Gruppen har ingen tidligere arrangementer."}
                </p>
            ) : (
                <ul className="flex flex-col">
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
