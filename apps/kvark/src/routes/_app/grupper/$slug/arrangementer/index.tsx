import { createFileRoute } from "@tanstack/react-router";

import { GroupEventsTab } from "#/components/group-events-tab";
import { useScopedPermission } from "#/hooks/use-permission";

import { useGroupDetail } from "../-context";

/** Module-level so the permission lookup keeps a stable identity. */
const EVENT_CREATE_PERMISSIONS = ["events:create", "events:manage"] as const;
export const Route = createFileRoute("/_app/grupper/$slug/arrangementer/")({
    component: GroupEventsPage,
});

function GroupEventsPage() {
    const { slug, isArchived } = useGroupDetail();

    // Arrangementer er scopet på samme måte: lederskap alene gir ikke
    // events:create — det avhenger av gruppens leaderPermissions — så vi
    // spør om selve tilgangen for nettopp denne gruppen.
    const canCreateEvent =
        useScopedPermission(EVENT_CREATE_PERMISSIONS, `group:${slug}`) &&
        !isArchived;

    return <GroupEventsTab slug={slug} canCreateEvent={canCreateEvent} />;
}
