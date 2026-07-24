import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

import { cn } from "#/lib/utils";

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
    return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
    return (
        <CollapsiblePrimitive.Trigger
            data-slot="collapsible-trigger"
            {...props}
        />
    );
}

function CollapsibleContent({
    className,
    children,
    ...props
}: CollapsiblePrimitive.Panel.Props) {
    return (
        <CollapsiblePrimitive.Panel
            data-slot="collapsible-content"
            // Mirror the accordion so expand/collapse feels identical across the
            // library: tw-animate-css drives the height keyframe, and the inner
            // wrapper carries the measured panel height (0 at the open/close
            // boundary) so the reveal reads as a smooth roll rather than a pop.
            className="overflow-hidden text-sm data-open:animate-collapsible-down data-closed:animate-collapsible-up"
            {...props}
        >
            <div
                className={cn(
                    "h-(--collapsible-panel-height) data-ending-style:h-0 data-starting-style:h-0",
                    className,
                )}
            >
                {children}
            </div>
        </CollapsiblePrimitive.Panel>
    );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
