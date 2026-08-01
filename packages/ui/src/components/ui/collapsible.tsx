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
            // library: the panel transitions its own height between 0 and the
            // measured `--collapsible-panel-height`, so the reveal reads as a
            // smooth roll rather than a pop.
            className="h-(--collapsible-panel-height) overflow-hidden text-sm transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0"
            {...props}
        >
            <div className={cn(className)}>{children}</div>
        </CollapsiblePrimitive.Panel>
    );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
