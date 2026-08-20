import { Link } from "@tanstack/react-router";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    startOfMonth,
    startOfWeek,
} from "date-fns";
import { nb } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { formatInOslo } from "#/lib/date";
import { cn } from "#/lib/utils";

export type CalendarEvent = {
    id: string;
    slug: string;
    title: string;
    startTime: string;
    category?: string;
};

type EventCalendarProps = {
    events: CalendarEvent[];
};

const WEEKDAY_LABELS = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];

/**
 * Månedskalender over arrangementene som er lastet inn. Rutenettet starter
 * alltid på mandag og fylles ut med dagene fra nabomånedene, slik at ukene blir
 * hele.
 */
export function EventCalendar({ events }: EventCalendarProps) {
    const [month, setMonth] = useState(() => startOfMonth(new Date()));

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [month]);

    const eventsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        for (const event of events) {
            // Datoen et arrangement havner på er den norske datoen. Rutenettet
            // under bygges av lokale midnatter, som gir samme «yyyy-MM-dd»
            // uansett tidssone, så de to nøklene møtes.
            const key = formatInOslo(event.startTime, "yyyy-MM-dd");
            const list = map.get(key) ?? [];
            list.push(event);
            map.set(key, list);
        }
        return map;
    }, [events]);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    aria-label="Forrige måned"
                    onClick={() => setMonth((m) => addMonths(m, -1))}
                >
                    <ChevronLeft />
                </Button>
                <span className="font-medium">
                    {format(month, "LLLL yyyy", { locale: nb })}
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    aria-label="Neste måned"
                    onClick={() => setMonth((m) => addMonths(m, 1))}
                >
                    <ChevronRight />
                </Button>
            </div>

            <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_LABELS.map((label) => (
                    <span
                        key={label}
                        className="p-1 text-center text-xs text-muted-foreground"
                    >
                        {label}
                    </span>
                ))}

                {days.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayEvents = eventsByDay.get(key) ?? [];
                    return (
                        <div
                            key={key}
                            className={cn(
                                "flex min-h-24 flex-col gap-1 rounded-md p-1 ring-1 ring-card-border",
                                !isSameMonth(day, month) && "opacity-50",
                                // Dagens dato markeres med en ring i
                                // primærfargen. `bg-accent` er grå i begge
                                // temaer og forsvant i rutenettet.
                                isToday(day) && "ring-2 ring-primary",
                            )}
                        >
                            <span
                                className={cn(
                                    "text-xs text-muted-foreground",
                                    isToday(day) && "font-medium text-primary",
                                )}
                            >
                                {format(day, "d")}
                            </span>
                            {/* Sju kolonner gir ~45px per dag på mobil, og da
                                er tittelen uleselig uansett. Under `sm` blir
                                hvert arrangement en prikk som viser at dagen
                                har noe; tittelen kommer tilbake når det er
                                plass til den. */}
                            <div className="flex flex-wrap gap-1 sm:flex-col sm:flex-nowrap">
                                {dayEvents.map((event) => (
                                    <Badge
                                        key={event.id}
                                        className="size-1.5 min-w-0 justify-start p-0 sm:h-5 sm:w-full sm:px-2"
                                        title={event.title}
                                        aria-label={event.title}
                                        render={
                                            <Link
                                                to="/arrangementer/$slug"
                                                params={{ slug: event.slug }}
                                            />
                                        }
                                    >
                                        <span className="hidden truncate sm:inline">
                                            {event.title}
                                        </span>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {events.some((event) =>
                days.some((day) => isSameDay(new Date(event.startTime), day)),
            ) ? null : (
                <p className="text-sm text-muted-foreground">
                    Ingen arrangementer denne måneden.
                </p>
            )}
        </div>
    );
}
