import { addMinutes, format, parse, parseISO } from "date-fns";
import { toDate } from "date-fns-tz";

/**
 * Pure helpers for the Møtetid availability grid. Ported from
 * time.tihlde.org (lib/time.ts + lib/event-timezone.ts). Keep in sync with
 * the server-side copies in apps/api/src/lib/motetid/.
 */

export const EVENT_TIMEZONE = "Europe/Oslo";

export type SlotStatus = "AVAILABLE" | "IF_NEEDED";

export type FillMode = SlotStatus;

export type CellVisual = "empty" | "green" | "yellow" | "red";

export type DragAction = "add_available" | "remove" | "add_if_needed";

/** All "HH:mm" slot starts in the [startTime, endTime) window. */
export function buildTimeSlots(
    startTime: string,
    endTime: string,
    duration = 30,
): string[] {
    const slots: string[] = [];
    let cursor = parse(startTime, "HH:mm", new Date());
    const end = parse(endTime, "HH:mm", new Date());

    while (cursor < end) {
        slots.push(format(cursor, "HH:mm"));
        cursor = addMinutes(cursor, duration);
    }

    return slots;
}

/** Sort ISO "YYYY-MM-DD" date strings chronologically. */
export function normalizeDates(dates: string[]): string[] {
    return [...dates].sort(
        (a, b) => parseISO(a).getTime() - parseISO(b).getTime(),
    );
}

/** UTC instant range a grid slot covers. */
export function slotRangeUtc(
    dateStr: string,
    timeStr: string,
    slotDurationMinutes: number,
    timeZone: string = EVENT_TIMEZONE,
): { start: Date; end: Date } {
    const normalized = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    const start = toDate(`${dateStr}T${normalized}`, { timeZone });
    const end = new Date(start.getTime() + slotDurationMinutes * 60 * 1000);
    return { start, end };
}

export function intervalsOverlap(
    aStart: Date,
    aEnd: Date,
    bStart: Date,
    bEnd: Date,
): boolean {
    return aStart < bEnd && bStart < aEnd;
}

/**
 * First / exclusive-end slot indices on `dateStr` that overlap the event
 * window (already UTC instants). Used to place calendar overlays.
 */
export function slotIndicesOverlappingEventOnDate(
    dateStr: string,
    eventStart: Date,
    eventEnd: Date,
    slots: string[],
    slotDurationMinutes: number,
    timeZone: string = EVENT_TIMEZONE,
): { startIdx: number; endIdxExclusive: number } | null {
    let startIdx = -1;
    let endIdxExclusive = 0;
    for (let i = 0; i < slots.length; i++) {
        const time = slots[i]!;
        const { start: slotStart, end: slotEnd } = slotRangeUtc(
            dateStr,
            time,
            slotDurationMinutes,
            timeZone,
        );
        if (intervalsOverlap(slotStart, slotEnd, eventStart, eventEnd)) {
            if (startIdx === -1) startIdx = i;
            endIdxExclusive = i + 1;
        }
    }
    if (startIdx === -1) return null;
    return { startIdx, endIdxExclusive };
}

/** Rectangular range of slot keys between two grid cells. */
export function getSlotKeysInRange(
    date1: string,
    time1: string,
    date2: string,
    time2: string,
    visibleDates: string[],
    slotTimes: string[],
): string[] {
    const d1 = visibleDates.indexOf(date1);
    const d2 = visibleDates.indexOf(date2);
    const t1 = slotTimes.indexOf(time1);
    const t2 = slotTimes.indexOf(time2);
    const minD = Math.min(d1, d2);
    const maxD = Math.max(d1, d2);
    const minT = Math.min(t1, t2);
    const maxT = Math.max(t1, t2);
    const keys: string[] = [];
    for (let d = minD; d <= maxD; d++) {
        for (let t = minT; t <= maxT; t++) {
            keys.push(`${visibleDates[d]}|${slotTimes[t]}`);
        }
    }
    return keys;
}

export function getCellVisual(
    key: string,
    selected: Record<string, SlotStatus>,
    isEditing: boolean,
): CellVisual {
    const s = selected[key];
    if (s === "AVAILABLE") return "green";
    if (s === "IF_NEEDED") return "yellow";
    if (isEditing) return "red";
    return "empty";
}

export function resolveDragAction(
    mode: FillMode,
    visual: CellVisual,
): DragAction | null {
    if (visual === "empty") return null;
    if (mode === "AVAILABLE") {
        return visual === "green" ? "remove" : "add_available";
    }
    return visual === "yellow" ? "remove" : "add_if_needed";
}

export function areSelectionsEqual(
    a: Record<string, SlotStatus>,
    b: Record<string, SlotStatus>,
): boolean {
    const aEntries = Object.entries(a);
    const bEntries = Object.entries(b);
    if (aEntries.length !== bEntries.length) return false;

    for (const [key, value] of aEntries) {
        if (b[key] !== value) return false;
    }
    return true;
}
