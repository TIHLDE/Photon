import { Button } from "@tihlde/ui/ui/button";

import { GroupAddMemberDialog } from "#/components/group-add-member-dialog";
import { GroupMemberRow } from "#/components/group-member-row";
import { GroupPageHeader } from "#/components/group-page-header";
import { LEADER, MEMBER_HISTORY, MEMBERS, USERS } from "#/mock/group-detail";

export function GroupMembersTab() {
    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader
                title="Medlemmer"
                action={<GroupAddMemberDialog users={USERS} />}
            />

            <div className="flex flex-col gap-2">
                <h3 className="text-lg">Leder</h3>
                <GroupMemberRow member={LEADER} isLeader />
            </div>

            <div className="flex flex-col gap-2">
                <h3 className="text-lg">Medlemmer ({MEMBERS.length})</h3>
                <ul className="flex flex-col gap-2">
                    {MEMBERS.map((m) => (
                        <li key={m.name}>
                            <GroupMemberRow member={m} />
                        </li>
                    ))}
                </ul>
            </div>

            <h3 className="text-lg">Medlemshistorikk</h3>
            <ul className="flex flex-col gap-2">
                {MEMBER_HISTORY.map((m) => (
                    <li key={`${m.name}-${m.until ?? ""}`}>
                        <GroupMemberRow member={m} historic />
                    </li>
                ))}
            </ul>
            <div className="flex justify-center">
                <Button variant="outline">Last inn mer</Button>
            </div>
        </div>
    );
}
