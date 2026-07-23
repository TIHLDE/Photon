import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "#/lib/utils";

/**
 * Visual primitives for the "Møtetid" availability board (when2meet-style
 * heatmap grid). All colour decisions for the grid live here; the board's
 * state machine lives in the kvark app.
 */

const IF_NEEDED_STRIPES =
    "repeating-linear-gradient(135deg, rgba(234,179,8,0.55), rgba(234,179,8,0.55) 4px, transparent 4px, transparent 8px)";

const CALENDAR_STRIPES =
    "repeating-linear-gradient(135deg, rgba(190,18,60,0.12), rgba(190,18,60,0.12) 3px, transparent 3px, transparent 7px)";

const motetidCellVariants = cva(
    "relative z-0 block h-full w-full min-w-0 border-b border-r border-border p-0 leading-none",
    {
        variants: {
            visual: {
                empty: "bg-muted/80 hover:bg-muted",
                available: "bg-green-700 hover:bg-green-800",
                ifNeeded: "bg-yellow-400 hover:bg-yellow-500",
                editingEmpty: "bg-red-300 hover:bg-red-200",
                paintAvailable: "bg-green-300",
                paintIfNeeded: "bg-yellow-400",
                paintRemove: "bg-red-300",
                "heat-0": "bg-muted/80 hover:bg-muted",
                "heat-1": "bg-green-300 hover:bg-green-400",
                "heat-2": "bg-green-400 hover:bg-green-500",
                "heat-3": "bg-green-500 hover:bg-green-600",
                "heat-4": "bg-green-600 hover:bg-green-700",
                "heat-5": "bg-green-700 hover:bg-green-800",
                "heat-6": "bg-green-800 hover:bg-green-900",
            },
            interactive: {
                true: "cursor-pointer",
                false: "cursor-default",
            },
            firstColumn: {
                true: "border-l",
                false: "",
            },
        },
        defaultVariants: {
            visual: "empty",
            interactive: false,
            firstColumn: false,
        },
    },
);

type MotetidCellProps = React.ComponentProps<"button"> &
    VariantProps<typeof motetidCellVariants> & {
        /** Dashed rose overlay marking a Google Calendar conflict. */
        calendarBlocked?: boolean;
        /** Diagonal stripe overlay marking an "if needed" selection. */
        ifNeededOverlay?: boolean;
    };

function MotetidCell({
    className,
    visual,
    interactive,
    firstColumn,
    calendarBlocked,
    ifNeededOverlay,
    children,
    ...props
}: MotetidCellProps) {
    return (
        <button
            type="button"
            data-slot="motetid-cell"
            className={cn(
                motetidCellVariants({ visual, interactive, firstColumn }),
                className,
            )}
            {...props}
        >
            {calendarBlocked ? (
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-[2] rounded-[1px] border border-dashed border-rose-700/45 dark:border-rose-300/35"
                    style={{ backgroundImage: CALENDAR_STRIPES }}
                />
            ) : null}
            {ifNeededOverlay ? (
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-[3] opacity-40"
                    style={{ backgroundImage: IF_NEEDED_STRIPES }}
                />
            ) : null}
            {children}
        </button>
    );
}

/** Column/row header cell for the grid (dates and the "Tid" corner). */
function MotetidGridHeadCell({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="motetid-grid-head-cell"
            className={cn("border border-border bg-muted p-1", className)}
            {...props}
        />
    );
}

/** Left-hand time label cell. */
function MotetidTimeCell({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="motetid-time-cell"
            className={cn(
                "flex items-start border-b border-r border-border bg-muted px-1.5 py-0.5 text-xs leading-none text-muted-foreground",
                className,
            )}
            {...props}
        />
    );
}

