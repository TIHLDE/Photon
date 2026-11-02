import { useRender } from "@base-ui/react/use-render";
import {
    addMonths,
    format,
    isSameDay,
    isSameMonth,
    startOfDay,
    startOfMonth,
    startOfWeek,
} from "date-fns";
import { nb } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { Button } from "#/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from "#/components/ui/popover";
import { cn } from "#/lib/utils";

/** Days rendered in the grid: always six full weeks, so the height never jumps. */
const CELL_COUNT = 42;

/** Pills shown inside a day cell before the rest collapse into "+ N flere". */
const MAX_VISIBLE_PER_DAY = 3;

export type EventCalendarEvent = {
    id: string;
    title: string;
    /** ISO timestamp or Date for when the event starts. */
    start: string | Date;
    /** Optional element the pill renders as, e.g. a router `<Link />`. */
    render?: useRender.RenderProp;
};

type EventCalendarProps = {
    events: readonly EventCalendarEvent[];
    /** Month to show initially. Defaults to the month of the next event. */
    defaultMonth?: Date;
    /**
     * The month shown, for callers that load events one month at a time.
     * Pair with `onMonthChange`; leave both out to let the calendar own it.
     */
    month?: Date;
    onMonthChange?: (month: Date) => void;
    /**
     * Events for the shown month are still loading. `events` may then belong
     * to another month, so the grid is dimmed and "no events" is not claimed.
     */
    loading?: boolean;
    /**
     * Today's date as local midnight. Defaults to the browser's today; pass
     * the date in the events' own timezone when that differs.
     */
    today?: Date;
    className?: string;
};

type ResolvedEvent = EventCalendarEvent & { date: Date };

