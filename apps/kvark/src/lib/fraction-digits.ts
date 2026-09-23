/**
 * Desimaler i teksten etter at `inserted` er satt inn over utvalget.
 *
 * Både komma og punktum teller som desimalskille: tallfeltene godtar begge,
 * og det siste av dem er det som blir desimaltegnet.
 */
export function fractionDigitsAfterInsert(
    value: string,
    selectionStart: number,
    selectionEnd: number,
    inserted: string,
): number {
    const next =
        value.slice(0, selectionStart) + inserted + value.slice(selectionEnd);
    const separator = Math.max(next.lastIndexOf(","), next.lastIndexOf("."));
    if (separator === -1) return 0;
    return next.slice(separator + 1).replace(/\D/g, "").length;
}

/** Teksten som blir igjen når desimalene over grensa er kuttet bort. */
export function truncateToFractionDigits(
    value: string,
    selectionStart: number,
    selectionEnd: number,
    inserted: string,
    maxFractionDigits: number,
): string {
    let allowed = inserted;
    while (
        allowed.length > 0 &&
        fractionDigitsAfterInsert(
            value,
            selectionStart,
            selectionEnd,
            allowed,
        ) > maxFractionDigits
    ) {
        allowed = allowed.slice(0, -1);
    }
    return allowed;
}

function insertedTextOf(event: InputEvent): string {
    if (event.data != null) return event.data;
    return event.dataTransfer?.getData("text") ?? "";
}

/**
 * Hindrer at det skrives flere desimaler enn feltet kan vise. Uten dette blir
 * et tredje siffer tatt imot og avrundet bort først når feltet forlates, og da
 * står det et annet beløp enn det som ble tastet.
 */
export function limitFractionDigits(
    input: HTMLInputElement,
    maxFractionDigits: number,
): () => void {
    const onBeforeInput = (event: Event) => {
        const inputEvent = event as InputEvent;
        if (!inputEvent.inputType?.startsWith("insert")) return;

        const inserted = insertedTextOf(inputEvent);
        if (!inserted) return;

        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const allowed = truncateToFractionDigits(
            input.value,
            start,
            end,
            inserted,
            maxFractionDigits,
        );
        if (allowed === inserted) return;

        // Hele innsettingen avvises, og det som får plass settes inn i stedet:
        // en innliming av «491,305» skal gi 491,30, ikke ingenting.
        event.preventDefault();
        if (allowed === "") return;
        input.setRangeText(allowed, start, end, "end");
        input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    // Base UI avviser paste-hendelsen og setter inn teksten selv, så den når
    // aldri `beforeinput`. Uten dette står «491,305» i feltet mens verdien er
    // 491,31.
    const onPaste = (event: Event) => {
        const pasteEvent = event as ClipboardEvent;
        const pasted = pasteEvent.clipboardData?.getData("text") ?? "";
        if (!pasted) return;

        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const allowed = truncateToFractionDigits(
            input.value,
            start,
            end,
            pasted,
            maxFractionDigits,
        );
        if (allowed === pasted) return;

        event.preventDefault();
        event.stopPropagation();
        if (allowed === "") return;
        input.setRangeText(allowed, start, end, "end");
        input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    input.addEventListener("beforeinput", onBeforeInput);
    input.addEventListener("paste", onPaste);
    return () => {
        input.removeEventListener("beforeinput", onBeforeInput);
        input.removeEventListener("paste", onPaste);
    };
}
