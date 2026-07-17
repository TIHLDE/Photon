import { GroupPageHeader } from "#/components/group-page-header";

export function GroupEventsTab() {
    // The backend event list endpoint (GET /api/event) has no organizer/group
    // filter, so events cannot yet be scoped to a single group.
    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader title="Arrangementer" />
            <p className="text-sm text-muted-foreground">
                Ingen arrangementer å vise for denne gruppen ennå.
            </p>
        </div>
    );
}
