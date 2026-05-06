import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";

export type DetailDatePoint = {
    date: string;
    time?: string;
};

type DetailDateRangeProps = {
    start: DetailDatePoint;
    end?: DetailDatePoint;
    action?: ReactNode;
};

export function DetailDateRange({ start, end, action }: DetailDateRangeProps) {
    const isMultiDay = end && end.date !== start.date;

    return (
        <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-8 shrink-0 items-center">
                    <CalendarDays className="size-4 text-muted-foreground" />
                </div>
                {isMultiDay ? (
                    <MultiDay start={start} end={end} />
                ) : (
                    <SingleDay start={start} end={end} />
                )}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}

function SingleDay({
    start,
    end,
}: {
    start: DetailDatePoint;
    end?: DetailDatePoint;
}) {
    return (
        <div className="flex h-8 min-w-0 flex-col justify-center gap-0.5">
            <span>{start.date}</span>
            {start.time ? (
                <span className="text-sm text-muted-foreground">
                    {end?.time
                        ? `kl. ${start.time} → kl. ${end.time}`
                        : `kl. ${start.time}`}
                </span>
            ) : null}
        </div>
    );
}

function MultiDay({
    start,
    end,
}: {
    start: DetailDatePoint;
    end: DetailDatePoint;
}) {
    return (
        <div className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3">
            <Marker />
            <span className="self-center leading-6">{start.date}</span>

            <Connector />
            <span className="text-sm text-muted-foreground">
                {start.time ? `kl. ${start.time}` : null}
            </span>
            <div className="h-2 col-span-2" />

            <Marker />
            <span className="self-center leading-6">{end.date}</span>

            {end.time ? (
                <span className="col-start-2 text-sm text-muted-foreground">
                    kl. {end.time}
                </span>
            ) : null}
        </div>
    );
}

function Marker() {
    return (
        <div className="relative z-10 flex h-6 items-center justify-center">
            <div className="size-2 rounded-full bg-foreground" />
        </div>
    );
}

function Connector() {
    return (
        <div className="row-span-2 -my-3 flex justify-center">
            <div className="w-px self-stretch bg-border" />
        </div>
    );
}
