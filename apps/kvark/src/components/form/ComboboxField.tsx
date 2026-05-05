import { useFieldContext, useFieldErrorVisible } from "#/hooks/form";
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
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { useId } from "react";

interface BasicFieldPropBase {
    label?: string;
    required?: boolean;
    description?: string;
    hideError?: boolean;
}

interface ComboboxFieldProps<TItem> extends BasicFieldPropBase {
    items: TItem[];
    multi?: boolean;
    placeholder?: string;
    emptyMessage?: string;
    disabled?: boolean;
    getLabel?: (item: TItem) => string;
    getValue?: (item: TItem) => string;
    isEqual?: (a: TItem, b: TItem) => boolean;
    renderItem?: (item: TItem) => React.ReactNode;
    renderChip?: (item: TItem) => React.ReactNode;
}

export function ComboboxField<TItem>({
    label,
    required,
    description,
    hideError = false,
    items,
    multi,
    placeholder,
    emptyMessage = "Ingen treff",
    disabled,
    getLabel,
    getValue,
    isEqual,
    renderItem,
    renderChip,
}: ComboboxFieldProps<TItem>) {
    const field = useFieldContext<TItem | TItem[] | null>();
    const inputId = useId();
    const anchor = useComboboxAnchor();
    const isInvalid = useFieldErrorVisible();

    const labelOf = (item: TItem) => (getLabel ? getLabel(item) : String(item));

    return (
        <Field data-invalid={isInvalid}>
            {label && (
                <FieldLabel htmlFor={inputId}>
                    {label}{" "}
                    {required && <span className="text-destructive">*</span>}
                </FieldLabel>
            )}
            <Combobox
                items={items}
                multiple={multi}
                value={field.state.value as never}
                onValueChange={field.handleChange as never}
                onOpenChange={(open) => {
                    if (!open) field.handleBlur();
                }}
                disabled={disabled}
                autoHighlight
                itemToStringLabel={getLabel}
                itemToStringValue={getValue}
                isItemEqualToValue={isEqual}
            >
                {multi ? (
                    <ComboboxChips ref={anchor}>
                        <ComboboxValue>
                            {(selected: TItem[]) => (
                                <>
                                    {selected.map((item, index) => (
                                        <ComboboxChip
                                            key={
                                                getValue
                                                    ? getValue(item)
                                                    : index
                                            }
                                        >
                                            {renderChip
                                                ? renderChip(item)
                                                : labelOf(item)}
                                        </ComboboxChip>
                                    ))}
                                    <ComboboxChipsInput
                                        id={inputId}
                                        placeholder={placeholder}
                                        aria-invalid={isInvalid}
                                    />
                                </>
                            )}
                        </ComboboxValue>
                    </ComboboxChips>
                ) : (
                    <ComboboxInput
                        id={inputId}
                        placeholder={placeholder}
                        aria-invalid={isInvalid}
                    />
                )}
                <ComboboxContent anchor={multi ? anchor : undefined}>
                    <ComboboxList>
                        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
                        <ComboboxCollection>
                            {(item: TItem) => (
                                <ComboboxItem
                                    key={
                                        getValue
                                            ? getValue(item)
                                            : labelOf(item)
                                    }
                                    value={item}
                                >
                                    {renderItem
                                        ? renderItem(item)
                                        : labelOf(item)}
                                </ComboboxItem>
                            )}
                        </ComboboxCollection>
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
            {description && <FieldDescription>{description}</FieldDescription>}
            {!hideError && isInvalid && (
                <FieldError errors={field.state.meta.errors} />
            )}
        </Field>
    );
}
