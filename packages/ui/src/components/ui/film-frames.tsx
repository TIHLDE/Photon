import type * as React from "react";

import { cn } from "#/lib/utils";

type FilmFramesProps = Omit<React.ComponentProps<"div">, "children"> & {
    /** Frames on the roll. */
    total: number;
    /** Frames already shot; drawn filled, the rest dashed. */
    used: number;
};

/**
 * A disposable camera's roll as a row of frames: shot ones filled, free ones
 * dashed. Shows at a glance how much film is left.
 */
function FilmFrames({ total, used, className, ...props }: FilmFramesProps) {
    return (
        <div
            data-slot="film-frames"
            role="img"
            aria-label={`${used} av ${total} bilder brukt`}
            className={cn(
                "flex flex-wrap items-center justify-center gap-2",
                className,
            )}
            {...props}
        >
            {Array.from({ length: total }, (_, index) => (
                <span
                    key={index}
                    data-used={index < used || undefined}
                    className="h-12 w-9 rounded-md border-2 border-dashed border-muted-foreground/60 data-used:border-solid data-used:border-primary data-used:bg-primary"
                />
            ))}
        </div>
    );
}

export { FilmFrames };
