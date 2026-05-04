import { Badge } from "@tihlde/ui/ui/badge";
import { FilterX, X } from "lucide-react";

export type FilterPill = {
    key: string;
    label: string;
    clear: () => void;
};

type FilterPillRowProps = {
    pills: FilterPill[];
    onClearAll: () => void;
};

export function FilterPillRow({ pills, onClearAll }: FilterPillRowProps) {
    if (pills.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {pills.map((p) => (
                <Badge
                    key={p.key}
                    variant="secondary"
                    render={
                        <button
                            type="button"
                            onClick={p.clear}
                            aria-label={`Fjern ${p.label}`}
                        />
                    }
                >
                    {p.label}
                    <X />
                </Badge>
            ))}
            <Badge
                variant="outline"
                render={
                    <button
                        type="button"
                        onClick={onClearAll}
                        aria-label="Fjern alle filtre"
                    />
                }
            >
                <FilterX />
            </Badge>
        </div>
    );
}
