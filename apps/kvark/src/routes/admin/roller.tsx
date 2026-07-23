import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { GroupPosition, Role } from "@tihlde/sdk";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@tihlde/ui/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
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
import { MoreHorizontalIcon, PlusIcon, ShieldIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
    searchUsersQuery,
    unassignPositionMutation,
    unassignRoleMutation,
    updatePositionMutation,
    updateRoleMutation,
} from "#/api/queries/roles";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminGroupPicker } from "#/components/admin-group-picker";
import { AdminPageHeader } from "#/components/admin-page-header";
import {
    UserSearchCombobox,
    type UserSearchOption,
} from "#/components/user-search-combobox";
import {
    PERMISSION_DOMAINS,
    domainsOf,
    summarizePermissions,
    toggleDomain,
} from "#/lib/permission-domains";
import { initials } from "#/lib/utils";

export const Route = createFileRoute("/admin/roller")({
    component: RolesAdminPage,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getGroupsQuery(0));
        return { breadcrumbs: "Roller og verv" };
    },
});

type TabValue = "verv" | "roller";

function RolesAdminPage() {
    const [tab, setTab] = useState<TabValue>("verv");

    return (
        <div className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Roller og verv"
                description="Administrer verv i grupper og globale roller."
            />

            <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
                <TabsList>
                    <TabsTrigger value="verv">Verv</TabsTrigger>
                    <TabsTrigger value="roller">Roller</TabsTrigger>
                </TabsList>
            </Tabs>

            {tab === "verv" ? <PositionsSection /> : <RolesSection />}
        </div>
    );
}

/** Debounce a string value (for search-as-you-type). */
function useDebounced(value: string, delayMs = 200): string {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timeout = window.setTimeout(
            () => setDebounced(value.trim()),
            delayMs,
        );
        return () => window.clearTimeout(timeout);
    }, [value, delayMs]);
    return debounced;
}

// =============================================================================
// Shared: domain-level permission checkboxes
// =============================================================================

