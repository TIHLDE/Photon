/**
 * Display formatting for søknad values, matching what the PDF and the emails
 * show. The API returns raw numbers and "YYYY-MM-DD" strings.
 */

/** 1250 → "1 250 kr" (non-breaking space, as nb-NO formats it). */
export function formatNok(amount: number): string {
    return `${new Intl.NumberFormat("nb-NO").format(amount)} kr`;
}

/** "2026-07-20" → "20.07.2026". Returns the input unchanged if unparseable. */
export function formatIsoDate(isoDate: string): string {
    const [year, month, day] = isoDate.split("-");
    if (!year || !month || !day) return isoDate;
    return `${day}.${month}.${year}`;
}
