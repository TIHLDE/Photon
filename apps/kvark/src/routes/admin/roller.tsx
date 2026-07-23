import { PERMISSIONS } from "@photon/auth/rbac/registry";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { GroupPosition, Role } from "@tihlde/sdk";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
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
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import {
    CrownIcon,
    PlusIcon,
    ShieldIcon,
    Trash2,
    UserPlusIcon,
    XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { getGroupMembersQuery, getGroupsQuery } from "#/api/queries/groups";
import {
    assignPositionMutation,
    assignRoleMutation,
    createPositionMutation,
    createRoleMutation,
    deletePositionMutation,
    deleteRoleMutation,
    getGroupPositionsQuery,
    getRolesQuery,
    unassignPositionMutation,
    unassignRoleMutation,
} from "#/api/queries/roles";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminGroupPicker } from "#/components/admin-group-picker";
import { AdminPageHeader } from "#/components/admin-page-header";

export const Route = createFileRoute("/admin/roller")({
    component: RolesAdminPage,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getGroupsQuery(0));
        return { breadcrumbs: "Roller og verv" };
    },
});

type TabValue = "roller" | "verv";

function RolesAdminPage() {
    const [tab, setTab] = useState<TabValue>("roller");

    return (
        <div className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Roller og verv"
                description="Administrer globale roller, gruppeverv og hvem som holder dem."
            />

            <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
                <TabsList>
                    <TabsTrigger value="roller">Roller</TabsTrigger>
                    <TabsTrigger value="verv">Verv</TabsTrigger>
                </TabsList>
            </Tabs>

            {tab === "roller" ? <RolesSection /> : <PositionsSection />}
        </div>
    );
}

// =============================================================================
// Shared: permission picker
// =============================================================================

/** Group permissions by domain prefix for a scannable checkbox grid. */
function usePermissionGroups() {
    return useMemo(() => {
        const groups = new Map<string, string[]>();
        for (const permission of PERMISSIONS) {
            const domain = permission.includes(":")
                ? (permission.split(":")[0] ?? permission)
                : permission;
            const list = groups.get(domain) ?? [];
            list.push(permission);
            groups.set(domain, list);
        }
        return Array.from(groups.entries());
    }, []);
}

