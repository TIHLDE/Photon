import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { InfoIcon, PlusIcon, Trash2, UsersIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import type { GroupMember } from "@tihlde/sdk";

import {
    addGroupMemberMutation,
    getGroupMembersQuery,
    getGroupsQuery,
    removeGroupMemberMutation,
    updateGroupMemberRoleMutation,
} from "#/api/queries/groups";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminGroupPicker } from "#/components/admin-group-picker";
import { AdminPageHeader } from "#/components/admin-page-header";

const ROLE_LABELS: Record<string, string> = {
    leader: "Leder",
    member: "Medlem",
};

export const Route = createFileRoute("/admin/brukere")({
    component: UsersAdminPage,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getGroupsQuery(0));
        return { breadcrumbs: "Brukere" };
    },
});

function UsersAdminPage() {
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));
    const [groupSlug, setGroupSlug] = useState<string | null>(
        groups[0]?.slug ?? null,
    );
    const [addOpen, setAddOpen] = useState(false);

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Brukere"
                description="Administrer medlemskap og roller per gruppe."
            />

            <Alert>
                <InfoIcon className="size-4" />
                <AlertTitle>Gruppebasert medlemshåndtering</AlertTitle>
                <AlertDescription>
                    API-et har ennå ikke et globalt brukerregister. Brukere
                    administreres derfor per gruppe her. Når et endepunkt for å
                    liste alle brukere finnes, kan denne siden utvides med et
                    fullt brukersøk.
                </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <Field className="sm:max-w-72">
                    <FieldLabel>Gruppe</FieldLabel>
                    <AdminGroupPicker
                        groups={groups}
                        value={groupSlug}
                        onValueChange={setGroupSlug}
                    />
                </Field>
                {groupSlug && (
                    <Button onClick={() => setAddOpen(true)}>
                        <PlusIcon className="size-4" />
                        Legg til medlem
                    </Button>
                )}
            </div>

            {groupSlug ? (
                <MembersTable groupSlug={groupSlug} />
            ) : (
                <Card>
                    <CardContent>
                        <AdminEmptyState
                            icon={UsersIcon}
                            title="Velg en gruppe"
                            description="Velg en gruppe for å se og administrere medlemmene."
                        />
                    </CardContent>
                </Card>
            )}

            {groupSlug && (
                <AddMemberDialog
                    groupSlug={groupSlug}
                    open={addOpen}
                    onOpenChange={setAddOpen}
                />
            )}
        </div>
    );
}

function MembersTable({ groupSlug }: { groupSlug: string }) {
    const { data: members, isPending } = useQuery(
        getGroupMembersQuery(groupSlug, 0),
    );
    const updateRole = useMutation(updateGroupMemberRoleMutation);
    const remove = useMutation(removeGroupMemberMutation);

    if (isPending) {
        return (
            <Card>
                <CardContent className="flex flex-col gap-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-10 w-full" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (!members || members.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={UsersIcon}
                        title="Ingen medlemmer"
                        description="Denne gruppen har ingen medlemmer ennå."
                    />
                </CardContent>
            </Card>
        );
    }

    function handleRemove(member: GroupMember) {
        if (
            window.confirm(
                `Fjerne bruker ${member.userId} fra gruppen? Dette kan ikke angres.`,
            )
        ) {
            remove.mutate({ groupSlug, userId: member.userId });
        }
    }

    return (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Bruker-ID</TableHead>
                            <TableHead>Rolle</TableHead>
                            <TableHead>Medlem siden</TableHead>
                            <TableHead className="text-right">
                                Handlinger
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {members.map((member) => (
                            <TableRow key={member.userId}>
                                <TableCell>
                                    <code className="text-xs">
                                        {member.userId}
                                    </code>
                                </TableCell>
                                <TableCell>
                                    <Select
                                        items={Object.entries(ROLE_LABELS).map(
                                            ([value, label]) => ({
                                                value,
                                                label,
                                            }),
                                        )}
                                        value={member.role}
                                        onValueChange={(value) => {
                                            if (
                                                !value ||
                                                value === member.role
                                            ) {
                                                return;
                                            }
                                            updateRole.mutate({
                                                groupSlug,
                                                userId: member.userId,
                                                data: {
                                                    role: value as
                                                        | "member"
                                                        | "leader",
                                                },
                                            });
                                        }}
                                    >
                                        <SelectTrigger className="w-36">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(ROLE_LABELS).map(
                                                ([value, label]) => (
                                                    <SelectItem
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {label}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    {new Date(
                                        member.createdAt,
                                    ).toLocaleDateString("nb-NO")}
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end">
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            disabled={remove.isPending}
                                            onClick={() => handleRemove(member)}
                                        >
                                            <Trash2 className="size-4" />
                                            Fjern
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function AddMemberDialog({
    groupSlug,
    open,
    onOpenChange,
}: {
    groupSlug: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [userId, setUserId] = useState("");
    const [role, setRole] = useState<"member" | "leader">("member");
    const [error, setError] = useState<string | null>(null);

    const add = useMutation(addGroupMemberMutation);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        try {
            await add.mutateAsync({
                groupSlug,
                data: { userId: userId.trim(), role },
            });
            setUserId("");
            setRole("member");
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>Legg til medlem</DialogTitle>
                    </DialogHeader>
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="member-user-id">
                                Bruker-ID
                            </FieldLabel>
                            <Input
                                id="member-user-id"
                                required
                                value={userId}
                                onChange={(event) =>
                                    setUserId(event.target.value)
                                }
                                placeholder="Feide-/bruker-ID"
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="member-role">Rolle</FieldLabel>
                            <Select
                                items={Object.entries(ROLE_LABELS).map(
                                    ([value, label]) => ({ value, label }),
                                )}
                                value={role}
                                onValueChange={(value) =>
                                    setRole(
                                        (value as "member" | "leader") ??
                                            "member",
                                    )
                                }
                            >
                                <SelectTrigger id="member-role">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(ROLE_LABELS).map(
                                        ([value, label]) => (
                                            <SelectItem
                                                key={value}
                                                value={value}
                                            >
                                                {label}
                                            </SelectItem>
                                        ),
                                    )}
                                </SelectContent>
                            </Select>
                        </Field>
                    </FieldGroup>
                    {error && (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Avbryt
                        </Button>
                        <Button type="submit" disabled={add.isPending}>
                            Legg til
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
