import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Crown, HandCoins, Mail } from "lucide-react";

import { DetailHeader } from "#/components/detail-layout";
import {
    GroupEditDialog,
    type GroupEditValues,
} from "#/components/group-edit-dialog";
import type { ComboboxMember } from "#/components/user-combobox";
import type { Group } from "#/lib/group";
import { initials } from "#/lib/utils";

import { avatarImageUrl } from "#/lib/assets";

type GroupDetailHeaderProps = {
    group: Group;
    isAdmin: boolean;
    /**
     * Om den innloggede kan gi bot. Lepton lot ethvert gruppemedlem bøtelegge
     * et annet, og det er regelen igjen: medlemskap er tilgangen.
     */
    canGiveFine: boolean;
    onGiveFine: () => void;
    /** Medlemmene botsjefen kan velges blant i redigeringsdialogen. */
    members: ComboboxMember[];
    onSaveGroup: (values: GroupEditValues) => void;
    isSavingGroup?: boolean;
    saveGroupError?: string | null;
};

export function GroupDetailHeader({
    group,
    isAdmin,
    canGiveFine,
    onGiveFine,
    members,
    onSaveGroup,
    isSavingGroup,
    saveGroupError,
}: GroupDetailHeaderProps) {
    return (
        <DetailHeader
            avatar={
                <Avatar className="size-16 shrink-0 md:row-span-3 md:aspect-square md:h-full md:max-h-32 md:w-auto">
                    {group.logoUrl ? (
                        <AvatarImage
                            src={avatarImageUrl(group.logoUrl)}
                            alt={group.name}
                        />
                    ) : null}
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
                canGiveFine || isAdmin ? (
                    <>
                        {canGiveFine ? (
                            <Button onClick={onGiveFine}>
                                <HandCoins />
                                Gi bot
                            </Button>
                        ) : null}
                        {isAdmin ? (
                            <GroupEditDialog
                                group={group}
                                members={members}
                                onSubmit={onSaveGroup}
                                isSubmitting={isSavingGroup}
                                error={saveGroupError}
                            />
                        ) : null}
                    </>
                ) : null
            }
        />
    );
}
