import { Avatar, AvatarFallback } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Crown, HandCoins, Mail } from "lucide-react";

import { DetailHeader } from "#/components/detail-layout";
import { GroupEditDialog } from "#/components/group-edit-dialog";
import type { Group } from "#/lib/group";
import { initials } from "#/lib/utils";

type GroupDetailHeaderProps = {
    group: Group;
    isAdmin: boolean;
    onGiveFine: () => void;
};

export function GroupDetailHeader({
    group,
    isAdmin,
    onGiveFine,
}: GroupDetailHeaderProps) {
    return (
        <DetailHeader
            avatar={
                <Avatar className="size-16 shrink-0 md:row-span-3 md:aspect-square md:h-full md:max-h-32 md:w-auto">
                    <AvatarFallback className="text-2xl">
                        {initials(group.name)}
                    </AvatarFallback>
                </Avatar>
            }
            title={
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl">{group.name}</h1>
                    <a
                        href={`mailto:${group.contactEmail}`}
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground md:hidden"
                    >
                        <Mail className="size-3.5" />
                        {group.contactEmail}
                    </a>
                </div>
            }
            subtitle={
                <p className="text-sm text-muted-foreground">
                    {group.description}
                </p>
            }
            badges={
                <>
                    {group.leader ? (
                        <Badge
                            variant="secondary"
                            className="hidden gap-1.5 md:flex"
                        >
                            <Crown />
                            <span className="font-medium">Leder</span>
                            <span className="text-muted-foreground">·</span>
                            {group.leader}
                        </Badge>
                    ) : null}
                    {group.contactEmail ? (
                        <Badge
                            variant="secondary"
                            className="hidden gap-1.5 md:flex"
                        >
                            <Mail />
                            {group.contactEmail}
                        </Badge>
                    ) : null}
                </>
            }
            actions={
                isAdmin ? (
                    <>
                        {group.finesActivated ? (
                            <Button onClick={onGiveFine}>
                                <HandCoins />
                                Gi bot
                            </Button>
                        ) : null}
                        <GroupEditDialog group={group} />
                    </>
                ) : null
            }
        />
    );
}
