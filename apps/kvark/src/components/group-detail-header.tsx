import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Archive,
    ArchiveRestore,
    Crown,
    HandCoins,
    LogOut,
    Mail,
} from "lucide-react";
import { useState } from "react";

import { ConfirmDeleteDialog } from "#/components/confirm-delete-dialog";

import { DetailHeader } from "#/components/detail-layout";
import {
    GroupEditDialog,
    type GroupEditValues,
} from "#/components/group-edit-dialog";
import { GroupJoinDialog } from "#/components/group-join-dialog";
import type { ComboboxMember } from "#/components/user-combobox";
import type { Group } from "#/lib/group";
import { initials } from "#/lib/utils";

import { avatarImageUrl } from "#/lib/assets";

type GroupDetailHeaderProps = {
    group: Group;
    isAdmin: boolean;
    canArchive: boolean;
    onArchive: () => void;
    onUnarchive: () => void;
    isArchivePending?: boolean;
    /**
     * Om den innloggede kan gi bot. Lepton lot ethvert gruppemedlem bøtelegge
     * et annet, og det er regelen igjen: medlemskap er tilgangen.
     */
    canGiveFine: boolean;
    onGiveFine: () => void;
    /** Medlemmene botsjefen kan velges blant i redigeringsdialogen. */
    members: ComboboxMember[];
    onSaveGroup: (values: GroupEditValues) => Promise<boolean>;
    isSavingGroup?: boolean;
    saveGroupError?: string | null;
    /** Om knappen for å be om å bli med i gruppa skal vises. */
    canRequestJoin: boolean;
    /** Navnet til den innloggede, som e-posten om å bli med signeres med. */
    viewerName?: string;
    /** Om den innloggede kan melde seg ut av gruppa på egen hånd. */
    canLeave: boolean;
    onLeave: () => void;
    isLeavePending?: boolean;
};

export function GroupDetailHeader({
    group,
    isAdmin,
    canArchive,
    onArchive,
    onUnarchive,
    isArchivePending,
    canGiveFine,
    onGiveFine,
    members,
    onSaveGroup,
    isSavingGroup,
    saveGroupError,
    canRequestJoin,
    viewerName,
    canLeave,
    onLeave,
    isLeavePending,
}: GroupDetailHeaderProps) {
    const [confirmArchive, setConfirmArchive] = useState(false);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const isArchived = Boolean(group.archivedAt);
    const showRestore = canArchive && isArchived;
    const showArchive = canArchive && !isArchived && Boolean(group.archivable);

    return (
        <DetailHeader
            // Fast størrelse, ikke `h-full`: bildet har en egen høyde som
            // blåser opp raden headeren strekker seg etter, så avataren ble
            // merkbart større idet et bilde ble lagt til.
            avatar={
                <Avatar className="size-16 shrink-0 md:size-24">
                    {group.logoUrl ? (
                        <AvatarImage
                            src={avatarImageUrl(group.logoUrl)}
                            alt={group.name}
                        />
                    ) : null}
                    <AvatarFallback textSize="2xl">
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
                /* Lederen og kontakt-e-posten står under hverandre, ikke side
                   om side: begge er lange nok til at de sammen presset seg
                   forbi tittelen og så ut som én ordløs rad (issue #670). */
                <div className="flex flex-col items-start gap-2">
                    {isArchived ? (
                        <Badge variant="outline" className="gap-1.5">
                            <Archive />
                            Arkivert
                        </Badge>
                    ) : null}
                    {group.leader ? (
                        <Badge
                            variant="secondary"
                            className="hidden gap-1.5 md:flex"
                        >
                            <Crown />
                            <span className="font-medium">
                                {group.leaderTitle ?? "Leder"}
                            </span>
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
                </div>
            }
            actions={
                canRequestJoin ||
                canLeave ||
                canGiveFine ||
                isAdmin ||
                showArchive ||
                showRestore ? (
                    <>
                        {canRequestJoin && group.contactEmail ? (
                            <GroupJoinDialog
                                groupName={group.name}
                                contactEmail={group.contactEmail}
                                senderName={viewerName}
                            />
                        ) : null}
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
                        {showRestore ? (
                            <Button
                                onClick={onUnarchive}
                                disabled={isArchivePending}
                            >
                                <ArchiveRestore />
                                Gjenopprett
                            </Button>
                        ) : null}
                        {showArchive ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirmArchive(true)}
                                    disabled={isArchivePending}
                                >
                                    <Archive />
                                    Arkiver
                                </Button>
                                <ConfirmDeleteDialog
                                    open={confirmArchive}
                                    onOpenChange={setConfirmArchive}
                                    title={`Arkivere «${group.name}»?`}
                                    description="Gruppen skjules for alle andre enn medlemmene og kan ikke endres. Den kan gjenopprettes senere."
                                    confirmLabel="Arkiver gruppe"
                                    onConfirm={() => {
                                        setConfirmArchive(false);
                                        onArchive();
                                    }}
                                    isPending={isArchivePending}
                                />
                            </>
                        ) : null}
                        {canLeave ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirmLeave(true)}
                                    disabled={isLeavePending}
                                >
                                    <LogOut />
                                    Forlat gruppen
                                </Button>
                                <ConfirmDeleteDialog
                                    open={confirmLeave}
                                    onOpenChange={setConfirmLeave}
                                    title={`Forlate «${group.name}»?`}
                                    description="Du mister tilgangen og vervene du har i gruppen. For å bli med igjen må en leder legge deg til."
                                    confirmLabel="Forlat gruppen"
                                    onConfirm={() => {
                                        setConfirmLeave(false);
                                        onLeave();
                                    }}
                                    isPending={isLeavePending}
                                />
                            </>
                        ) : null}
                    </>
                ) : null
            }
        />
    );
}
