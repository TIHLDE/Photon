import type { LucideIcon } from "lucide-react";

export type DetailMetaItem = {
    icon: LucideIcon;
    label: string;
    value: string;
};

type DetailMetaListProps = {
    items: DetailMetaItem[];
};

export function DetailMetaList({ items }: DetailMetaListProps) {
    return (
        <dl className="flex flex-col gap-3">
            {items.map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                    <item.icon className="mt-0.5 size-4 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <dt className="text-xs text-muted-foreground">
                            {item.label}
                        </dt>
                        <dd className="truncate">{item.value}</dd>
                    </div>
                </div>
            ))}
        </dl>
    );
}
