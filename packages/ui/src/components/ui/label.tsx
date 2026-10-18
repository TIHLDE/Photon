import * as React from "react";

import { cn } from "#/lib/utils";

function Label({
    className,
    weight,
    ...props
}: React.ComponentProps<"label"> & { weight?: "normal" }) {
    return (
        <label
            data-slot="label"
            className={cn(
                "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                weight === "normal" && "font-normal",
                className,
            )}
            {...props}
        />
    );
}

export { Label };
