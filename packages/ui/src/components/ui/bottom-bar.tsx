import { useRender } from "@base-ui/react/use-render";
import * as React from "react";

import { cn } from "#/lib/utils";

function BottomBar({ className, ...props }: React.ComponentProps<"nav">) {
    return (
        <nav
            data-slot="bottom-bar"
            className={cn(
                // `pb-safe` keeps the row clear of the iOS home indicator, which
                // otherwise sits right on top of the labels.
                "fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-background/70",
                className,
            )}
            {...props}
        />
    );
}

type BottomBarItemProps = React.ComponentProps<"button"> & {
    render?: useRender.RenderProp;
};

function BottomBarItem({ className, render, ...props }: BottomBarItemProps) {
    return useRender({
        render: render ?? <button type="button" />,
        props: {
            "data-slot": "bottom-bar-item",
            className: cn(
                // TanStack Router marks the matching link with data-status=active;
                // anything else (the menu button) simply never gets the attribute.
                "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[0.6875rem] font-medium text-muted-foreground outline-none transition-colors select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[status=active]:text-foreground [&_svg]:size-5 [&_svg]:shrink-0",
                className,
            ),
            ...props,
        },
    });
}

export { BottomBar, BottomBarItem };