function PermissionDomainCheckboxes({
    value,
    onChange,
}: {
    value: string[];
    onChange: (next: string[]) => void;
}) {
    const present = domainsOf(value);
    const hasRoot = value.includes("root");

    return (
        <div className="flex flex-col gap-2">
            {hasRoot ? (
                <p className="text-sm text-muted-foreground">
                    Full tilgang (root) — har alle tilganger.
                </p>
            ) : null}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {PERMISSION_DOMAINS.map((domain) => {
                    const checked = hasRoot || present.has(domain.slug);
                    return (
                        <label
                            key={domain.slug}
                            className="flex items-center gap-2"
                        >
                            <Checkbox
                                checked={checked}
                                disabled={hasRoot}
                                onCheckedChange={(next) =>
                                    onChange(
                                        toggleDomain(
                                            value,
                                            domain.slug,
                                            next === true,
                                        ),
                                    )
                                }
                            />
                            <span className="text-sm">{domain.label}</span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

function HolderChip({
    name,
    image,
    onRemove,
}: {
    name: string | null;
    image: string | null;
    onRemove: () => void;
}) {
    return (
        <Badge variant="secondary" className="gap-1.5 py-1 pl-1">
            <Avatar className="size-5">
                <AvatarImage src={image ?? undefined} />
                <AvatarFallback>{initials(name ?? "?")}</AvatarFallback>
            </Avatar>
            {name}
            <button
                type="button"
                aria-label={`Fjern ${name}`}
                onClick={onRemove}
                className="cursor-pointer"
            >
                <XIcon className="size-3" />
            </button>
        </Badge>
    );
}

// =============================================================================
// Verv (group positions)
// =============================================================================

function PositionsSection() {
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));
    const [groupSlug, setGroupSlug] = useState<string | null>(
        groups.find((g) => g.slug === "hs")?.slug ?? groups[0]?.slug ?? null,
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

            {groupSlug ? <PositionsTable groupSlug={groupSlug} /> : null}

            {groupSlug && (
                <PositionDialog
                    groupSlug={groupSlug}
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    position={null}
                />
            )}
        </div>
    );
}

function PositionsTable({ groupSlug }: { groupSlug: string }) {
    const { data: positions, isPending } = useQuery(
        getGroupPositionsQuery(groupSlug),
    );
    const { data: members } = useQuery(getGroupMembersQuery(groupSlug, 0));
    const remove = useMutation(deletePositionMutation);
    const unassign = useMutation(unassignPositionMutation);
    const assign = useMutation(assignPositionMutation);
    const [editing, setEditing] = useState<GroupPosition | null>(null);
    const [assignQuery, setAssignQuery] = useState("");
    const [assignFor, setAssignFor] = useState<string | null>(null);

    // Holder candidates come from the group's member list (positions require
    // membership) — filtered client-side on name.
    const memberOptions: UserSearchOption[] = useMemo(
        () =>
            (members ?? []).map((member) => ({
                id: member.user?.id ?? member.userId,
                name: member.user?.name ?? member.userId,
                image: member.user?.image ?? null,
            })),
        [members],
    );

    const filteredOptions = useMemo(() => {
        const q = assignQuery.trim().toLowerCase();
        if (q.length < 1) return memberOptions.slice(0, 10);
        return memberOptions
            .filter((option) => (option.name ?? "").toLowerCase().includes(q))
            .slice(0, 10);
    }, [memberOptions, assignQuery]);

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
                        description="Denne gruppen har ingen verv ennå. Opprett det første med «Nytt verv»."
                    />
                </CardContent>
            </Card>
        );
    }

    function handleDelete(position: GroupPosition) {
        if (
            window.confirm(
                `Slette vervet «${position.name}»? Alle holdere mister tilgangene.`,
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
                                <TableHead className="w-56">Verv</TableHead>
                                <TableHead>Bruker</TableHead>
                                <TableHead className="w-72">
                                    Tilganger
                                </TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {positions.map((position) => (
                                <TableRow key={position.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {position.name}
                                            </span>
                                            {position.scope === "global" ? (
                                                <span className="text-xs text-muted-foreground">
                                                    Gjelder hele TIHLDE
                                                </span>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {position.holders.map((holder) => (
                                                <HolderChip
                                                    key={holder.userId}
                                                    name={holder.name}
                                                    image={holder.image}
                                                    onRemove={() =>
                                                        unassign.mutate({
                                                            groupSlug,
                                                            positionId:
                                                                position.id,
                                                            userId: holder.userId,
                                                        })
                                                    }
                                                />
                                            ))}
                                            <UserSearchCombobox
                                                holder={null}
                                                emptyLabel={
                                                    position.holders.length ===
                                                    0
                                                        ? "Ingen tildelt"
                                                        : "Legg til"
                                                }
                                                query={
                                                    assignFor === position.id
                                                        ? assignQuery
                                                        : ""
                                                }
                                                onQueryChange={setAssignQuery}
                                                onOpenChange={(open) => {
                                                    setAssignFor(
                                                        open
                                                            ? position.id
                                                            : null,
                                                    );
                                                    setAssignQuery("");
                                                }}
                                                results={
                                                    assignFor === position.id
                                                        ? filteredOptions.filter(
                                                              (option) =>
                                                                  !position.holders.some(
                                                                      (h) =>
                                                                          h.userId ===
                                                                          option.id,
                                                                  ),
                                                          )
                                                        : []
                                                }
                                                onSelect={(user) =>
                                                    assign.mutate({
                                                        groupSlug,
                                                        positionId: position.id,
                                                        userId: user.id,
                                                    })
                                                }
                                                placeholder="Søk blant gruppens medlemmer…"
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {summarizePermissions(
                                            position.permissions,
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger
                                                aria-label="Handlinger"
                                                className="cursor-pointer"
                                            >
                                                <MoreHorizontalIcon className="size-4" />
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() =>
                                                        setEditing(position)
                                                    }
                                                >
                                                    Rediger
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    onClick={() =>
                                                        handleDelete(position)
                                                    }
                                                >
                                                    Slett
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {editing && (
                <PositionDialog
                    groupSlug={groupSlug}
                    open={Boolean(editing)}
                    onOpenChange={(open) => {
                        if (!open) setEditing(null);
                    }}
                    position={editing}
                />
            )}
        </>
    );
}

/** Create (position=null) or edit a position. */
function PositionDialog({
    groupSlug,
    open,
    onOpenChange,
    position,
}: {
    groupSlug: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    position: GroupPosition | null;
}) {
    const create = useMutation(createPositionMutation);
    const update = useMutation(updatePositionMutation);
    const [name, setName] = useState(position?.name ?? "");
    const [scope, setScope] = useState<"group" | "global">(
        position?.scope ?? "group",
    );
    const [permissions, setPermissions] = useState<string[]>(
        position?.permissions ?? [],
    );
    const isPending = create.isPending || update.isPending;

    function handleSubmit() {
        const onSuccess = () => {
            if (!position) {
                setName("");
                setScope("group");
                setPermissions([]);
            }
            onOpenChange(false);
        };
        if (position) {
            update.mutate(
                {
                    groupSlug,
                    positionId: position.id,
                    data: { name, permissions, scope },
                },
                { onSuccess },
            );
        } else {
            create.mutate(
                { groupSlug, data: { name, permissions, scope } },
                { onSuccess },
            );
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {position ? `Rediger «${position.name}»` : "Nytt verv"}
                    </DialogTitle>
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
                        <FieldLabel>Tilganger</FieldLabel>
                        <PermissionDomainCheckboxes
                            value={permissions}
                            onChange={setPermissions}
                        />
                    </Field>
                    <Field>
                        <label className="flex items-center gap-2">
                            <Checkbox
                                checked={scope === "global"}
                                onCheckedChange={(next) =>
                                    setScope(next === true ? "global" : "group")
                                }
                            />
                            <span className="text-sm">
                                Gjelder hele TIHLDE (ikke bare denne gruppen) —
                                krever rolle-administrasjonstilgang
                            </span>
                        </label>
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
                        disabled={!name || isPending}
                        onClick={handleSubmit}
                    >
                        {position ? "Lagre" : "Opprett"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// =============================================================================
// Roller (global RBAC roles)
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
                        description="Du mangler tilgangen som kreves for å se roller."
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

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-56">Rolle</TableHead>
                                <TableHead>Brukere</TableHead>
                                <TableHead className="w-72">
                                    Tilganger
                                </TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(roles ?? []).map((role) => (
                                <RoleRow key={role.id} role={role} />
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <RoleDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                role={null}
            />
        </div>
    );
}

function RoleRow({ role }: { role: Role }) {
    const remove = useMutation(deleteRoleMutation);
    const unassign = useMutation(unassignRoleMutation);
    const assign = useMutation(assignRoleMutation);
    const [editing, setEditing] = useState(false);
    const [query, setQuery] = useState("");
    const debouncedQuery = useDebounced(query);
    const { data: searchResults, isFetching } = useQuery({
        ...searchUsersQuery(debouncedQuery),
        enabled: debouncedQuery.length >= 2,
    });

    function handleDelete() {
        if (
            window.confirm(
                `Slette rollen «${role.name}»? Alle tildelinger fjernes.`,
            )
        ) {
            remove.mutate({ roleId: role.id });
        }
    }

    const assignable = (searchResults ?? []).filter(
        (user) => !role.users.some((u) => u.userId === user.id),
    );

    return (
        <TableRow>
            <TableCell>
                <div className="flex flex-col">
                    <span className="font-medium">{role.name}</span>
                    {role.description ? (
                        <span className="text-xs text-muted-foreground">
                            {role.description}
                        </span>
                    ) : null}
                </div>
            </TableCell>
            <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                    {role.users.map((user) => (
                        <HolderChip
                            key={user.userId}
                            name={user.name}
                            image={user.image}
                            onRemove={() =>
                                unassign.mutate({
                                    roleId: role.id,
                                    userId: user.userId,
                                })
                            }
                        />
                    ))}
                    <UserSearchCombobox
                        holder={null}
                        emptyLabel={
                            role.users.length === 0
                                ? "Ingen tildelt"
                                : "Legg til"
                        }
                        query={query}
                        onQueryChange={setQuery}
                        results={assignable}
                        isSearching={isFetching}
                        onSelect={(user) =>
                            assign.mutate({ roleId: role.id, userId: user.id })
                        }
                        onOpenChange={(open) => {
                            if (!open) setQuery("");
                        }}
                    />
                </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
                {summarizePermissions(role.permissions)}
            </TableCell>
            <TableCell>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        aria-label="Handlinger"
                        className="cursor-pointer"
                    >
                        <MoreHorizontalIcon className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(true)}>
                            Rediger
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            variant="destructive"
                            onClick={handleDelete}
                        >
                            Slett
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>

            {editing && (
                <RoleDialog
                    open={editing}
                    onOpenChange={setEditing}
                    role={role}
                />
            )}
        </TableRow>
    );
}

/** Create (role=null) or edit a role. */
function RoleDialog({
    open,
    onOpenChange,
    role,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    role: Role | null;
}) {
    const create = useMutation(createRoleMutation);
    const update = useMutation(updateRoleMutation);
    const [name, setName] = useState(role?.name ?? "");
    const [description, setDescription] = useState(role?.description ?? "");
    const [permissions, setPermissions] = useState<string[]>(
        role?.permissions ?? [],
    );
    const isPending = create.isPending || update.isPending;

    function handleSubmit() {
        const onSuccess = () => {
            if (!role) {
                setName("");
                setDescription("");
                setPermissions([]);
            }
            onOpenChange(false);
        };
        if (role) {
            update.mutate(
                {
                    roleId: role.id,
                    data: {
                        name,
                        description: description || null,
                        permissions,
                    },
                },
                { onSuccess },
            );
        } else {
            create.mutate(
                { data: { name, description, permissions } },
                { onSuccess },
            );
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {role ? `Rediger «${role.name}»` : "Ny rolle"}
                    </DialogTitle>
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
                        <PermissionDomainCheckboxes
                            value={permissions}
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
                        disabled={!name || isPending}
                        onClick={handleSubmit}
                    >
                        {role ? "Lagre" : "Opprett"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