function PermissionPicker({
    selected,
    onChange,
}: {
    selected: string[];
    onChange: (permissions: string[]) => void;
}) {
    const groups = usePermissionGroups();

    function toggle(permission: string, checked: boolean) {
        onChange(
            checked
                ? [...selected, permission]
                : selected.filter((p) => p !== permission),
        );
    }

    return (
        <div className="flex max-h-72 flex-col gap-4 overflow-y-auto">
            {groups.map(([domain, permissions]) => (
                <div key={domain} className="flex flex-col gap-2">
                    <span className="text-sm font-medium">{domain}</span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {permissions.map((permission) => (
                            <label
                                key={permission}
                                className="flex items-center gap-2"
                            >
                                <Checkbox
                                    checked={selected.includes(permission)}
                                    onCheckedChange={(checked) =>
                                        toggle(permission, checked === true)
                                    }
                                />
                                <span className="text-sm">{permission}</span>
                            </label>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// =============================================================================
// Roles section
// =============================================================================

function RolesSection() {
    const { data: roles, isPending, error } = useQuery(getRolesQuery());
    const [createOpen, setCreateOpen] = useState(false);

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

    if (error) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={ShieldIcon}
                        title="Ingen tilgang"
                        description="Du mangler tilgangen som kreves for å se roller (roles:view)."
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-end">
                <Button onClick={() => setCreateOpen(true)}>
                    <PlusIcon className="size-4" />
                    Ny rolle
                </Button>
            </div>

            <div className="flex flex-col gap-4">
                {(roles ?? []).map((role) => (
                    <RoleCard key={role.id} role={role} />
                ))}
            </div>

            <CreateRoleDialog open={createOpen} onOpenChange={setCreateOpen} />
        </div>
    );
}

function RoleCard({ role }: { role: Role }) {
    const remove = useMutation(deleteRoleMutation);
    const unassign = useMutation(unassignRoleMutation);
    const [assignOpen, setAssignOpen] = useState(false);

    function handleDelete() {
        if (
            window.confirm(
                `Slette rollen "${role.name}"? Alle tildelinger fjernes. Dette kan ikke angres.`,
            )
        ) {
            remove.mutate({ roleId: role.id });
        }
    }

    return (
        <Card>
            <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <CrownIcon className="size-4" />
                    <span className="font-medium">{role.name}</span>
                    <Badge variant="secondary">posisjon {role.position}</Badge>
                    <Badge variant="outline">
                        {role.permissions.length} tilganger
                    </Badge>
                    <div className="ml-auto flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAssignOpen(true)}
                        >
                            <UserPlusIcon className="size-4" />
                            Tildel
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={remove.isPending}
                            onClick={handleDelete}
                        >
                            <Trash2 className="size-4" />
                            Slett
                        </Button>
                    </div>
                </div>

                {role.description && (
                    <p className="text-sm text-muted-foreground">
                        {role.description}
                    </p>
                )}

                <div className="flex flex-wrap gap-1">
                    {role.permissions.map((permission) => (
                        <Badge key={permission} variant="outline">
                            {permission}
                        </Badge>
                    ))}
                </div>

                {role.users.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            Brukere:
                        </span>
                        {role.users.map((user) => (
                            <Badge
                                key={user.userId}
                                variant="secondary"
                                className="gap-1"
                            >
                                {user.name ?? user.userId}
                                <button
                                    type="button"
                                    aria-label={`Fjern ${user.name ?? user.userId}`}
                                    onClick={() =>
                                        unassign.mutate({
                                            roleId: role.id,
                                            userId: user.userId,
                                        })
                                    }
                                >
                                    <XIcon className="size-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                )}
            </CardContent>

            <AssignRoleDialog
                role={role}
                open={assignOpen}
                onOpenChange={setAssignOpen}
            />
        </Card>
    );
}

function CreateRoleDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const create = useMutation(createRoleMutation);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [permissions, setPermissions] = useState<string[]>([]);

    function handleSubmit() {
        create.mutate(
            { data: { name, description, permissions } },
            {
                onSuccess: () => {
                    setName("");
                    setDescription("");
                    setPermissions([]);
                    onOpenChange(false);
                },
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Ny rolle</DialogTitle>
                </DialogHeader>
                <FieldGroup>
                    <Field>
                        <FieldLabel>Navn</FieldLabel>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="f.eks. arrangementansvarlig"
                        />
                    </Field>
                    <Field>
                        <FieldLabel>Beskrivelse</FieldLabel>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </Field>
                    <Field>
                        <FieldLabel>Tilganger</FieldLabel>
                        <PermissionPicker
                            selected={permissions}
                            onChange={setPermissions}
                        />
                    </Field>
                </FieldGroup>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Avbryt
                    </Button>
                    <Button
                        disabled={!name || create.isPending}
                        onClick={handleSubmit}
                    >
                        Opprett
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AssignRoleDialog({
    role,
    open,
    onOpenChange,
}: {
    role: Role;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const assign = useMutation(assignRoleMutation);
    const [userId, setUserId] = useState("");

    function handleSubmit() {
        assign.mutate(
            { roleId: role.id, userId },
            {
                onSuccess: () => {
                    setUserId("");
                    onOpenChange(false);
                },
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tildel «{role.name}»</DialogTitle>
                </DialogHeader>
                <FieldGroup>
                    <Field>
                        <FieldLabel>Bruker-ID</FieldLabel>
                        <Input
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="Bruker-ID"
                        />
                    </Field>
                </FieldGroup>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Avbryt
                    </Button>
                    <Button
                        disabled={!userId || assign.isPending}
                        onClick={handleSubmit}
                    >
                        Tildel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// =============================================================================
// Positions (verv) section
// =============================================================================

function PositionsSection() {
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));
    const [groupSlug, setGroupSlug] = useState<string | null>(
        groups[0]?.slug ?? null,
    );
    const [createOpen, setCreateOpen] = useState(false);

    return (
        <div className="flex flex-col gap-4">
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
                    <Button onClick={() => setCreateOpen(true)}>
                        <PlusIcon className="size-4" />
                        Nytt verv
                    </Button>
                )}
            </div>

            {groupSlug ? (
                <PositionsTable groupSlug={groupSlug} />
            ) : (
                <Card>
                    <CardContent>
                        <AdminEmptyState
                            icon={ShieldIcon}
                            title="Velg en gruppe"
                            description="Velg en gruppe for å se og administrere verv."
                        />
                    </CardContent>
                </Card>
            )}

            {groupSlug && (
                <CreatePositionDialog
                    groupSlug={groupSlug}
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                />
            )}
        </div>
    );
}

function PositionsTable({ groupSlug }: { groupSlug: string }) {
    const { data: positions, isPending } = useQuery(
        getGroupPositionsQuery(groupSlug),
    );
    const remove = useMutation(deletePositionMutation);
    const unassign = useMutation(unassignPositionMutation);
    const [assignFor, setAssignFor] = useState<GroupPosition | null>(null);

    if (isPending) {
        return (
            <Card>
                <CardContent className="flex flex-col gap-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-10 w-full" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (!positions || positions.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={ShieldIcon}
                        title="Ingen verv"
                        description="Denne gruppen har ingen verv ennå."
                    />
                </CardContent>
            </Card>
        );
    }

    function handleDelete(position: GroupPosition) {
        if (
            window.confirm(
                `Slette vervet "${position.name}"? Alle holdere mister tilgangene. Dette kan ikke angres.`,
            )
        ) {
            remove.mutate({ groupSlug, positionId: position.id });
        }
    }

    return (
        <>
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Verv</TableHead>
                                <TableHead>Omfang</TableHead>
                                <TableHead>Tilganger</TableHead>
                                <TableHead>Holdere</TableHead>
                                <TableHead className="text-right">
                                    Handlinger
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {positions.map((position) => (
                                <TableRow key={position.id}>
                                    <TableCell className="font-medium">
                                        {position.name}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                position.scope === "global"
                                                    ? "default"
                                                    : "secondary"
                                            }
                                        >
                                            {position.scope === "global"
                                                ? "Global"
                                                : "Gruppe"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex max-w-72 flex-wrap gap-1">
                                            {position.permissions.map(
                                                (permission) => (
                                                    <Badge
                                                        key={permission}
                                                        variant="outline"
                                                    >
                                                        {permission}
                                                    </Badge>
                                                ),
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {position.holders.map((holder) => (
                                                <Badge
                                                    key={holder.userId}
                                                    variant="secondary"
                                                    className="gap-1"
                                                >
                                                    {holder.name ??
                                                        holder.userId}
                                                    <button
                                                        type="button"
                                                        aria-label={`Fjern ${holder.name ?? holder.userId}`}
                                                        onClick={() =>
                                                            unassign.mutate({
                                                                groupSlug,
                                                                positionId:
                                                                    position.id,
                                                                userId: holder.userId,
                                                            })
                                                        }
                                                    >
                                                        <XIcon className="size-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setAssignFor(position)
                                                }
                                            >
                                                <UserPlusIcon className="size-4" />
                                                Tildel
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                disabled={remove.isPending}
                                                onClick={() =>
                                                    handleDelete(position)
                                                }
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {assignFor && (
                <AssignPositionDialog
                    groupSlug={groupSlug}
                    position={assignFor}
                    open={Boolean(assignFor)}
                    onOpenChange={(open) => {
                        if (!open) setAssignFor(null);
                    }}
                />
            )}
        </>
    );
}

function CreatePositionDialog({
    groupSlug,
    open,
    onOpenChange,
}: {
    groupSlug: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const create = useMutation(createPositionMutation);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [scope, setScope] = useState<"group" | "global">("group");
    const [permissions, setPermissions] = useState<string[]>([]);

    function handleSubmit() {
        create.mutate(
            {
                groupSlug,
                data: { name, description, permissions, scope },
            },
            {
                onSuccess: () => {
                    setName("");
                    setDescription("");
                    setScope("group");
                    setPermissions([]);
                    onOpenChange(false);
                },
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Nytt verv i {groupSlug}</DialogTitle>
                </DialogHeader>
                <FieldGroup>
                    <Field>
                        <FieldLabel>Navn</FieldLabel>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="f.eks. Økonomiansvarlig"
                        />
                    </Field>
                    <Field>
                        <FieldLabel>Beskrivelse</FieldLabel>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </Field>
                    <Field>
                        <FieldLabel>Omfang</FieldLabel>
                        <Select
                            items={[
                                { value: "group", label: "Gruppe" },
                                { value: "global", label: "Global" },
                            ]}
                            value={scope}
                            onValueChange={(value) => {
                                if (value === "group" || value === "global") {
                                    setScope(value);
                                }
                            }}
                        >
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="group">
                                    Gruppe (tilganger gjelder kun i gruppen)
                                </SelectItem>
                                <SelectItem value="global">
                                    Global (krever roles:create)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field>
                        <FieldLabel>Tilganger</FieldLabel>
                        <PermissionPicker
                            selected={permissions}
                            onChange={setPermissions}
                        />
                    </Field>
                </FieldGroup>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Avbryt
                    </Button>
                    <Button
                        disabled={!name || create.isPending}
                        onClick={handleSubmit}
                    >
                        Opprett
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AssignPositionDialog({
    groupSlug,
    position,
    open,
    onOpenChange,
}: {
    groupSlug: string;
    position: GroupPosition;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const assign = useMutation(assignPositionMutation);
    const { data: members } = useQuery(getGroupMembersQuery(groupSlug, 0));
    const [userId, setUserId] = useState<string | null>(null);

    function handleSubmit() {
        if (!userId) return;
        assign.mutate(
            { groupSlug, positionId: position.id, userId },
            {
                onSuccess: () => {
                    setUserId(null);
                    onOpenChange(false);
                },
            },
        );
    }

    const items = (members ?? []).map((member) => ({
        value: member.userId,
        label: member.userId,
    }));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tildel «{position.name}»</DialogTitle>
                </DialogHeader>
                <FieldGroup>
                    <Field>
                        <FieldLabel>Gruppemedlem</FieldLabel>
                        <Select
                            items={items}
                            value={userId ?? ""}
                            onValueChange={(value) => setUserId(value || null)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Velg medlem" />
                            </SelectTrigger>
                            <SelectContent>
                                {items.map((item) => (
                                    <SelectItem
                                        key={item.value}
                                        value={item.value}
                                    >
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                </FieldGroup>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Avbryt
                    </Button>
                    <Button
                        disabled={!userId || assign.isPending}
                        onClick={handleSubmit}
                    >
                        Tildel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