function toResolvedEvents(
    events: readonly EventCalendarEvent[],
): ResolvedEvent[] {
    return events
        .map((event) => ({ ...event, date: new Date(event.start) }))
        .filter((event) => !Number.isNaN(event.date.getTime()))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Open on the month holding the next upcoming event so a calendar of future
 * events is never empty on first paint. Falls back to the current month.
 */
function initialMonth(events: ResolvedEvent[]): Date {
    const now = Date.now();
    const upcoming = events.find((event) => event.date.getTime() >= now);
    return startOfMonth(upcoming?.date ?? new Date());
}

function dayKey(date: Date): string {
    return format(date, "yyyy-MM-dd");
}

/**
 * Renders as whatever the event asked for (typically a router link), falling
 * back to a plain span when the event is not clickable.
 */
function EventPill({
    event,
    className,
    children,
}: {
    event: ResolvedEvent;
    className: string;
    children: React.ReactNode;
}) {
    return useRender({
        render: event.render ?? <span />,
        props: { className, title: event.title, children },
    });
}

/**
 * "+ N flere" on a full day. Opens every event of that day next to the cell,
 * so the grid keeps its height and the reader keeps their place in the month.
 */
function DayOverflow({
    date,
    events,
    overflow,
}: {
    date: Date;
    events: ResolvedEvent[];
    overflow: number;
}) {
    const label = format(date, "EEEE d. MMMM", { locale: nb });

    return (
        <Popover>
            <PopoverTrigger
                aria-label={`Vis alle ${events.length} arrangementer ${label}`}
                className="cursor-pointer rounded-md px-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
                + {overflow} flere
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="max-h-(--available-height) w-64"
            >
                <PopoverHeader>
                    <PopoverTitle className="first-letter:uppercase">
                        {label}
                    </PopoverTitle>
                </PopoverHeader>
                {/* The heading stays put; only the list scrolls on a packed day. */}
                <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
                    {events.map((event) => (
                        <EventPill
                            key={event.id}
                            event={event}
                            className="flex shrink-0 items-center gap-2 rounded-md bg-primary/15 px-2 py-1.5 text-sm transition-colors hover:bg-primary/30"
                        >
                            <span className="tabular-nums text-muted-foreground">
                                {format(event.date, "HH:mm")}
                            </span>
                            <span className="truncate">{event.title}</span>
                        </EventPill>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function EventCalendar({
    events,
    defaultMonth,
    month: controlledMonth,
    onMonthChange,
    loading = false,
    today: todayProp,
    className,
}: EventCalendarProps) {
    const resolved = React.useMemo(() => toResolvedEvents(events), [events]);

    const [uncontrolledMonth, setUncontrolledMonth] = React.useState(
        () => defaultMonth ?? initialMonth(resolved),
    );
    const month = controlledMonth ?? uncontrolledMonth;
    const [selected, setSelected] = React.useState<Date | null>(null);

    const cells = React.useMemo(() => {
        const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
        return Array.from({ length: CELL_COUNT }, (_, index) => {
            const date = new Date(
                first.getFullYear(),
                first.getMonth(),
                first.getDate() + index,
            );
            return { date, inMonth: isSameMonth(date, month) };
        });
    }, [month]);

    const byDay = React.useMemo(() => {
        const grouped = new Map<string, ResolvedEvent[]>();
        for (const event of resolved) {
            const key = dayKey(event.date);
            const existing = grouped.get(key);
            if (existing) {
                existing.push(event);
            } else {
                grouped.set(key, [event]);
            }
        }
        return grouped;
    }, [resolved]);

    const goToMonth = (next: Date) => {
        setUncontrolledMonth(next);
        onMonthChange?.(next);
        setSelected(null);
    };

    // Without a pick, the agenda lists today — or, in another month, its first
    // day, so it never reports on a day outside what the caller loaded.
    const today = startOfDay(todayProp ?? new Date());
    const agendaDay =
        selected ?? (isSameMonth(today, month) ? today : startOfMonth(month));
    const selectedEvents = byDay.get(dayKey(agendaDay)) ?? [];

    return (
        <div className={cn("flex w-full flex-col gap-4", className)}>
            <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-lg first-letter:uppercase">
                    {format(month, "LLLL yyyy", { locale: nb })}
                </h3>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => goToMonth(startOfMonth(today))}
                    >
                        I dag
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Forrige måned"
                        onClick={() => goToMonth(addMonths(month, -1))}
                    >
                        <ChevronLeft />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Neste måned"
                        onClick={() => goToMonth(addMonths(month, 1))}
                    >
                        <ChevronRight />
                    </Button>
                </div>
            </div>

            <div
                aria-busy={loading}
                className={cn(
                    "flex flex-col overflow-hidden rounded-lg ring-1 ring-border transition-opacity",
                    loading && "opacity-60",
                )}
            >
                <div className="grid grid-cols-7 bg-muted/50">
                    {cells.slice(0, 7).map(({ date }) => (
                        <div
                            key={date.getDay()}
                            className="px-1 py-1.5 text-center text-xs font-medium text-muted-foreground uppercase"
                        >
                            <span className="sm:hidden">
                                {format(date, "EEEEE", { locale: nb })}
                            </span>
                            <span className="hidden sm:inline">
                                {format(date, "EEE", { locale: nb })}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-px bg-border">
                    {cells.map(({ date, inMonth }) => {
                        const key = dayKey(date);
                        const dayEvents = byDay.get(key) ?? [];
                        const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY);
                        const overflow = dayEvents.length - visible.length;
                        const isSelected = selected
                            ? isSameDay(date, selected)
                            : false;

                        return (
                            <div
                                key={key}
                                className={cn(
                                    "relative flex min-h-14 flex-col items-start gap-1 bg-card p-1 text-left sm:min-h-28 sm:gap-1.5 sm:p-1.5",
                                    // Dim the leading/trailing days rather than
                                    // tinting them — a filled background reads
                                    // as "selected" in the dark theme.
                                    !inMonth && "text-foreground/40 opacity-60",
                                    isSelected && "bg-muted",
                                )}
                            >
                                {/* Day picker for the mobile agenda below. Above `sm`
                                    the pills themselves are the interactive elements,
                                    so this overlay must not swallow their clicks. */}
                                <button
                                    type="button"
                                    onClick={() => setSelected(date)}
                                    aria-pressed={isSelected}
                                    className="absolute inset-0 cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:hidden"
                                >
                                    <span className="sr-only">
                                        {`${format(date, "d. MMMM yyyy", { locale: nb })}, ${dayEvents.length} arrangementer`}
                                    </span>
                                </button>

                                <span
                                    className={cn(
                                        "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums",
                                        isSameDay(date, today) &&
                                            "bg-primary font-medium text-primary-foreground",
                                    )}
                                >
                                    {date.getDate()}
                                </span>

                                {/* Compact density on phones: a dot per event. */}
                                <span className="flex flex-wrap gap-0.5 sm:hidden">
                                    {dayEvents
                                        .slice(0, MAX_VISIBLE_PER_DAY)
                                        .map((event) => (
                                            <span
                                                key={event.id}
                                                className="size-1.5 rounded-full bg-primary"
                                            />
                                        ))}
                                </span>

                                <span className="hidden w-full min-w-0 flex-col gap-0.5 sm:flex">
                                    {visible.map((event) => (
                                        <EventPill
                                            key={event.id}
                                            event={event}
                                            className="block w-full truncate rounded-md bg-primary/15 px-1.5 py-0.5 text-left text-xs text-foreground transition-colors hover:bg-primary/30"
                                        >
                                            <span className="tabular-nums text-muted-foreground">
                                                {format(event.date, "HH:mm")}
                                            </span>{" "}
                                            {event.title}
                                        </EventPill>
                                    ))}
                                    {overflow > 0 ? (
                                        <DayOverflow
                                            date={date}
                                            events={dayEvents}
                                            overflow={overflow}
                                        />
                                    ) : null}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Phones cannot fit pills in the grid, so the picked day is listed out. */}
            <div className="flex flex-col gap-2 sm:hidden">
                <p className="text-sm font-medium first-letter:uppercase">
                    {format(agendaDay, "EEEE d. MMMM", {
                        locale: nb,
                    })}
                </p>
                {loading ? null : selectedEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Ingen arrangementer denne dagen.
                    </p>
                ) : (
                    selectedEvents.map((event) => (
                        <EventPill
                            key={event.id}
                            event={event}
                            className="flex items-center gap-2 rounded-md bg-primary/15 px-2 py-1.5 text-sm"
                        >
                            <span className="tabular-nums text-muted-foreground">
                                {format(event.date, "HH:mm")}
                            </span>
                            <span className="truncate">{event.title}</span>
                        </EventPill>
                    ))
                )}
            </div>
        </div>
    );
}
