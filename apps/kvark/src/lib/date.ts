import { addHours, startOfHour } from "date-fns";

/**
 * Neste hele time strengt etter `from` (f.eks. 14:23 -> 15:00, 15:00 -> 16:00).
 * Nyttig som standardverdi for starttidspunkt, som gjerne ligger på en hel time.
 */
export function nextWholeHour(from: Date = new Date()): Date {
    return startOfHour(addHours(from, 1));
}
