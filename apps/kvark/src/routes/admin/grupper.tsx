import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import type {
    GroupSignatureList,
    GroupSignatureMember,
    GroupWithMemberCount,
} from "@tihlde/sdk";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { CheckCircle2, UsersIcon, XCircle } from "lucide-react";
import { useState } from "react";

import { getGroupsQuery, updateGroupMutation } from "#/api/queries/groups";
import {
    getGroupSignaturesQuery,
    revokeSignatureMutation,
} from "#/api/queries/contracts";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";

export const Route = createFileRoute("/admin/grupper")({
    component: GrupperAdminPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getGroupsQuery(0)),
});

// Kontraktsignering gjelder kun verv (undergrupper, komiteer, styrer,
// interessegrupper). Automatisk genererte grupper (klassetrinn, studier,
// TIHLDE) og private bøtelag skal ikke administreres her.
const GROUP_TYPE_TABS = [
    { type: "SUBGROUP", label: "Undergrupper" },
    { type: "COMMITTEE", label: "Komiteer" },
    { type: "BOARD", label: "Styrer" },
    { type: "INTERESTGROUP", label: "Interessegrupper" },
] as const;

type TabType = (typeof GROUP_TYPE_TABS)[number]["type"];

const GROUP_TYPE_LABELS: Record<string, string> = {
    SUBGROUP: "Undergruppe",
    COMMITTEE: "Komité",
    BOARD: "Styre",
    INTERESTGROUP: "Interessegruppe",
    STUDYYEAR: "Klassetrinn",
    STUDY: "Studie",
    TIHLDE: "TIHLDE",
    PRIVATE: "Privat",
};

/** Norsk visningsnavn for en gruppetype fra databasen (f.eks. "SUBGROUP"). */
function groupTypeLabel(type: string): string {
    return (
        GROUP_TYPE_LABELS[type] ??
        type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
    );
}

function GrupperAdminPage() {
    const { data: allGroups } = useSuspenseQuery(getGroupsQuery(0));
    const [tab, setTab] = useState<TabType>("SUBGROUP");
    const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

    const groups = allGroups.filter((group) => group.type === tab);

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Grupper – kontraktinnstillinger"
                description="Administrer kontraktsignering per gruppe og se signeringsstatus for medlemmer."
            />
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
                <TabsList>
                    {GROUP_TYPE_TABS.map(({ type, label }) => (
                        <TabsTrigger key={type} value={type}>
                            {label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            {groups.length === 0 ? (
                <AdminEmptyState
                    icon={UsersIcon}
                    title="Ingen grupper"
                    description="Fant ingen grupper av denne typen."
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {groups.map((group) => (
                        <GroupCard
                            key={group.slug}
                            group={group}
                            expanded={expandedSlug === group.slug}
                            onToggle={() =>
                                setExpandedSlug(
                                    expandedSlug === group.slug
                                        ? null
                                        : group.slug,
                                )
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function GroupCard({
    group,
    expanded,
    onToggle,
}: {
    group: GroupWithMemberCount;
    expanded: boolean;
    onToggle: () => void;
}) {
    const [requiresSigning, setRequiresSigning] = useState(
        group.contractSigningRequired,
    );

    const updateGroup = useMutation(updateGroupMutation);

    const signaturesQuery = useQuery({
        ...getGroupSignaturesQuery(group.slug),
        enabled: expanded && requiresSigning,
    });

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <CardTitle>{group.name}</CardTitle>
                        <CardDescription>
                            {groupTypeLabel(group.type)} · {group.memberCount}{" "}
                            {group.memberCount === 1 ? "medlem" : "medlemmer"}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {group.contractSigningRequired && (
                            <Badge variant="secondary">Kontrakt påkrevd</Badge>
                        )}
                        {group.finesActivated && (
                            <Badge variant="outline">Bøter aktivert</Badge>
                        )}
                        <Button variant="outline" size="sm" onClick={onToggle}>
                            {expanded ? "Lukk" : "Rediger"}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            {expanded && (
                <CardContent className="flex flex-col gap-6">
                    <FieldGroup>
                        <Field className="flex-row items-center gap-3">
                            <Checkbox
                                id={`signing-${group.slug}`}
                                checked={requiresSigning}
                                onCheckedChange={(checked) =>
                                    setRequiresSigning(Boolean(checked))
                                }
                            />
                            <FieldLabel htmlFor={`signing-${group.slug}`}>
                                Krev kontraktsignering for denne gruppen
                            </FieldLabel>
                        </Field>
                    </FieldGroup>
                    <Button
                        className="self-start"
                        disabled={updateGroup.isPending}
                        onClick={() =>
                            updateGroup.mutate({
                                slug: group.slug,
                                data: {
                                    contractSigningRequired: requiresSigning,
                                },
                            })
                        }
                    >
                        Lagre
                    </Button>
                    {requiresSigning &&
                        (signaturesQuery.data ? (
                            <MemberSigningTable
                                groupSlug={group.slug}
                                signatures={signaturesQuery.data}
                            />
                        ) : (
                            <p>Laster signeringsstatus…</p>
                        ))}
                </CardContent>
            )}
        </Card>
    );
}

function MemberSigningTable({
    groupSlug,
    signatures,
}: {
    groupSlug: string;
    signatures: GroupSignatureList;
}) {
    const revokeSignature = useMutation(revokeSignatureMutation);

    if (!signatures.members.length) {
        return <p>Ingen medlemmer i denne gruppen.</p>;
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <h4>Signeringsstatus</h4>
                <span>
                    {signatures.signedCount} / {signatures.totalMembers} signert
                </span>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Navn</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Signert</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {signatures.members.map((member) => (
                        <MemberRow
                            key={member.userId}
                            member={member}
                            disabled={revokeSignature.isPending}
                            onRevoke={() =>
                                revokeSignature.mutate({
                                    groupSlug,
                                    userId: member.userId,
                                })
                            }
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function MemberRow({
    member,
    disabled,
    onRevoke,
}: {
    member: GroupSignatureMember;
    disabled: boolean;
    onRevoke: () => void;
}) {
    return (
        <TableRow>
            <TableCell>
                <div className="flex flex-col gap-0.5">
                    <span>{member.userName}</span>
                    <span>{member.userEmail}</span>
                </div>
            </TableCell>
            <TableCell>
                {member.hasSigned ? (
                    <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-4" />
                        Signert
                    </span>
                ) : (
                    <span className="flex items-center gap-1">
                        <XCircle className="size-4" />
                        Ikke signert
                    </span>
                )}
            </TableCell>
            <TableCell>
                {member.signedAt
                    ? new Date(member.signedAt).toLocaleDateString("nb-NO")
                    : "—"}
            </TableCell>
            <TableCell>
                {member.hasSigned && (
                    <Button
                        size="sm"
                        variant="destructive"
                        disabled={disabled}
                        onClick={onRevoke}
                    >
                        Trekk tilbake
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
}
