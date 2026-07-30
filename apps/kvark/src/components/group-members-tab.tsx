import { GroupAddMemberDialog } from "#/components/group-add-member-dialog";
import { GroupMemberRow } from "#/components/group-member-row";
import { GroupPageHeader } from "#/components/group-page-header";
import type { Member } from "#/lib/group";

type GroupMembersTabProps = {
    leader: Member | null;
    members: Member[];
    /** Leder eller groups:manage for gruppen — kan legge til og fjerne medlemmer. */
    isAdmin: boolean;
    /** Kun groups:manage — å utnevne en ny leder er ikke lederens eget kall. */
    canPromote: boolean;
    onPromote: (member: Member) => void;
    onRemove: (member: Member) => void;
};

export function GroupMembersTab({
    leader,
    members,
    isAdmin,
    canPromote,
    onPromote,
    onRemove,
}: GroupMembersTabProps) {
    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader
                title="Medlemmer"
                action={isAdmin ? <GroupAddMemberDialog users={[]} /> : null}
            />

            {leader ? (
                <div className="flex flex-col gap-2">
                    <h3 className="text-lg">Leder</h3>
                    <GroupMemberRow
                        member={leader}
                        isLeader
                        onRemove={isAdmin ? onRemove : undefined}
                    />
                </div>
            ) : null}

            <div className="flex flex-col gap-2">
                <h3 className="text-lg">Medlemmer ({members.length})</h3>
                <ul className="flex flex-col gap-2">
                    {members.map((m) => (
                        <li key={m.id}>
                            <GroupMemberRow
                                member={m}
                                onPromote={canPromote ? onPromote : undefined}
                                onRemove={isAdmin ? onRemove : undefined}
                            />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
