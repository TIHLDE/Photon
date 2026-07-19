import type { ReactNode } from "react";

type AdminPageHeaderProps = {
    title: string;
    description?: ReactNode;
    action?: ReactNode;
};

/**
 * Shared header for admin pages: a title, an optional supporting description,
 * and an optional action slot (usually a primary button) aligned to the end.
 */
export function AdminPageHeader({
    title,
    description,
    action,
}: AdminPageHeaderProps) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">{title}</h1>
                {description && (
                    <p className="text-muted-foreground">{description}</p>
                )}
            </div>
            {action && <div className="flex shrink-0 gap-2">{action}</div>}
        </div>
    );
}
