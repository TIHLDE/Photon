import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Button } from "@tihlde/ui/ui/button";
import { Card } from "@tihlde/ui/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@tihlde/ui/ui/empty";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { ChevronRight, X } from "lucide-react";
import { useState } from "react";

import { GroupFineDialog } from "#/components/group-fine-dialog";
import { GroupFineRow } from "#/components/group-fine-row";
import { GroupFineStatCard } from "#/components/group-fine-stat-card";
import { GroupPageHeader } from "#/components/group-page-header";
import { MarkdownView } from "@tihlde/ui/complex/markdown";
import { richRegistry } from "#/components/markdown/directives/presets";
import type { Fine, FineStatistics, FineStatus, FineUser } from "#/lib/group";
import { initials } from "#/lib/utils";

import { avatarImageUrl } from "#/lib/assets";

export type FineGrouping = "alle" | "per-medlem";
export type FineStatusFilter = FineStatus | "alle";

/**
 * Ett statusfilter, ikke to boolske.
 *
 * Gamle Kvark hadde «Godkjent»- og «Betalt»-filtre hver for seg fordi Lepton
 * lagret to uavhengige kolonner. Photon lagrer én status, så halvparten av de
 * gamle kombinasjonene («betalt, men ikke godkjent») finnes ikke — de sto der
 * bare og ga tomme lister.
 */
const STATUS_OPTIONS: Array<{ value: FineStatusFilter; label: string }> = [
    { value: "alle", label: "Alle bøter" },
    { value: "pending", label: "Ikke godkjent" },
    { value: "approved", label: "Godkjent, ikke betalt" },
    { value: "paid", label: "Betalt" },
    { value: "rejected", label: "Avvist" },
];

type GroupFinesTabProps = {
    /** Gruppa botene hører til. Bøtebilder hentes per gruppe og bot. */
    groupSlug: string;
    /** Botene som er lastet inn så langt for gjeldende filter. */
    fines: Fine[];
    /** Gruppens medlemmer med bøtesummen sin, for «Per medlem». */
    fineUsers: FineUser[];
    statistics?: FineStatistics;
    memberCount: number;
    /** Markdown om hvordan botsystemet praktiseres i gruppa. */
    finesInfo?: string;
    grouping: FineGrouping;
    onGroupingChange: (grouping: FineGrouping) => void;
    status: FineStatusFilter;
    onStatusChange: (status: FineStatusFilter) => void;
    /** Satt når listen er begrenset til én persons bøter. */
    selectedUserId?: string;
    selectedUserName?: string;
    onSelectUser: (userId: string | undefined) => void;
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
    /** Whether the viewer may approve, settle or delete the group's fines. */
    canManage: boolean;
    /**
     * Satt for den som har forlatt gruppen. Da er dette ikke gruppens botliste
     * lenger, men et oppslag i egne bøter: gruppens summer og medlemsoversikt
     * hører ikke hjemme her, og ingenting kan endres.
     */
    ownFinesOnly?: boolean;
    /** Den innloggede brukeren, som er den eneste som kan skrive forsvar. */
    currentUserId?: string;
    onApprove: (fine: Fine) => void;
    onMarkPaid: (fine: Fine) => void;
    onDelete: (fine: Fine) => void;
    onSaveDefense: (fine: Fine, defense: string) => void;
    onSettleAllForUser: (userId: string, status: "approved" | "paid") => void;
};

/**
 * «Per medlem» summerer bare de aktive bøtene — betalte og avviste er gjort
 * opp — så det ufiltrerte valget heter noe annet der enn i bøtelista, hvor
 * det faktisk viser alt.
 */
function statusLabel(
    option: { value: FineStatusFilter; label: string },
    grouping: FineGrouping,
): string {
    if (option.value === "alle" && grouping === "per-medlem") {
        return "Aktive bøter";
    }
    return option.label;
}

function perMember(value: number, memberCount: number): string {
    if (memberCount <= 0) return "0.0";
    return (value / memberCount).toFixed(1);
}

