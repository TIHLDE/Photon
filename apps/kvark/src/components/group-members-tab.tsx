import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@tihlde/ui/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { GroupAddMemberDialogProps } from "#/components/group-add-member-dialog";
import { GroupAddMemberDialog } from "#/components/group-add-member-dialog";
import { GroupMemberRow } from "#/components/group-member-row";
import { GroupPageHeader } from "#/components/group-page-header";
import type { Member } from "#/lib/group";
import { cn } from "#/lib/utils";

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
}: GroupMembersTabProps) {
    const [showFormer, setShowFormer] = useState(false);

    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader
                title="Medlemmer"
                action={
                    isAdmin ? <GroupAddMemberDialog {...memberSearch} /> : null
                }
            />

            {leaders.length > 0 || leaderTransfer ? (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg">Leder</h3>
                        {leaderTransfer ? (
                            <GroupAddMemberDialog {...leaderTransfer} />
                        ) : null}
                    </div>
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
                    </ul>
                </div>
            ) : null}

            <div className="flex flex-col gap-2">
                <h3 className="text-lg">Medlemmer ({members.length})</h3>
                <ul className="flex flex-col gap-2">
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
            </div>

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
