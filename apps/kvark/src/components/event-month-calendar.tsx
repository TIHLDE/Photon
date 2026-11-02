import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CatchBoundary, ClientOnly, Link } from "@tanstack/react-router";
import { EventCalendar } from "@tihlde/ui/complex/event-calendar";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { addDays, startOfMonth, startOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { Suspense, useDeferredValue, useState } from "react";

import { EventQueryKeys, getEventsInRangeQuery } from "#/api/queries/events";
import { SectionError } from "#/components/section-error";
import { OSLO_TIME_ZONE, todayInOslo } from "#/lib/date";

type CalendarFilters = Omit<
    Parameters<typeof getEventsInRangeQuery>[0],
    "startFrom" | "startBefore"
>;

const GRID_DAYS = 42;

function gridRange(month: Date): { startFrom: string; startBefore: string } {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    return {
        startFrom: fromZonedTime(start, OSLO_TIME_ZONE).toISOString(),
        startBefore: fromZonedTime(
            addDays(start, GRID_DAYS),
            OSLO_TIME_ZONE,
        ).toISOString(),
    };
}

export function EventMonthCalendar({ filters }: { filters: CalendarFilters }) {
    const queryClient = useQueryClient();

    return (
        <CatchBoundary
            getResetKey={() => JSON.stringify(filters)}
            onCatch={() =>
                queryClient.resetQueries({
                    queryKey: [...EventQueryKeys.list, "range"],
                    predicate: (query) => query.state.status === "error",
                })
            }
            errorComponent={CalendarUnavailable}
        >
            <ClientOnly fallback={<CalendarSkeleton />}>
                <Suspense fallback={<CalendarSkeleton />}>
                    <MonthCalendar filters={filters} />
                </Suspense>
            </ClientOnly>
        </CatchBoundary>
    );
}

function MonthCalendar({ filters }: { filters: CalendarFilters }) {
    const [month, setMonth] = useState(() => startOfMonth(todayInOslo()));
    const deferredMonth = useDeferredValue(month);
    const deferredFilters = useDeferredValue(filters);
    const { data } = useSuspenseQuery(
        getEventsInRangeQuery({
            ...deferredFilters,
            ...gridRange(deferredMonth),
        }),
    );

    const loading =
        month !== deferredMonth ||
        JSON.stringify(filters) !== JSON.stringify(deferredFilters);

    return (
        <EventCalendar
            month={month}
            onMonthChange={setMonth}
            loading={loading}
            today={todayInOslo()}
            events={data.map((event) => ({
                id: event.id,
                title: event.title,
                start: toZonedTime(event.startTime, OSLO_TIME_ZONE),
                render: (
                    <Link
                        to="/arrangementer/$slug"
                        params={{ slug: event.slug }}
                    />
                ),
            }))}
        />
    );
}

function CalendarSkeleton() {
    return <Skeleton className="h-96 w-full" />;
}

function CalendarUnavailable() {
    return <SectionError message="Vi fikk ikke lastet kalenderen." />;
}
