import type { ApplicationOptions } from "#/api/queries/applications";

export type GroupOption = ApplicationOptions["groups"][number];
export type CcOption = ApplicationOptions["ccOptions"][number];

/** Contact fields prefilled from the signed-in user. */
export type DefaultContact = {
    name: string;
    email: string;
};

export type SubmitHelpers = {
    reset: () => void;
};

/**
 * Format a picked date as "YYYY-MM-DD" using local calendar fields.
 *
 * `toISOString()` would shift the date backwards for anyone east of UTC —
 * exactly the bug the old portal worked around by hand.
 */
export function toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
