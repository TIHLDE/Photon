import { createFileRoute } from "@tanstack/react-router";
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
import { Input } from "@tihlde/ui/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import type {
    Group,
    GroupSignatureList,
    GroupSignatureMember,
} from "@tihlde/sdk";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/grupper")({
    component: GrupperAdminPage,
});

const MOCK_GROUPS: Group[] = [
    {
        slug: "index",
        name: "Index",
        description: "Linjeforeningens IT-gruppe",
        imageUrl: null,
        contactEmail: "index@tihlde.org",
        type: "committee",
        finesInfo: "",
        finesActivated: false,
        finesAdminId: null,
        contractSigningRequired: true,
        contractNotificationEmail: "index@tihlde.org",
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
    },
    {
        slug: "drift",
        name: "Drift",
        description: "Driftsgruppen",
        imageUrl: null,
        contactEmail: "drift@tihlde.org",
        type: "committee",
        finesInfo: "",
        finesActivated: false,
        finesAdminId: null,
        contractSigningRequired: false,
        contractNotificationEmail: null,
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
    },
    {
        slug: "hs",
        name: "HS",
        description: "Hovedstyret",
        imageUrl: null,
        contactEmail: "hs@tihlde.org",
        type: "board",
        finesInfo: "",
        finesActivated: false,
        finesAdminId: null,
        contractSigningRequired: true,
        contractNotificationEmail: null,
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
    },
];

const MOCK_SIGNATURES: Record<string, GroupSignatureList> = {
    index: {
        totalMembers: 3,
        signedCount: 2,
        members: [
            {
                userId: "user-001",
                hasSigned: true,
                signedAt: "2026-01-15T12:00:00.000Z",
            },
            {
                userId: "user-002",
                hasSigned: false,
                signedAt: null,
            },
            {
                userId: "user-003",
                hasSigned: true,
                signedAt: "2026-01-20T09:30:00.000Z",
            },
        ],
    },
    drift: {
        totalMembers: 1,
        signedCount: 0,
        members: [
            {
                userId: "user-004",
                hasSigned: false,
                signedAt: null,
            },
        ],
    },
    hs: {
        totalMembers: 1,
        signedCount: 1,
        members: [
            {
                userId: "user-005",
                hasSigned: true,
                signedAt: "2026-01-10T08:00:00.000Z",
            },
        ],
    },
};

function GrupperAdminPage() {
    const [groups, setGroups] = useState<Group[]>(MOCK_GROUPS);
    const [signatures, setSignatures] =
        useState<Record<string, GroupSignatureList>>(MOCK_SIGNATURES);
    const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

    function handleUpdateGroup(
        slug: string,
        patch: Pick<
            Group,
            "contractSigningRequired" | "contractNotificationEmail"
        >,
    ) {
        setGroups((prev) =>
            prev.map((g) =>
                g.slug === slug
                    ? { ...g, ...patch, updatedAt: new Date().toISOString() }
                    : g,
            ),
        );
    }

    function handleRevoke(groupSlug: string, userId: string) {
        setSignatures((prev) => {
            const group = prev[groupSlug];
            if (!group) return prev;
            const members = group.members.map((m) =>
                m.userId === userId
                    ? { ...m, hasSigned: false, signedAt: null }
                    : m,
            );
            return {
                ...prev,
                [groupSlug]: {
                    ...group,
                    members,
                    signedCount: members.filter((m) => m.hasSigned).length,
                },
            };
        });
    }

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Grupper – kontraktinnstillinger</h1>
                <p className="text-sm text-muted-foreground">
                    Administrer kontraktsignering per gruppe og se
                    signeringsstatus for medlemmer.
                </p>
            </div>
            <div className="flex flex-col gap-4">
                {groups.map((group) => (
                    <GroupCard
                        key={group.slug}
                        group={group}
                        signatures={signatures[group.slug]}
                        expanded={expandedSlug === group.slug}
                        onToggle={() =>
                            setExpandedSlug(
                                expandedSlug === group.slug ? null : group.slug,
                            )
                        }
                        onUpdate={(patch) =>
                            handleUpdateGroup(group.slug, patch)
                        }
                        onRevoke={(userId) => handleRevoke(group.slug, userId)}
                    />
                ))}
            </div>
        </div>
    );
}

function GroupCard({
    group,
    signatures,
    expanded,
    onToggle,
    onUpdate,
    onRevoke,
}: {
    group: Group;
    signatures: GroupSignatureList | undefined;
    expanded: boolean;
    onToggle: () => void;
    onUpdate: (
        patch: Pick<
            Group,
            "contractSigningRequired" | "contractNotificationEmail"
        >,
    ) => void;
    onRevoke: (userId: string) => void;
}) {
    const [requiresSigning, setRequiresSigning] = useState(
        group.contractSigningRequired,
    );
    const [notifyEmail, setNotifyEmail] = useState(
        group.contractNotificationEmail ?? "",
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <CardTitle>{group.name}</CardTitle>
                        <CardDescription>{group.slug}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {group.contractSigningRequired && (
                            <Badge variant="secondary">Kontrakt påkrevd</Badge>
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
                        <Field>
                            <FieldLabel htmlFor={`email-${group.slug}`}>
                                Varslingse-post (valgfri)
                            </FieldLabel>
                            <Input
                                id={`email-${group.slug}`}
                                type="email"
                                value={notifyEmail}
                                onChange={(e) => setNotifyEmail(e.target.value)}
                                placeholder="gruppe@tihlde.org"
                            />
                        </Field>
                    </FieldGroup>
                    <Button
                        className="self-start"
                        onClick={() =>
                            onUpdate({
                                contractSigningRequired: requiresSigning,
                                contractNotificationEmail: notifyEmail || null,
                            })
                        }
                    >
                        Lagre
                    </Button>
                    {requiresSigning && signatures && (
                        <MemberSigningTable
                            signatures={signatures}
                            onRevoke={onRevoke}
                        />
                    )}
                </CardContent>
            )}
        </Card>
    );
}

function MemberSigningTable({
    signatures,
    onRevoke,
}: {
    signatures: GroupSignatureList;
    onRevoke: (userId: string) => void;
}) {
    if (!signatures.members.length) {
        return (
            <p className="text-sm text-muted-foreground">
                Ingen medlemmer i denne gruppen.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Signeringsstatus</h4>
                <span className="text-sm text-muted-foreground">
                    {signatures.signedCount} / {signatures.totalMembers} signert
                </span>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Bruker-ID</TableHead>
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
                            onRevoke={onRevoke}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function MemberRow({
    member,
    onRevoke,
}: {
    member: GroupSignatureMember;
    onRevoke: (userId: string) => void;
}) {
    return (
        <TableRow>
            <TableCell className="font-mono text-xs">{member.userId}</TableCell>
            <TableCell>
                {member.hasSigned ? (
                    <span className="flex items-center gap-1 text-sm">
                        <CheckCircle2 className="size-4" />
                        Signert
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <XCircle className="size-4" />
                        Ikke signert
                    </span>
                )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
                {member.signedAt
                    ? new Date(member.signedAt).toLocaleDateString("nb-NO")
                    : "—"}
            </TableCell>
            <TableCell>
                {member.hasSigned && (
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onRevoke(member.userId)}
                    >
                        Trekk tilbake
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
}
