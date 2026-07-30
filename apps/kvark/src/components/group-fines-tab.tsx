import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Card } from "@tihlde/ui/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { GroupFineDialog } from "#/components/group-fine-dialog";
import { GroupFineRow } from "#/components/group-fine-row";
import { GroupFineStatCard } from "#/components/group-fine-stat-card";
import { GroupPageHeader } from "#/components/group-page-header";
import { TriStateFilter, type TriState } from "#/components/tri-state-filter";
import type { Fine } from "#/lib/group";
import { initials } from "#/lib/utils";

type GroupingMode = "all" | "per-member";

type GroupFinesTabProps = {
    fines: Fine[];
    memberCount: number;
    /** Whether the viewer may approve, edit or delete the group's fines. */
    canManage: boolean;
    onApprove: (fine: Fine) => void;
    onMarkPaid: (fine: Fine) => void;
    onDelete: (fine: Fine) => void;
};

function fineFilterMatches(fine: Fine, approved: TriState, paid: TriState) {
    if (approved === "yes" && !fine.approved) return false;
    if (approved === "no" && fine.approved) return false;
    if (paid === "yes" && !fine.paid) return false;
    if (paid === "no" && fine.paid) return false;
    return true;
}

function perMember(value: number, memberCount: number): string {
    if (memberCount <= 0) return "0.0";
    return (value / memberCount).toFixed(1);
}

export function GroupFinesTab({
    fines,
    memberCount,
    canManage,
    onApprove,
    onMarkPaid,
    onDelete,
}: GroupFinesTabProps) {
    const [grouping, setGrouping] = useState<GroupingMode>("all");
    const [approved, setApproved] = useState<TriState>("all");
    const [paid, setPaid] = useState<TriState>("all");
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const filtered = useMemo(
        () => fines.filter((f) => fineFilterMatches(f, approved, paid)),
        [fines, approved, paid],
    );

    const grouped = useMemo(() => {
        const map = new Map<string, Fine[]>();
        for (const fine of filtered) {
            const list = map.get(fine.userId) ?? [];
            list.push(fine);
            map.set(fine.userId, list);
        }
        return map;
    }, [filtered]);

    const stats = useMemo(() => {
        const ikkeGodkjent = fines
            .filter((f) => !f.approved)
            .reduce((sum, f) => sum + f.amount, 0);
        const godkjentIkkeBetalt = fines
            .filter((f) => f.approved && !f.paid)
            .reduce((sum, f) => sum + f.amount, 0);
        const betalt = fines
            .filter((f) => f.paid)
            .reduce((sum, f) => sum + f.amount, 0);
        return {
            ikkeGodkjent,
            godkjentIkkeBetalt,
            betalt,
            avgIkkeGodkjent: perMember(ikkeGodkjent, memberCount),
            avgGodkjentIkkeBetalt: perMember(godkjentIkkeBetalt, memberCount),
            avgBetalt: perMember(betalt, memberCount),
        };
    }, [fines, memberCount]);

    return (
        <div className="flex flex-col gap-6">
            <GroupPageHeader title="Bøter" />

            <div className="grid gap-4 md:grid-cols-3">
                <GroupFineStatCard
                    label="Ikke godkjent"
                    value={stats.ikkeGodkjent}
                    perMember={stats.avgIkkeGodkjent}
                />
                <GroupFineStatCard
                    label="Godkjent, ikke betalt"
                    value={stats.godkjentIkkeBetalt}
                    perMember={stats.avgGodkjentIkkeBetalt}
                />
                <GroupFineStatCard
                    label="Betalt"
                    value={stats.betalt}
                    perMember={stats.avgBetalt}
                />
            </div>

            <div className="flex flex-col gap-3">
                <Tabs
                    value={grouping}
                    onValueChange={(v) => setGrouping(v as GroupingMode)}
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <TabsList>
                            <TabsTrigger value="all">Alle bøter</TabsTrigger>
                            <TabsTrigger value="per-member">
                                Per medlem
                            </TabsTrigger>
                        </TabsList>
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            <TriStateFilter
                                value={approved}
                                onChange={setApproved}
                                options={{
                                    all: "Alle",
                                    yes: "Godkjente",
                                    no: "Ikke godkjente",
                                }}
                            />
                            <TriStateFilter
                                value={paid}
                                onChange={setPaid}
                                options={{
                                    all: "Alle",
                                    yes: "Betalte",
                                    no: "Ikke betalte",
                                }}
                            />
                        </div>
                    </div>
                </Tabs>

                {grouping === "all" ? (
                    <ul className="flex flex-col gap-2">
                        {filtered.map((fine, index) => (
                            <li key={fine.id}>
                                <GroupFineRow
                                    fine={fine}
                                    index={index + 1}
                                    onOpen={() => setOpenIndex(index)}
                                />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {Array.from(grouped.entries()).map(([userId, list]) => (
                            <li key={userId}>
                                <Card
                                    size="sm"
                                    className="flex-row items-center gap-3 px-3 py-2 cursor-pointer"
                                    role="button"
                                    onClick={() => {
                                        const i = filtered.findIndex(
                                            (f) => f.id === (list[0]?.id ?? ""),
                                        );
                                        setOpenIndex(i);
                                    }}
                                >
                                    <Avatar className="size-10">
                                        {list[0]?.userImage ? (
                                            <AvatarImage
                                                src={list[0].userImage}
                                                alt={list[0].user}
                                            />
                                        ) : null}
                                        <AvatarFallback>
                                            {initials(list[0]?.user ?? "")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate font-medium">
                                            {list[0]?.user}
                                        </span>
                                        <span className="truncate text-sm text-muted-foreground">
                                            {list.length} bøter
                                        </span>
                                    </div>
                                    <ChevronRight />
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <GroupFineDialog
                fines={filtered}
                openIndex={openIndex}
                onOpenChange={setOpenIndex}
                canManage={canManage}
                onApprove={onApprove}
                onMarkPaid={onMarkPaid}
                onDelete={onDelete}
            />
        </div>
    );
}
