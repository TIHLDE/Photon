/**
 * Display formatting for søknad values, matching what the PDF and the emails
 * show. The API returns raw numbers and "YYYY-MM-DD" strings.
 */

/**
 * 1250 → "1 250,00 kr" (non-breaking space, as nb-NO formats it).
 *
 * Keep this in sync with `formatNok` in the API's application labels — the
 * PDF and the emails must show the same amount as the web view.
 */
export function formatNok(amount: number): string {
    const formatted = new Intl.NumberFormat("nb-NO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
    return `${formatted} kr`;
}

/** "2026-07-20" → "20.07.2026". Returns the input unchanged if unparseable. */
export function formatIsoDate(isoDate: string): string {
    const [year, month, day] = isoDate.split("-");
    if (!year || !month || !day) return isoDate;
    return `${day}.${month}.${year}`;
}
