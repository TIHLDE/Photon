import { useFieldContext } from "#/hooks/form";
import {
    Combobox as ComboboxRoot,
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
import { useField } from "./field";

interface ComboboxProps<TItem> {
    items: readonly TItem[];
    multiple?: boolean;
    placeholder?: string;
    emptyMessage?: string;
    disabled?: boolean;
    getLabel?: (item: TItem) => string;
    getKey?: (item: TItem, index: number) => string | number;
    isEqual?: (a: TItem, b: TItem) => boolean;
    renderItem?: (item: TItem) => React.ReactNode;
    renderChip?: (item: TItem) => React.ReactNode;
}

export function Combobox<TItem>({
    items,
    multiple,
    placeholder,
    emptyMessage = "Ingen treff",
    disabled,
    getLabel,
    getKey,
    isEqual,
    renderItem,
    renderChip,
}: ComboboxProps<TItem>) {
    const field = useFieldContext<TItem | TItem[] | null>();
    const ctx = useField();
    const anchor = useComboboxAnchor();

    const labelOf = (item: TItem) => (getLabel ? getLabel(item) : String(item));
    const keyOf = (item: TItem, index: number) =>
        getKey ? getKey(item, index) : index;

    return (
        <ComboboxRoot
            items={items as TItem[]}
            multiple={multiple}
            value={field.state.value as never}
            onValueChange={field.handleChange as never}
            onOpenChange={(open) => {
                if (!open) field.handleBlur();
            }}
            disabled={disabled}
            autoHighlight
            itemToStringLabel={getLabel}
            isItemEqualToValue={isEqual}
        >
            {multiple ? (
                <ComboboxChips ref={anchor}>
                    <ComboboxValue>
                        {(selected: TItem[]) => (
                            <>
                                {selected.map((item, index) => (
                                    <ComboboxChip key={keyOf(item, index)}>
                                        {renderChip
                                            ? renderChip(item)
                                            : labelOf(item)}
                                    </ComboboxChip>
                                ))}
                                <ComboboxChipsInput
                                    id={ctx.inputId}
                                    placeholder={placeholder}
                                    aria-invalid={ctx.isInvalid}
                                />
                            </>
                        )}
                    </ComboboxValue>
                </ComboboxChips>
            ) : (
                <ComboboxInput
                    id={ctx.inputId}
                    placeholder={placeholder}
                    aria-invalid={ctx.isInvalid}
                />
            )}
            <ComboboxContent anchor={multiple ? anchor : undefined}>
                <ComboboxList>
                    <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
                    <ComboboxCollection>
                        {(item: TItem) => {
                            const items_ = items as TItem[];
                            const index = items_.indexOf(item);
                            return (
                                <ComboboxItem
                                    key={keyOf(item, index)}
                                    value={item}
                                >
                                    {renderItem
                                        ? renderItem(item)
                                        : labelOf(item)}
                                </ComboboxItem>
                            );
                        }}
                    </ComboboxCollection>
                </ComboboxList>
            </ComboboxContent>
        </ComboboxRoot>
    );
}
