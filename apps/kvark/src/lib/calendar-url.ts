type CalendarEvent = {
    title: string;
    startsAtIso: string;
    endsAtIso: string;
    location: string;
};

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: event.title,
        dates: `${formatIcs(event.startsAtIso)}/${formatIcs(event.endsAtIso)}`,
        location: event.location,
    });
    return `https://www.google.com/calendar/render?${params.toString()}`;
}

function formatIcs(iso: string): string {
    return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
