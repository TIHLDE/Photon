import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";

import { cn } from "#/lib/utils";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
    return (
        <AccordionPrimitive.Root
            data-slot="accordion"
            className={cn("flex w-full flex-col", className)}
            {...props}
        />
    );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
    return (
        <AccordionPrimitive.Item
            data-slot="accordion-item"
            className={cn("not-last:border-b", className)}
            {...props}
        />
    );
}

function AccordionTrigger({
    className,
    children,
    ...props
}: AccordionPrimitive.Trigger.Props) {
    return (
        <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger
                data-slot="accordion-trigger"
                className={cn(
                    "group/accordion-trigger relative flex flex-1 cursor-pointer items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-[color,border-color,box-shadow] outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground",
                    className,
                )}
                {...props}
            >
                {children}
                <ChevronDownIcon
                    data-slot="accordion-trigger-icon"
                    className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
                />
                <ChevronUpIcon
                    data-slot="accordion-trigger-icon"
                    className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
                />
            </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
    );
}

function AccordionContent({
    className,
    children,
    ...props
}: AccordionPrimitive.Panel.Props) {
    return (
        <AccordionPrimitive.Panel
            data-slot="accordion-content"
            // The panel itself carries the height so it can transition between
            // 0 and its measured size. Base UI publishes that size as
            // `--accordion-panel-height` and flags the open/close boundary with
            // data-starting-style / data-ending-style — the two frames where
            // height must read 0 for the roll to have somewhere to travel.
            // (tw-animate-css's accordion keyframes are Radix-shaped and
            // resolve to `height: auto` here, which cannot interpolate.)
            className="h-(--accordion-panel-height) overflow-hidden text-sm transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0"
            {...props}
        >
            <div
                // Link styling is scoped to prose: a link sitting in a
                // paragraph needs the underline to be findable mid-sentence,
                // while a panel used as a list of links (a nav menu, a set of
                // shortcuts) should look like the links around it, not like
                // running text.
                className={cn(
                    "pt-0 pb-2.5 [&_p_a]:underline [&_p_a]:underline-offset-3 [&_p_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
                    className,
                )}
            >
                {children}
            </div>
        </AccordionPrimitive.Panel>
    );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
