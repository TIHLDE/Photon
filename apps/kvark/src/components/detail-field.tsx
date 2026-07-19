import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type DetailFieldProps = {
    icon?: LucideIcon;
    label?: ReactNode;
    value: ReactNode;
    action?: ReactNode;
};

export function DetailField({
    icon: Icon,
    label,
    value,
    action,
}: DetailFieldProps) {
    if (label) {
        return (
            <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2.5 text-muted-foreground">
                    {Icon ? <Icon className="size-4 shrink-0" /> : null}
                    <span className="truncate">{label}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span className="text-right break-words">{value}</span>
                    {action}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-start gap-2.5">
                {Icon ? (
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : null}
                <span className="break-words">{value}</span>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}
