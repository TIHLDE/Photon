import { Link } from "@tanstack/react-router";
import { Alert, AlertTitle } from "@tihlde/ui/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Button } from "@tihlde/ui/ui/button";
import { UserPlus } from "lucide-react";

import { avatarImageUrl } from "#/lib/assets";
import { initials } from "#/lib/utils";

export type GroupJoinRequest = {
    userId: string;
    name: string;
    username: string | null;
    image: string | null;
};

type GroupJoinRequestsProps = {
    requests: GroupJoinRequest[];
    onApprove: (request: GroupJoinRequest) => void;
    onDecline: (request: GroupJoinRequest) => void;
    /** Den som behandles nå; knappene hennes er låst til svaret er der. */
    pendingUserId?: string | null;
    error?: string | null;
};

export function GroupJoinRequests({
    requests,
    onApprove,
    onDecline,
    pendingUserId,
    error,
}: GroupJoinRequestsProps) {
    if (requests.length === 0) return null;

    return (
        <Alert>
            <UserPlus />
            <AlertTitle>
                {requests.length === 1
                    ? "1 vil bli med i gruppen"
                    : `${requests.length} vil bli med i gruppen`}
            </AlertTitle>
            <ul className="col-span-2 flex flex-col gap-2 pt-2">
                {requests.map((request) => (
                    <li
                        key={request.userId}
                        className="flex flex-wrap items-center justify-between gap-2"
                    >
                        <Link
                            to="/profil/$id"
                            params={{ id: request.username ?? request.userId }}
                            className="flex items-center gap-2 hover:underline"
                        >
                            <Avatar size="sm">
                                {request.image ? (
                                    <AvatarImage
                                        src={avatarImageUrl(request.image)}
                                        alt=""
                                    />
                                ) : null}
                                <AvatarFallback>
                                    {initials(request.name)}
                                </AvatarFallback>
                            </Avatar>
                            <span>{request.name}</span>
                        </Link>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                disabled={pendingUserId === request.userId}
                                onClick={() => onApprove(request)}
                            >
                                Godkjenn
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={pendingUserId === request.userId}
                                onClick={() => onDecline(request)}
                            >
                                Avslå
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>
            {error ? (
                <p className="col-span-2 pt-2 text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
        </Alert>
    );
}
