import { EventCard } from "#/components/event-card";
import { GroupPageHeader } from "#/components/group-page-header";
import { EVENTS } from "#/mock/group-detail";

export function GroupEventsTab() {
    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader title="Arrangementer" />
            <ul className="flex flex-col gap-3">
                {EVENTS.map((event) => (
                    // TODO: replace with a unique id field once wired up to the backend
                    <li key={event.title}>
                        <EventCard {...event} />
                    </li>
                ))}
            </ul>
        </div>
    );
}
