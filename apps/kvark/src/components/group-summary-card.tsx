import { Link } from "@tanstack/react-router";

import {
    GroupIdentity,
    type GroupIdentityProps,
} from "#/components/group-identity";
import { groupHref } from "#/lib/utils";

export type GroupSummaryCardProps = GroupIdentityProps;

export function GroupSummaryCard(props: GroupSummaryCardProps) {
    return (
        <Link
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
            to={groupHref(props.name)}
        >
            <GroupIdentity {...props} />
        </Link>
    );
}
