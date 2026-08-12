import type { ReactNode } from "react";

type GroupPageHeaderProps = {
    title: string;
    action?: ReactNode;
};

export function GroupPageHeader({ title, action }: GroupPageHeaderProps) {
    return (
        // Wrapper på smale skjermer: uten det krymper tittelen til den
        // brekker midt i ordet for å gi plass til handlingsknappene.
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl">{title}</h2>
            {action}
        </div>
    );
}