export function GroupFinesTab({
    groupSlug,
    fines,
    fineUsers,
    statistics,
    memberCount,
    finesInfo,
    grouping,
    onGroupingChange,
    status,
    onStatusChange,
    selectedUserId,
    selectedUserName,
    onSelectUser,
    hasMore,
    isLoadingMore,
    onLoadMore,
    canManage,
    ownFinesOnly = false,
    currentUserId,
    onApprove,
    onMarkPaid,
    onDelete,
    onSaveDefense,
    onSettleAllForUser,
}: GroupFinesTabProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const notApproved = statistics?.notApproved ?? 0;
    const approvedNotPaid = statistics?.approvedNotPaid ?? 0;
    const paid = statistics?.paid ?? 0;

    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader title={ownFinesOnly ? "Mine bøter" : "Bøter"} />

            {ownFinesOnly ? (
                <p className="text-sm text-muted-foreground">
                    Du er ikke lenger medlem av gruppen. Her står bøtene du fikk
                    og ga mens du var med.
                </p>
            ) : null}

            {/* Botreglene gjelder dem som er med. Har du gått ut, er de ikke
                lenger dine å følge. */}
            {finesInfo && !ownFinesOnly ? (
                <Card size="sm" className="p-4">
                    <MarkdownView registry={richRegistry} source={finesInfo} />
                </Card>
            ) : null}

            {/* Summene gjelder hele gruppa, ikke det som er filtrert fram —
                ellers ville «Betalt» falt til 0 så snart du så på ubetalte.
                De er gruppens regnskap, og vises ikke for den som har gått ut. */}
            {ownFinesOnly ? null : (
                <div className="grid gap-4 md:grid-cols-3">
                    <GroupFineStatCard
                        label="Ikke godkjent"
                        value={notApproved}
                        perMember={perMember(notApproved, memberCount)}
                    />
                    <GroupFineStatCard
                        label="Godkjent, ikke betalt"
                        value={approvedNotPaid}
                        perMember={perMember(approvedNotPaid, memberCount)}
                    />
                    <GroupFineStatCard
                        label="Betalt"
                        value={paid}
                        perMember={perMember(paid, memberCount)}
                    />
                </div>
            )}

            <div className="flex flex-col gap-3">
                <Tabs
                    value={grouping}
                    onValueChange={(v) => onGroupingChange(v as FineGrouping)}
                >
                    <div className="flex flex-wrap items-center gap-3">
                        {/* «Per medlem» er gruppens medlemsliste, og den står
                            ikke åpen for en som har gått ut. */}
                        {ownFinesOnly ? null : (
                            <TabsList>
                                <TabsTrigger value="alle">
                                    Alle bøter
                                </TabsTrigger>
                                <TabsTrigger value="per-medlem">
                                    Per medlem
                                </TabsTrigger>
                            </TabsList>
                        )}
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            <Select
                                value={status}
                                onValueChange={(v) =>
                                    onStatusChange(v as FineStatusFilter)
                                }
                            >
                                <SelectTrigger className="w-56">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {statusLabel(option, grouping)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </Tabs>

                {selectedUserId && grouping === "alle" ? (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            Viser bøter for {selectedUserName ?? "medlem"}
                        </span>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onSelectUser(undefined)}
                        >
                            <X />
                            Vis alle
                        </Button>
                    </div>
                ) : null}

                {grouping === "alle" ? (
                    <FineList
                        fines={fines}
                        onOpen={setOpenIndex}
                        hasMore={hasMore}
                        isLoadingMore={isLoadingMore}
                        onLoadMore={onLoadMore}
                    />
                ) : (
                    <FineUserList
                        users={fineUsers}
                        canManage={canManage}
                        onSelectUser={onSelectUser}
                        onSettleAllForUser={onSettleAllForUser}
                        hasMore={hasMore}
                        isLoadingMore={isLoadingMore}
                        onLoadMore={onLoadMore}
                    />
                )}
            </div>

            <GroupFineDialog
                groupSlug={groupSlug}
                fines={fines}
                openIndex={openIndex}
                onOpenChange={setOpenIndex}
                canManage={canManage && !ownFinesOnly}
                readOnly={ownFinesOnly}
                currentUserId={currentUserId}
                onApprove={onApprove}
                onMarkPaid={onMarkPaid}
                onDelete={onDelete}
                onSaveDefense={onSaveDefense}
            />
        </div>
    );
}

function LoadMore({
    hasMore,
    isLoadingMore,
    onLoadMore,
}: {
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
}) {
    if (!hasMore) return null;
    return (
        <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="self-center"
        >
            {isLoadingMore ? "Laster …" : "Last inn mer"}
        </Button>
    );
}

function FineList({
    fines,
    onOpen,
    hasMore,
    isLoadingMore,
    onLoadMore,
}: {
    fines: Fine[];
    onOpen: (index: number) => void;
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
}) {
    if (fines.length === 0) {
        return (
            <Empty>
                <EmptyTitle>Fant ingen bøter</EmptyTitle>
                <EmptyDescription>
                    Du finner kanskje bøter med en annen filtrering.
                </EmptyDescription>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
                {fines.map((fine, index) => (
                    <li key={fine.id}>
                        <GroupFineRow
                            fine={fine}
                            onOpen={() => onOpen(index)}
                        />
                    </li>
                ))}
            </ul>
            <LoadMore
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={onLoadMore}
            />
        </div>
    );
}

function FineUserList({
    users,
    canManage,
    onSelectUser,
    onSettleAllForUser,
    hasMore,
    isLoadingMore,
    onLoadMore,
}: {
    users: FineUser[];
    canManage: boolean;
    onSelectUser: (userId: string) => void;
    onSettleAllForUser: (userId: string, status: "approved" | "paid") => void;
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
}) {
    if (users.length === 0) {
        return (
            <Empty>
                <EmptyTitle>Ingen medlemmer</EmptyTitle>
                <EmptyDescription>
                    Gruppen har ingen medlemmer å vise bøter for.
                </EmptyDescription>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
                {users.map((user) => (
                    <li key={user.id}>
                        <Card
                            size="sm"
                            className="flex-row flex-wrap items-center gap-3 px-3 py-2"
                        >
                            <Avatar className="size-10">
                                {user.image ? (
                                    <AvatarImage
                                        src={avatarImageUrl(user.image)}
                                        alt={user.name}
                                    />
                                ) : null}
                                <AvatarFallback>
                                    {initials(user.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-medium">
                                    {user.name}
                                </span>
                                <span className="truncate text-sm text-muted-foreground">
                                    {user.finesAmount} bøter fordelt på{" "}
                                    {user.finesCount}{" "}
                                    {user.finesCount === 1
                                        ? "hendelse"
                                        : "hendelser"}
                                </span>
                            </div>
                            {canManage && user.finesCount > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            onSettleAllForUser(
                                                user.id,
                                                "approved",
                                            )
                                        }
                                    >
                                        Godkjenn alle
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            onSettleAllForUser(user.id, "paid")
                                        }
                                    >
                                        Betal alle
                                    </Button>
                                </div>
                            ) : null}
                            <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Vis bøtene til ${user.name}`}
                                onClick={() => onSelectUser(user.id)}
                            >
                                <ChevronRight />
                            </Button>
                        </Card>
                    </li>
                ))}
            </ul>
            <LoadMore
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={onLoadMore}
            />
        </div>
    );
}
