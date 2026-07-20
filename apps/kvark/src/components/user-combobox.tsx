import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxCollection,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
} from "@tihlde/ui/ui/combobox";

type UserMultiComboboxProps = {
    items: string[];
    value: string[];
    onValueChange: (next: string[]) => void;
    placeholder?: string;
};

export function UserMultiCombobox({
    items,
    value,
    onValueChange,
    placeholder,
}: UserMultiComboboxProps) {
    const anchor = useComboboxAnchor();
    return (
        <Combobox
            items={items}
            multiple
            value={value}
            onValueChange={onValueChange}
        >
            <ComboboxChips ref={anchor}>
                <ComboboxValue>
                    {(selected: string[]) => (
                        <>
                            {selected.map((name) => (
                                <ComboboxChip key={name}>{name}</ComboboxChip>
                            ))}
                            <ComboboxChipsInput placeholder={placeholder} />
                        </>
                    )}
                </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent anchor={anchor}>
                <ComboboxList>
                    <ComboboxEmpty>Ingen treff</ComboboxEmpty>
                    <ComboboxCollection>
                        {(item: string) => (
                            <ComboboxItem key={item} value={item}>
                                {item}
                            </ComboboxItem>
                        )}
                    </ComboboxCollection>
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

type UserSingleComboboxProps = {
    items: string[];
    value: string | null;
    onValueChange: (next: string | null) => void;
    placeholder?: string;
};

export function UserSingleCombobox({
    items,
    value,
    onValueChange,
    placeholder,
}: UserSingleComboboxProps) {
    return (
        <Combobox items={items} value={value} onValueChange={onValueChange}>
            <ComboboxInput placeholder={placeholder} />
            <ComboboxContent>
                <ComboboxList>
                    <ComboboxEmpty>Ingen treff</ComboboxEmpty>
                    <ComboboxCollection>
                        {(item: string) => (
                            <ComboboxItem key={item} value={item}>
                                {item}
                            </ComboboxItem>
                        )}
                    </ComboboxCollection>
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}
