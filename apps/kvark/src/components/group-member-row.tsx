import { Link } from "@tanstack/react-router";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@tihlde/ui/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
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
import { useState } from "react";

import { initials } from "#/lib/utils";
import type { Member } from "#/lib/group";

type GroupMemberRowProps = {
    member: Member;
    historic?: boolean;
    isLeader?: boolean;
    /** Promoting to leader requires `groups:manage` — leadership alone is not enough. */
    onPromote?: (member: Member) => void;
    onRemove?: (member: Member) => void;
};

export function GroupMemberRow({
    member,
    historic = false,
    isLeader = false,
    onPromote,
    onRemove,
}: GroupMemberRowProps) {
    // The whole row already links to the profile, so a menu with nothing but
    // "Se profil" is noise — drop it entirely when the viewer has no actions.
    const hasActions = Boolean(onPromote) || Boolean(onRemove);

    return (
        <Card size="sm" className="flex-row items-center gap-1 py-2 pr-2 pl-3">
            <Link
                to="/profil/$id"
                params={{ id: member.id }}
                className="flex min-w-0 flex-1 items-center gap-3"
            >
                <Avatar className="size-10">
                    {member.image ? (
                        <AvatarImage src={member.image} alt={member.name} />
                    ) : null}
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
            {!historic && hasActions ? (
                <MemberRowMenu
                    member={member}
                    isLeader={isLeader}
                    onPromote={onPromote}
                    onRemove={onRemove}
                />
            ) : null}
        </Card>
    );
}

function MemberRowMenu({
    member,
    isLeader,
    onPromote,
    onRemove,
}: {
    member: Member;
    isLeader: boolean;
    onPromote?: (member: Member) => void;
    onRemove?: (member: Member) => void;
}) {
    const [confirmRemove, setConfirmRemove] = useState(false);

    return (
        <>
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
                            <Link to="/profil/$id" params={{ id: member.id }} />
                        }
                    >
                        <UserRound />
                        Se profil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {onPromote && !isLeader ? (
                        <DropdownMenuItem onClick={() => onPromote(member)}>
                            <ArrowUpCircle />
                            Promoter til leder
                        </DropdownMenuItem>
                    ) : null}
                    {onRemove ? (
                        <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setConfirmRemove(true)}
                        >
                            <UserMinus />
                            Fjern medlem
                        </DropdownMenuItem>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Fjern {member.name} fra gruppen?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Medlemskapet slettes. Du kan legge personen inn
                            igjen senere.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel variant="outline" size="default">
                            Avbryt
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => onRemove?.(member)}
                        >
                            Fjern medlem
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
