import { Reveal } from "@tihlde/ui/ui/motion";
import { Text } from "@tihlde/ui/ui/text";
import type { ReactNode } from "react";

type PageHeaderProps = {
    title: string;
    description?: ReactNode;
    action?: ReactNode;
};

/**
 * Shared header for the public list pages: a title, an optional supporting
 * description, and an optional action slot (usually a create button) aligned
 * to the end.
 *
 * Mirrors `AdminPageHeader`, but keeps the `Reveal` wrapper the public pages
 * animate their headers with.
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
    return (
        <Reveal
            render={
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" />
            }
        >
            <div className="flex flex-col gap-1">
                <Text render={<h1 />} size="3xl">
                    {title}
                </Text>
                {description && <Text tone="muted">{description}</Text>}
            </div>
            {action && <div className="flex shrink-0 gap-2">{action}</div>}
        </Reveal>
    );
}