/** Overlay block showing a Google Calendar event on top of the grid. */
function MotetidCalendarOverlayBlock({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="motetid-calendar-overlay"
            className={cn(
                "pointer-events-none min-w-0 overflow-hidden rounded-sm border border-dashed border-rose-700/40 bg-rose-950/10 px-0.5 py-0.5 text-left text-[10px] leading-tight text-rose-950/90 dark:border-rose-400/35 dark:bg-rose-950/30 dark:text-rose-50/90",
                className,
            )}
            {...props}
        />
    );
}

/** Fill-mode toggle: "Tilgjengelig" (green) / "Om nødvendig" (yellow). */
function MotetidModeToggle({
    mode,
    onModeChange,
    disabled,
}: {
    mode: "AVAILABLE" | "IF_NEEDED";
    onModeChange: (mode: "AVAILABLE" | "IF_NEEDED") => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex w-full rounded-lg border border-border bg-muted/60 p-0.5">
            <button
                type="button"
                onClick={() => onModeChange("AVAILABLE")}
                disabled={disabled}
                aria-pressed={mode === "AVAILABLE"}
                className={cn(
                    "flex min-w-0 flex-1 items-center justify-center rounded-md px-2 py-2 text-center text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    mode === "AVAILABLE"
                        ? "bg-green-700 text-white hover:bg-green-800"
                        : "bg-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
            >
                Tilgjengelig
            </button>
            <button
                type="button"
                onClick={() => onModeChange("IF_NEEDED")}
                disabled={disabled}
                aria-pressed={mode === "IF_NEEDED"}
                className={cn(
                    "relative flex min-w-0 flex-1 items-center justify-center rounded-md px-2 py-2 text-center text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    mode === "IF_NEEDED"
                        ? "bg-yellow-400 text-yellow-950 hover:bg-yellow-500"
                        : "bg-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
            >
                {mode === "IF_NEEDED" ? (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-md opacity-40"
                        style={{ backgroundImage: IF_NEEDED_STRIPES }}
                    />
                ) : null}
                <span className="relative z-1">Om nødvendig</span>
            </button>
        </div>
    );
}

/** "Færre → Flest" green gradient legend for the heatmap. */
function MotetidHeatLegend({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="motetid-heat-legend"
            className={cn(
                "flex items-center gap-2 text-[10px] text-muted-foreground",
                className,
            )}
            {...props}
        >
            <span>Færre</span>
            <span className="flex h-2 flex-1 overflow-hidden rounded-full">
                <span className="flex-1 bg-green-300" />
                <span className="flex-1 bg-green-400" />
                <span className="flex-1 bg-green-500" />
                <span className="flex-1 bg-green-600" />
                <span className="flex-1 bg-green-700" />
                <span className="flex-1 bg-green-800" />
            </span>
            <span>Flest</span>
        </div>
    );
}

const motetidCalendarDayVariants = cva(
    "flex h-11 w-full items-center justify-center rounded text-sm transition-colors sm:h-9",
    {
        variants: {
            state: {
                past: "cursor-not-allowed text-muted-foreground/50",
                selected:
                    "cursor-pointer bg-primary font-semibold text-primary-foreground",
                today: "cursor-pointer font-bold text-foreground hover:bg-muted",
                default: "cursor-pointer text-foreground hover:bg-muted",
            },
        },
        defaultVariants: { state: "default" },
    },
);

type MotetidCalendarDayProps = React.ComponentProps<"button"> &
    VariantProps<typeof motetidCalendarDayVariants>;

/** Day cell for the drag-select date picker used when creating an event. */
function MotetidCalendarDay({
    className,
    state,
    ...props
}: MotetidCalendarDayProps) {
    return (
        <button
            type="button"
            data-slot="motetid-calendar-day"
            className={cn(motetidCalendarDayVariants({ state }), className)}
            {...props}
        />
    );
}

export {
    MotetidCell,
    MotetidGridHeadCell,
    MotetidTimeCell,
    MotetidCalendarOverlayBlock,
    MotetidModeToggle,
    MotetidHeatLegend,
    MotetidCalendarDay,
    motetidCellVariants,
};
export type { MotetidCellProps };
