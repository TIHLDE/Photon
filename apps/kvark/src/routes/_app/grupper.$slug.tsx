import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
    DetailLayout,
    DetailLayoutContent,
    DetailLayoutNav,
} from "#/components/detail-layout";
import { GroupDetailHeader } from "#/components/group-detail-header";
import { GroupEventsTab } from "#/components/group-events-tab";
import { GroupFinesTab } from "#/components/group-fines-tab";
import { GroupFormsTab } from "#/components/group-forms-tab";
import { GroupGiveFineDialog } from "#/components/group-give-fine-dialog";
import { GroupLawsTab } from "#/components/group-laws-tab";
import { GroupMembersTab } from "#/components/group-members-tab";
import { GROUP_NAV_ITEMS, type GroupNavKey } from "#/components/group-nav";
import { GroupOmTab } from "#/components/group-om-tab";

import { GROUP, LAWS, USERS } from "./grupper.$slug.mock";

export const Route = createFileRoute("/_app/grupper/$slug")({
    component: GroupDetailPage,
});

function GroupDetailPage() {
    const [active, setActive] = useState<GroupNavKey>("om");
    const [fineDialogOpen, setFineDialogOpen] = useState(false);

    function openGiveFine() {
        setActive("boter");
        setFineDialogOpen(true);
    }

    return (
        <>
            <DetailLayout
                header={
                    <GroupDetailHeader
                        group={GROUP}
                        onGiveFine={openGiveFine}
                    />
                }
            >
                <DetailLayoutNav
                    sections={[GROUP_NAV_ITEMS]}
                    active={active}
                    onSelect={setActive}
                />

                <DetailLayoutContent>
                    {active === "om" ? <GroupOmTab /> : null}
                    {active === "medlemmer" ? <GroupMembersTab /> : null}
                    {active === "arrangementer" ? <GroupEventsTab /> : null}
                    {active === "boter" ? <GroupFinesTab /> : null}
                    {active === "lovverk" ? <GroupLawsTab /> : null}
                    {active === "sporreskjema" ? <GroupFormsTab /> : null}
                </DetailLayoutContent>
            </DetailLayout>

            <GroupGiveFineDialog
                open={fineDialogOpen}
                onOpenChange={setFineDialogOpen}
                users={USERS}
                laws={LAWS}
            />
        </>
    );
}
