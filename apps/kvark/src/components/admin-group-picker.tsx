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
};

/**
 * Group selector used by admin sections that are scoped per group (members,
 * fines). Keeps the choice controlled by the parent route.
 */
export function AdminGroupPicker({
    groups,
    value,
    onValueChange,
    placeholder = "Velg gruppe",
}: AdminGroupPickerProps) {
    return (
        <Select
            items={groups.map((group) => ({
                value: group.slug,
                label: group.name,
            }))}
            value={value ?? ""}
            onValueChange={(next) => onValueChange(next || null)}
        >
            <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {groups.map((group) => (
                    <SelectItem key={group.slug} value={group.slug}>
                        {group.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
