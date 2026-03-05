import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import { nb } from "date-fns/locale";

function toDate(input: string | Date): Date {
    if (input instanceof Date) return input;
    const d = parseISO(input);
    return isValid(d) ? d : new Date(input);
}

export function formatDate(input: string | Date): string {
    return format(toDate(input), "d. MMMM yyyy", { locale: nb });
}

export function formatDateTime(input: string | Date): string {
    return format(toDate(input), "d. MMMM yyyy, HH:mm", { locale: nb });
}

export function formatRelative(input: string | Date): string {
    return formatDistanceToNow(toDate(input), { addSuffix: true, locale: nb });
}

export function formatDateRange(
    start: string | Date,
    end: string | Date,
): string {
    const s = toDate(start);
    const e = toDate(end);
    const sameDay =
        s.getFullYear() === e.getFullYear() &&
        s.getMonth() === e.getMonth() &&
        s.getDate() === e.getDate();

    if (sameDay) {
        return `${format(s, "d. MMMM yyyy, HH:mm", { locale: nb })} - ${format(e, "HH:mm")}`;
    }
    return `${format(s, "d. MMM HH:mm", { locale: nb })} - ${format(e, "d. MMM HH:mm", { locale: nb })}`;
}
