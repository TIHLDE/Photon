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
    multi?: boolean;
    placeholder?: string;
    emptyMessage?: string;
    disabled?: boolean;
    getLabel?: (item: TItem) => string;
    isEqual?: (a: TItem, b: TItem) => boolean;
    renderItem?: (item: TItem) => React.ReactNode;
    renderChip?: (item: TItem) => React.ReactNode;
}

export function Combobox<TItem>({
    items,
    multi,
    placeholder,
    emptyMessage = "Ingen treff",
    disabled,
    getLabel,
    isEqual,
    renderItem,
    renderChip,
}: ComboboxProps<TItem>) {
    const field = useFieldContext<TItem | TItem[] | null>();
    const ctx = useField();
    const anchor = useComboboxAnchor();

    const labelOf = (item: TItem) => (getLabel ? getLabel(item) : String(item));

    return (
        <ComboboxRoot
            items={items as TItem[]}
            multiple={multi}
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
            {multi ? (
                <ComboboxChips ref={anchor}>
                    <ComboboxValue>
                        {(selected: TItem[]) => (
                            <>
                                {selected.map((item, index) => (
                                    <ComboboxChip key={index}>
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
            <ComboboxContent anchor={multi ? anchor : undefined}>
                <ComboboxList>
                    <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
                    <ComboboxCollection>
                        {(item: TItem) => (
                            <ComboboxItem key={labelOf(item)} value={item}>
                                {renderItem ? renderItem(item) : labelOf(item)}
                            </ComboboxItem>
                        )}
                    </ComboboxCollection>
                </ComboboxList>
            </ComboboxContent>
        </ComboboxRoot>
    );
}
