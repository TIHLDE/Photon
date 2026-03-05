import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

type EmptyStateProps = {
    icon?: LucideIcon;
    title: string;
    description?: string;
    className?: string;
    children?: React.ReactNode;
};

export function EmptyState({
    icon: Icon,
    title,
    description,
    className,
    children,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-3 py-12 text-center",
                className,
            )}
        >
            {Icon && <Icon className="size-12 text-muted-foreground" />}
            <div className="space-y-1">
                <h3 className="text-lg font-medium">{title}</h3>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {children}
        </div>
    );
}
