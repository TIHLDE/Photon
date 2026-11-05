import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { GroupOmTab } from "#/components/group-om-tab";
import { useGroupDetail } from "./-context";
import { GROUP_TAB_ROUTES } from "./-navigation";

const legacyTabSchema = z.enum([
    "om",
    "medlemmer",
    "arrangementer",
    "boter",
    "lovverk",
    "sporreskjema",
]);

export const Route = createFileRoute("/_app/grupper/$slug/")({
    beforeLoad: ({ location, params }) => {
        const search = new URLSearchParams(location.searchStr);
        const tab = legacyTabSchema.safeParse(search.get("tab"));
        if (!tab.success) return;
        search.delete("tab");
        throw redirect({
            to: GROUP_TAB_ROUTES[tab.data],
            params,
            hash: location.hash,
            search: Object.fromEntries(search),
            replace: true,
        });
    },
    component: GroupOverviewPage,
});

function GroupOverviewPage() {
    const { group } = useGroupDetail();
    return <GroupOmTab group={group} />;
}
