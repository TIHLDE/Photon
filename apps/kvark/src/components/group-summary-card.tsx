import {
    GroupIdentity,
    type GroupIdentityProps,
} from "#/components/group-identity";

export type GroupSummaryCardProps = GroupIdentityProps;

export function GroupSummaryCard(props: GroupSummaryCardProps) {
    return (
        <a
            href="#"
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
        >
            <GroupIdentity {...props} />
        </a>
    );
}
