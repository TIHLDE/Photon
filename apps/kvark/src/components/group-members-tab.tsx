import { Button } from "@tihlde/ui/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@tihlde/ui/ui/collapsible";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { GroupAddMemberDialogProps } from "#/components/group-add-member-dialog";
import { GroupAddMemberDialog } from "#/components/group-add-member-dialog";
import { GroupMemberRow } from "#/components/group-member-row";
import { GroupPageHeader } from "#/components/group-page-header";
import { formatInOslo } from "#/lib/date";
import { formatSubmissionStudy } from "#/lib/form";
import type { Member } from "#/lib/group";
import { cn } from "#/lib/utils";

export type JoinRequest = {
    id: string;
    name: string;
    message: string;
    createdAt: string;
    user: {
        email: string;
        studyProgram: string | null;
        classYear: number | null;
    };
};

type GroupMembersTabProps = {
    /**
     * Normalt én. Skulle det ligge igjen flere ledere i databasen, vises alle
     * — ellers forsvinner de ekstra fra siden og kan ikke fjernes derfra.
     */
    leaders: Member[];
    members: Member[];
    /** Avsluttede medlemskap. Tom liste skjuler seksjonen helt. */
    formerMembers: Member[];
    /** Leder eller groups:manage for gruppen — kan legge til og fjerne medlemmer. */
    isAdmin: boolean;
    /** Leder eller groups:manage — lederen kan gi vervet videre selv. */
    canPromote: boolean;
    /** Søk og innsending for «Legg til medlem»; eies av ruten. */
    memberSearch: GroupAddMemberDialogProps;
    /**
     * Søk og innsending for «Overfør lederverv». Settes bare for grupper som
     * kan hente lederen utenfra (HS) — ellers går overføringen gjennom
     * medlemslista, og en egen søkedialog ville bare vært en omvei.
     */
    leaderTransfer?: GroupAddMemberDialogProps;
    onPromote: (member: Member) => void;
    onRemove: (member: Member) => void;
    joinRequests: JoinRequest[];
    onHandleJoinRequest: (
        request: JoinRequest,
        status: "approved" | "rejected",
    ) => void;
};

export function GroupMembersTab({
    leaders,
    members,
    formerMembers,
    isAdmin,
    canPromote,
    memberSearch,
    leaderTransfer,
    onPromote,
    onRemove,
    joinRequests,
    onHandleJoinRequest,
}: GroupMembersTabProps) {
    const [showFormer, setShowFormer] = useState(false);

    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader
                title={`Medlemmer (${leaders.length + members.length})`}
                action={
                    <div className="flex flex-wrap items-center gap-2">
                        {leaderTransfer ? (
                            <GroupAddMemberDialog {...leaderTransfer} />
                        ) : null}
                        {isAdmin ? (
                            <GroupAddMemberDialog {...memberSearch} />
                        ) : null}
                    </div>
                }
            />

            {isAdmin && joinRequests.length > 0 ? (
                <div className="flex flex-col gap-2">
                    <h3 className="text-lg">
                        Søknader ({joinRequests.length})
                    </h3>
                    <Table className="min-w-max">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Navn</TableHead>
                                <TableHead>Sendt inn</TableHead>
                                <TableHead className="max-w-xs whitespace-normal">
                                    Søknadstekst
                                </TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {joinRequests.map((request) => {
                                const study = formatSubmissionStudy(
                                    request.user.studyProgram,
                                    request.user.classYear,
                                );
                                return (
                                    <TableRow key={request.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{request.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {request.user.email}
                                                </span>
                                                {study ? (
                                                    <span className="text-xs text-muted-foreground">
                                                        {study}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {formatInOslo(
                                                request.createdAt,
                                                "d. MMM yyyy",
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-xs whitespace-normal">
                                            {request.message}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={() =>
                                                        onHandleJoinRequest(
                                                            request,
                                                            "approved",
                                                        )
                                                    }
                                                >
                                                    Legg til i interessegruppen
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        onHandleJoinRequest(
                                                            request,
                                                            "rejected",
                                                        )
                                                    }
                                                >
                                                    Avvis dette medlemmet
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            ) : null}

            {/* Lederen ligger øverst i samme liste som resten — badgen skiller den ut. */}
            <ul className="flex flex-col gap-2">
                {leaders.map((m) => (
                    <li key={m.id}>
                        <GroupMemberRow
                            member={m}
                            isLeader
                            onRemove={isAdmin ? onRemove : undefined}
                        />
                    </li>
                ))}
                {members.map((m) => (
                    <li key={m.id}>
                        <GroupMemberRow
                            member={m}
                            onPromote={canPromote ? onPromote : undefined}
                            onRemove={isAdmin ? onRemove : undefined}
                        />
                    </li>
                ))}
            </ul>

            {formerMembers.length > 0 ? (
                <Collapsible open={showFormer} onOpenChange={setShowFormer}>
                    <CollapsibleTrigger
                        render={
                            <button
                                type="button"
                                className="flex w-full cursor-pointer items-center gap-2 text-left"
                            />
                        }
                    >
                        <h3 className="text-lg">
                            Tidligere medlemmer ({formerMembers.length})
                        </h3>
                        <ChevronDown
                            className={cn(
                                "size-4 shrink-0 transition-transform",
                                showFormer && "rotate-180",
                            )}
                        />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <ul className="flex flex-col gap-2 pt-2">
                            {formerMembers.map((m) => (
                                <li key={m.id}>
                                    <GroupMemberRow member={m} historic />
                                </li>
                            ))}
                        </ul>
                    </CollapsibleContent>
                </Collapsible>
            ) : null}
        </div>
    );
}
