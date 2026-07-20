type CalendarEvent = {
    title: string;
    start: { iso: string };
    end: { iso: string };
    location: string;
};

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: event.title,
        dates: `${toIcsUtc(event.start.iso)}/${toIcsUtc(event.end.iso)}`,
        location: event.location,
    });
    return `https://www.google.com/calendar/render?${params.toString()}`;
}

function toIcsUtc(iso: string): string {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) {
        throw new Error(`Invalid ISO date: ${iso}`);
    }
    return new Date(ms)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
}
