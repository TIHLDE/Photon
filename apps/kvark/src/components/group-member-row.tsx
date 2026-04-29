import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card } from "@tihlde/ui/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@tihlde/ui/ui/dropdown-menu";
import {
    ArrowUpCircle,
    Crown,
    MoreHorizontal,
    UserMinus,
    UserRound,
} from "lucide-react";

import { initials } from "#/lib/initials";
import type { Member } from "#/routes/_app/grupper.$slug.mock";

type GroupMemberRowProps = {
    member: Member;
    historic?: boolean;
    isLeader?: boolean;
};

export function GroupMemberRow({
    member,
    historic = false,
    isLeader = false,
}: GroupMemberRowProps) {
    return (
        <Card size="sm" className="flex-row items-center gap-1 py-2 pr-2 pl-3">
            <Link
                to="/profil/$id"
                params={{ id: member.name }}
                className="flex min-w-0 flex-1 items-center gap-3"
            >
                <Avatar className="size-10">
                    <AvatarFallback>{initials(member.name)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 truncate font-medium">
                        {member.name}
                        {isLeader ? (
                            <Badge variant="secondary" className="gap-1">
                                <Crown />
                                Leder
                            </Badge>
                        ) : null}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                        {member.joined} → {historic ? member.until : "nå"}
                        {historic && member.role ? ` · ${member.role}` : ""}
                    </span>
                </div>
            </Link>
            {!historic ? (
                <MemberRowMenu member={member} isLeader={isLeader} />
            ) : null}
        </Card>
    );
}

function MemberRowMenu({
    member,
    isLeader,
}: {
    member: Member;
    isLeader: boolean;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Handlinger for ${member.name}`}
                    >
                        <MoreHorizontal />
                    </Button>
                }
            />
            <DropdownMenuContent align="end" className="w-auto min-w-48">
                <DropdownMenuItem
                    render={
                        <Link to="/profil/$id" params={{ id: member.name }} />
                    }
                >
                    <UserRound />
                    Se profil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {!isLeader ? (
                    <DropdownMenuItem>
                        <ArrowUpCircle />
                        Promoter til leder
                    </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem variant="destructive">
                    <UserMinus />
                    Fjern medlem
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
