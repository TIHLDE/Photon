import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";

import { avatarImageUrl } from "#/lib/assets";
import { initials } from "#/lib/utils";

export type PendingJoinRequest = {
    userId: string;
    name: string;
    username: string | null;
    image: string | null;
    groupSlug: string;
    groupName: string;
};

type AdminPendingJoinRequestsProps = {
    requests: PendingJoinRequest[];
    onApprove: (request: PendingJoinRequest) => void;
    onDecline: (request: PendingJoinRequest) => void;
    pendingKey?: string | null;
    error?: string | null;
};

export function pendingJoinRequestKey(request: PendingJoinRequest): string {
    return `${request.groupSlug}:${request.userId}`;
}

export function AdminPendingJoinRequests({
    requests,
    onApprove,
    onDecline,
    pendingKey,
    error,
}: AdminPendingJoinRequestsProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Venter på deg</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                <ul className="flex flex-col divide-y">
                    {requests.map((request) => {
                        const key = pendingJoinRequestKey(request);
                        return (
                            <li
                                key={key}
                                className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <Avatar size="sm">
                                        {request.image ? (
                                            <AvatarImage
                                                src={avatarImageUrl(
                                                    request.image,
                                                )}
                                                alt=""
                                            />
                                        ) : null}
                                        <AvatarFallback>
                                            {initials(request.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm">
                                        <Link
                                            to="/profil/$id"
                                            params={{
                                                id:
                                                    request.username ??
                                                    request.userId,
                                            }}
                                            className="underline underline-offset-4"
                                        >
                                            {request.name}
                                        </Link>{" "}
                                        vil bli med i{" "}
                                        <Link
                                            to="/grupper/$slug"
                                            params={{ slug: request.groupSlug }}
                                            search={{ tab: "medlemmer" }}
                                            className="underline underline-offset-4"
                                        >
                                            {request.groupName}
                                        </Link>
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        disabled={pendingKey === key}
                                        onClick={() => onApprove(request)}
                                    >
                                        Godkjenn
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={pendingKey === key}
                                        onClick={() => onDecline(request)}
                                    >
                                        Avslå
                                    </Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
                {error ? (
                    <p className="text-sm text-destructive" role="alert">
                        {error}
                    </p>
                ) : null}
            </CardContent>
        </Card>
    );
}
