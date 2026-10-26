import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
    approveJoinRequestMutation,
    declineJoinRequestMutation,
    getGroupJoinRequestsQuery,
} from "#/api/queries/groups";
import {
    GroupJoinRequests,
    type GroupJoinRequest,
} from "#/components/group-join-requests";
import { extractErrorMessage } from "#/lib/api-error";

export function GroupJoinRequestsPanel({
    groupSlug,
    enabled = true,
}: {
    groupSlug: string;
    enabled?: boolean;
}) {
    const { data } = useQuery({
        ...getGroupJoinRequestsQuery(groupSlug),
        enabled,
    });
    const approve = useMutation(approveJoinRequestMutation);
    const decline = useMutation(declineJoinRequestMutation);
    const [pendingUserId, setPendingUserId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function answer(
        mutation: typeof approve | typeof decline,
        request: GroupJoinRequest,
    ) {
        setError(null);
        setPendingUserId(request.userId);
        try {
            await mutation.mutateAsync({ groupSlug, userId: request.userId });
        } catch (err) {
            setError(await extractErrorMessage(err));
        } finally {
            setPendingUserId(null);
        }
    }

    return (
        <GroupJoinRequests
            requests={(data ?? []).map((request) => ({
                userId: request.userId,
                name: request.user.name,
                username: request.user.username,
                image: request.user.image,
            }))}
            onApprove={(request) => answer(approve, request)}
            onDecline={(request) => answer(decline, request)}
            pendingUserId={pendingUserId}
            error={error}
        />
    );
}
