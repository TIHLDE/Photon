import type { ReactNode } from "react";

type GroupPageHeaderProps = {
    title: string;
    action?: ReactNode;
};

export function GroupPageHeader({ title, action }: GroupPageHeaderProps) {
    return (
        <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl">{title}</h2>
            {action}
        </div>
    );
}
