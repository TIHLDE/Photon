import {
    Combobox,
    ComboboxCollection,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@tihlde/ui/ui/combobox";

import type { Law } from "#/lib/group";

type LawComboboxProps = {
    items: Law[];
    value: Law | null;
    onValueChange: (next: Law | null) => void;
};

export function LawCombobox({ items, value, onValueChange }: LawComboboxProps) {
    return (
        <Combobox
            items={items}
            value={value}
            onValueChange={onValueChange}
            itemToStringLabel={(item: Law) =>
                `${item.paragraph} - ${item.title}`
            }
            itemToStringValue={(item: Law) => item.paragraph}
            isItemEqualToValue={(a: Law, b: Law) => a.paragraph === b.paragraph}
        >
            <ComboboxInput placeholder="Velg paragraf..." />
            <ComboboxContent>
                <ComboboxList>
                    <ComboboxEmpty>Ingen treff</ComboboxEmpty>
                    <ComboboxCollection>
                        {(item: Law) => (
                            <ComboboxItem key={item.paragraph} value={item}>
                                <span className="flex flex-1 items-baseline justify-between gap-3">
                                    <span className="min-w-0 flex-1 wrap-anywhere">
                                        {item.paragraph} - {item.title}
                                    </span>
                                    {/* Se GroupLawItem: 0 bøter betyr
                                        overskrift/forklaring, ikke «null
                                        bøter». */}
                                    {item.amount > 0 ? (
                                        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                                            {item.amount} bøter
                                        </span>
                                    ) : null}
                                </span>
                            </ComboboxItem>
                        )}
                    </ComboboxCollection>
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}
