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

/** Det minste en velger trenger for å kunne sende en ID videre. */
export type ComboboxMember = {
    id: string;
    name: string;
};

type MemberMultiComboboxProps = {
    items: ComboboxMember[];
    value: ComboboxMember[];
    onValueChange: (next: ComboboxMember[]) => void;
    placeholder?: string;
};

/**
 * Velg flere medlemmer, og få dem tilbake med ID.
 *
 * `UserMultiCombobox` over jobber med navn som tekst. Det holder ikke når
 * valget skal sendes til API-et: to medlemmer kan hete det samme, og da er
 * det ikke mulig å se hvem av dem som ble valgt.
 */
export function MemberMultiCombobox({
    items,
    value,
    onValueChange,
    placeholder,
}: MemberMultiComboboxProps) {
    const anchor = useComboboxAnchor();
    return (
        <Combobox
            items={items}
            multiple
            value={value}
            onValueChange={onValueChange}
            itemToStringLabel={(item: ComboboxMember) => item.name}
            itemToStringValue={(item: ComboboxMember) => item.id}
            isItemEqualToValue={(a: ComboboxMember, b: ComboboxMember) =>
                a.id === b.id
            }
        >
            <ComboboxChips ref={anchor}>
                <ComboboxValue>
                    {(selected: ComboboxMember[]) => (
                        <>
                            {selected.map((member) => (
                                <ComboboxChip key={member.id}>
                                    {member.name}
                                </ComboboxChip>
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
                        {(item: ComboboxMember) => (
                            <ComboboxItem key={item.id} value={item}>
                                {item.name}
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
