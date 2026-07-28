import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import type { Group } from "@tihlde/sdk";

type AdminGroupPickerProps = {
    groups: Group[];
    value: string | null;
    onValueChange: (slug: string | null) => void;
    placeholder?: string;
    /**
     * When set, an extra entry with this label is shown at the top and selects
     * `null` — used by pages where "no group" means "everything" rather than
     * "nothing chosen yet".
     */
    allLabel?: string;
};

/** Sentinel for the "all"-entry — the Select needs a concrete value. */
const ALL_GROUPS = "__all__";

/**
 * Group selector used by admin sections that are scoped per group (members,
 * fines). Keeps the choice controlled by the parent route.
 */
export function AdminGroupPicker({
    groups,
    value,
    onValueChange,
    placeholder = "Velg gruppe",
    allLabel,
}: AdminGroupPickerProps) {
    const items = [
        ...(allLabel ? [{ value: ALL_GROUPS, label: allLabel }] : []),
        ...groups.map((group) => ({ value: group.slug, label: group.name })),
    ];

    return (
        <Select
            items={items}
            value={value ?? (allLabel ? ALL_GROUPS : "")}
            onValueChange={(next) =>
                onValueChange(!next || next === ALL_GROUPS ? null : next)
            }
        >
            <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                        {item.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
