/** Hvor lenge før kameraet stenger utkastene begynner å mase. */
const DRAFT_WARNING_MS = 30 * 60 * 1000;

/**
 * Når varselet om usendte bilder slår inn. Utkast som ikke er sendt inn når
 * kameraet stenger, slettes, så den siste halvtimen sier vi fra.
 */
export function draftWarningStartsAt(closesAt: string): string {
    return new Date(
        new Date(closesAt).getTime() - DRAFT_WARNING_MS,
    ).toISOString();
}

export function isDraftWarning(
    closesAt: string,
    draftCount: number,
    now: Date,
): boolean {
    return (
        draftCount > 0 &&
        now.getTime() >= new Date(closesAt).getTime() - DRAFT_WARNING_MS &&
        now.getTime() < new Date(closesAt).getTime()
    );
}
