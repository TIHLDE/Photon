import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Label } from "@tihlde/ui/ui/label";
import { Text } from "@tihlde/ui/ui/text";
import type { ReactNode } from "react";

type FilterCheckboxOptionProps = {
    title: ReactNode;
    description?: ReactNode;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
};

export function FilterCheckboxOption({
    title,
    description,
    checked,
    onCheckedChange,
}: FilterCheckboxOptionProps) {
    return (
        <Label className="flex items-start gap-3 py-1">
            <Checkbox
                className="shrink-0"
                checked={checked}
                onCheckedChange={(c) => onCheckedChange(c === true)}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
                <span>{title}</span>
                {description ? (
                    <Text render={<span />} size="xs" tone="muted">
                        {description}
                    </Text>
                ) : null}
            </span>
        </Label>
    );
}
