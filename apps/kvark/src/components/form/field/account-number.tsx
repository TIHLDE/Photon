import { useFieldContext } from "#/hooks/form";
import { Input as InputPrimitive } from "@tihlde/ui/ui/input";
import { useLayoutEffect, useRef } from "react";
import { useField } from "./field";

/** Et norsk kontonummer er elleve siffer, skrevet xxxx.xx.xxxxx. */
const ACCOUNT_NUMBER_DIGITS = 11;
const GROUPS = [4, 6] as const;

function countDigits(value: string): number {
    return value.replace(/\D/g, "").length;
}

/**
 * Alt som ikke er siffer forkastes, og punktumene settes inn på nytt ut fra
 * hvor mange siffer som faktisk er skrevet. Da spiller det ingen rolle om
 * medlemmet skriver, limer inn «1234.56.78901», «1234 56 78901» eller bare
 * elleve siffer — det som havner i skjemaet er alltid formatet API-et krever.
 */
export function formatAccountNumber(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, ACCOUNT_NUMBER_DIGITS);
    return [
        digits.slice(0, GROUPS[0]),
        digits.slice(GROUPS[0], GROUPS[1]),
        digits.slice(GROUPS[1]),
    ]
        .filter((group) => group.length > 0)
        .join(".");
}

/** Posisjonen rett etter siffer nummer `digits` i en ferdig formatert verdi. */
function caretAfterDigit(value: string, digits: number): number {
    if (digits <= 0) return 0;

    let seen = 0;
    for (let i = 0; i < value.length; i++) {
        if (!/\d/.test(value[i] as string)) continue;
        seen++;
        if (seen === digits) return i + 1;
    }
    return value.length;
}

type AccountNumberProps = Omit<
    React.ComponentProps<"input">,
    "value" | "required" | "type"
>;

/**
 * Kontonummer som formaterer seg selv mens man skriver: punktumene kommer av
 * seg selv, og siffer nummer tolv kommer aldri inn. Skjemaverdien er hele
 * tiden den formaterte teksten, siden det er den formen API-et validerer.
 */
export function AccountNumber({
    onChange,
    onKeyDown,
    ...props
}: AccountNumberProps) {
    const field = useFieldContext<string>();
    const ctx = useField();
    const inputRef = useRef<HTMLInputElement>(null);
    // React skriver den formaterte verdien tilbake i inputen først ved neste
    // render. Uten at markøren flyttes etterpå hopper den til slutten hver
    // gang et punktum settes inn — altså midt i et kontonummer.
    const caretRef = useRef<number | null>(null);

    useLayoutEffect(() => {
        const caret = caretRef.current;
        caretRef.current = null;
        if (caret === null) return;
        inputRef.current?.setSelectionRange(caret, caret);
    });

    function commit(next: string, digitsBeforeCaret: number) {
        caretRef.current = caretAfterDigit(next, digitsBeforeCaret);
        field.handleChange(next);
    }

    return (
        <InputPrimitive
            {...props}
            ref={inputRef}
            id={ctx.inputId}
            name={field.name}
            required={ctx.required}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={field.state.value}
            onChange={(e) => {
                onChange?.(e);
                if (e.defaultPrevented) return;

                const caret = e.target.selectionStart ?? e.target.value.length;
                commit(
                    formatAccountNumber(e.target.value),
                    countDigits(e.target.value.slice(0, caret)),
                );
            }}
            onKeyDown={(e) => {
                onKeyDown?.(e);
                if (e.defaultPrevented) return;

                // Backspace rett bak et punktum ville ellers slette skilletegnet
                // og få det satt inn igjen med det samme — tastetrykket ser ut
                // som om det ikke gjorde noe. Slett sifferet foran i stedet.
                const el = e.currentTarget;
                const caret = el.selectionStart ?? 0;
                if (
                    e.key !== "Backspace" ||
                    caret !== el.selectionEnd ||
                    caret < 2 ||
                    el.value[caret - 1] !== "."
                ) {
                    return;
                }

                e.preventDefault();
                const kept = el.value.slice(0, caret - 2);
                commit(
                    formatAccountNumber(kept + el.value.slice(caret)),
                    countDigits(kept),
                );
            }}
            onBlur={field.handleBlur}
            aria-invalid={ctx.isInvalid}
        />
    );
}
