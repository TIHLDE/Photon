import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { Group, GroupPosition, Role } from "@tihlde/sdk";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@tihlde/ui/ui/accordion";
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
import { useMemo, useState } from "react";

import { Stagger } from "@tihlde/ui/ui/motion";

import { getGroupMembersQuery, getGroupsQuery } from "#/api/queries/groups";
import {
    assignPositionMutation,
    assignRoleMutation,
    createPositionMutation,
    deletePositionMutation,
    deleteRoleMutation,
    getGroupPositionsQuery,
    getLeaderPermissionsQuery,
    getRolesQuery,
    searchUsersQuery,
    unassignPositionMutation,
    unassignRoleMutation,
    updateLeaderPermissionsMutation,
    updatePositionMutation,
    updateRoleMutation,
} from "#/api/queries/roles";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import {
    useIsGroupLeaderOf,
    usePermission,
    useScopedPermission,
} from "#/hooks/use-permission";
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
import { useDebounced } from "#/lib/use-debounced";
import { initials } from "#/lib/utils";

import { avatarImageUrl } from "#/lib/assets";

export const Route = createFileRoute("/admin/roller")({
    component: RolesAdminPage,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getGroupsQuery(0));
        return { breadcrumbs: "Roller og verv" };
    },
});

type TabValue = "verv" | "roller";

/**
 * Whether the viewer may manage the verv of `groupSlug`.
 *
 * Mirrors `canManagePositions` server-side for group-scoped positions:
 * `groups:manage`/`roles:create` globally or for this group, or being the
 * group's leader.
 */
function useCanManagePositions(groupSlug: string): boolean {
    const hasScoped = useScopedPermission(
        ["groups:manage", "roles:create"],
        `group:${groupSlug}`,
    );
    const isLeader = useIsGroupLeaderOf(groupSlug);
    return hasScoped || isLeader;
}

function RolesAdminPage() {
    const [tab, setTab] = useState<TabValue>("verv");
    // Global roles are listed and edited with global roles:* permissions —
    // a group leader has no business in that tab, so it is not shown.
    const canSeeRoles = usePermission([
        "roles:view",
        "roles:create",
        "roles:update",
        "roles:delete",
        "roles:assign",
    ]);

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title="Roller og verv"
                description="Administrer verv i grupper og globale roller."
            />

            <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
                <TabsList>
                    <TabsTrigger value="verv">Verv</TabsTrigger>
                    {canSeeRoles ? (
                        <TabsTrigger value="roller">Roller</TabsTrigger>
                    ) : null}
                </TabsList>
            </Tabs>

            {tab === "verv" || !canSeeRoles ? (
                <PositionsSection />
            ) : (
                <RolesSection onCreateInGroup={() => setTab("verv")} />
            )}
        </Stagger>
    );
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
    /** Omit to render a non-removable chip (e.g. auto-managed holders). */
    onRemove?: () => void;
}) {
    return (
        <Badge variant="secondary" className="gap-1.5 py-1 pl-1">
            <Avatar className="size-5">
                <AvatarImage src={avatarImageUrl(image ?? undefined)} />
                <AvatarFallback>{initials(name ?? "?")}</AvatarFallback>
            </Avatar>
            {name}
            {onRemove ? (
                <button
                    type="button"
                    aria-label={`Fjern ${name}`}
                    onClick={onRemove}
                    className="cursor-pointer"
                >
                    <XIcon className="size-3" />
                </button>
            ) : null}
        </Badge>
    );
}

// =============================================================================
// Verv (group positions)
// =============================================================================

/** Groups whose membership is derived from Feide and never holds verv. */
const DERIVED_GROUP_TYPES = new Set(["study", "studyyear"]);

/**
 * Every group as an accordion, with that group's verv inside — a verv only
 * exists within a group, so the group is the unit you browse and create in.
 * Positions load lazily: the list is long and each group is its own request.
 */
function PositionsSection() {
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));
    const [open, setOpen] = useState<string[]>(["hs"]);
    const [search, setSearch] = useState("");

    const visibleGroups = useMemo(() => {
        const q = search.trim().toLowerCase();
        return groups
            .filter(
                (group) =>
                    // study/studyyear are projections of Feide data — their
                    // membership is rebuilt on every login, so they hold no verv.
                    !DERIVED_GROUP_TYPES.has(group.type.toLowerCase()) &&
                    group.name.toLowerCase().includes(q),
            )
            .sort((a, b) => a.name.localeCompare(b.name, "nb"));
    }, [groups, search]);

    return (
        <div className="flex flex-col gap-4">
            <Field className="sm:max-w-72">
                <FieldLabel>Gruppe</FieldLabel>
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Søk etter gruppe…"
                />
            </Field>

            {visibleGroups.length === 0 ? (
                <Card>
                    <CardContent>
                        <AdminEmptyState
                            icon={ShieldIcon}
                            title="Ingen grupper"
                            description="Ingen grupper passer søket."
                        />
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Accordion
                            value={open}
                            onValueChange={(next) => setOpen(next as string[])}
                        >
                            {visibleGroups.map((group) => (
                                <GroupPositionsItem
                                    key={group.slug}
                                    group={group}
                                    isOpen={open.includes(group.slug)}
                                />
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/** One group in the accordion: header row plus the group's verv when open. */
function GroupPositionsItem({
    group,
    isOpen,
}: {
    group: Group;
    isOpen: boolean;
}) {
    const canManage = useCanManagePositions(group.slug);
    const [createOpen, setCreateOpen] = useState(false);

    return (
        <AccordionItem value={group.slug} className="px-4">
            <div className="flex items-center gap-2">
                {/* The trigger renders its own header wrapper, so the growth
                    has to come from a div around it. */}
                <div className="flex-1">
                    <AccordionTrigger>{group.name}</AccordionTrigger>
                </div>
                {canManage ? (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCreateOpen(true)}
                    >
                        <PlusIcon className="size-4" />
                        Nytt verv
                    </Button>
                ) : null}
            </div>
            <AccordionContent>
                {isOpen ? <PositionsTable groupSlug={group.slug} /> : null}
            </AccordionContent>

            {createOpen && (
                <PositionDialog
                    groupSlug={group.slug}
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    position={null}
                />
            )}
        </AccordionItem>
    );
}

function PositionsTable({ groupSlug }: { groupSlug: string }) {
    const canManage = useCanManagePositions(groupSlug);
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

    // The group's leader is a membership role, not a verv — shown as a pinned
    // first row so the group's leadership reads together with its verv. It is
    // changed from the group's member list, not here.
    const leaders = useMemo(
        () => (members ?? []).filter((member) => member.role === "leader"),
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
            <div className="flex flex-col gap-3 py-2">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                ))}
            </div>
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
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-56">Verv</TableHead>
                        <TableHead>Bruker</TableHead>
                        <TableHead className="w-72">Tilganger</TableHead>
                        <TableHead className="w-12" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <LeaderRow
                        groupSlug={groupSlug}
                        canManage={canManage}
                        leaders={leaders.map((leader) => ({
                            userId: leader.userId,
                            name: leader.user?.name ?? leader.userId,
                            image: leader.user?.image ?? null,
                        }))}
                    />

                    {positions?.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4}>
                                <span className="text-sm text-muted-foreground">
                                    Ingen verv ennå. Opprett det første med
                                    «Nytt verv».
                                </span>
                            </TableCell>
                        </TableRow>
                    ) : null}

                    {(positions ?? []).map((position) => (
                        <TableRow key={position.id}>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">
                                        {position.name}
                                    </span>
                                    {position.linkedGroupSlug ? (
                                        <span className="text-xs text-muted-foreground">
                                            Følger lederen av «
                                            {position.linkedGroupSlug}»
                                        </span>
                                    ) : position.scope === "global" ? (
                                        <span className="text-xs text-muted-foreground">
                                            Gjelder hele TIHLDE
                                        </span>
                                    ) : null}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap items-center gap-2">
                                    {position.linkedGroupSlug ? (
                                        // Auto-managed: holder follows the
                                        // linked group's leader — not
                                        // assignable from here.
                                        position.holder ? (
                                            <HolderChip
                                                key={position.holder.userId}
                                                name={position.holder.name}
                                                image={position.holder.image}
                                            />
                                        ) : (
                                            <span className="text-sm text-muted-foreground">
                                                Settes av gruppens leder
                                            </span>
                                        )
                                    ) : position.holder ? (
                                        <HolderChip
                                            key={position.holder.userId}
                                            name={position.holder.name}
                                            image={position.holder.image}
                                            onRemove={
                                                canManage
                                                    ? () =>
                                                          unassign.mutate({
                                                              groupSlug,
                                                              positionId:
                                                                  position.id,
                                                              userId: position
                                                                  .holder!
                                                                  .userId,
                                                          })
                                                    : undefined
                                            }
                                        />
                                    ) : canManage ? (
                                        <UserSearchCombobox
                                            holder={null}
                                            emptyLabel="Ingen tildelt"
                                            query={
                                                assignFor === position.id
                                                    ? assignQuery
                                                    : ""
                                            }
                                            onQueryChange={setAssignQuery}
                                            onOpenChange={(open) => {
                                                setAssignFor(
                                                    open ? position.id : null,
                                                );
                                                setAssignQuery("");
                                            }}
                                            results={
                                                assignFor === position.id
                                                    ? filteredOptions
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
                                    ) : (
                                        <span className="text-sm text-muted-foreground">
                                            Ingen tildelt
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                                {summarizePermissions(position.permissions)}
                            </TableCell>
                            <TableCell>
                                {canManage ? (
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
                                ) : null}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

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

/**
 * The group's leader, pinned as the first row of the verv table.
 *
 * Leadership is a membership role, not a verv — the holder is still set in the
 * group's member list — but the permissions that come with it are edited here,
 * like every other row. They apply only within this group.
 */
function LeaderRow({
    groupSlug,
    canManage,
    leaders,
}: {
    groupSlug: string;
    canManage: boolean;
    leaders: { userId: string; name: string; image: string | null }[];
}) {
    const [editing, setEditing] = useState(false);
    // Only managers may read this — asking as anyone else is a guaranteed 403.
    const { data } = useQuery({
        ...getLeaderPermissionsQuery(groupSlug),
        enabled: canManage,
    });
    const permissions = data?.permissions ?? [];

    return (
        <TableRow>
            <TableCell>
                <div className="flex flex-col">
                    <span className="font-medium">Leder</span>
                    <span className="text-xs text-muted-foreground">
                        Settes i gruppens medlemsliste
                    </span>
                </div>
            </TableCell>
            <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                    {leaders.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                            Ingen tildelt
                        </span>
                    ) : (
                        leaders.map((leader) => (
                            <HolderChip
                                key={leader.userId}
                                name={leader.name}
                                image={leader.image}
                            />
                        ))
                    )}
                </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
                {canManage
                    ? summarizePermissions(permissions)
                    : "Gruppens ledertilganger"}
            </TableCell>
            <TableCell>
                {canManage ? (
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
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
            </TableCell>

            {editing && (
                <LeaderPermissionsDialog
                    groupSlug={groupSlug}
                    open={editing}
                    onOpenChange={setEditing}
                    permissions={permissions}
                />
            )}
        </TableRow>
    );
}

function LeaderPermissionsDialog({
    groupSlug,
    open,
    onOpenChange,
    permissions: initial,
}: {
    groupSlug: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    permissions: string[];
}) {
    const update = useMutation(updateLeaderPermissionsMutation);
    const [permissions, setPermissions] = useState<string[]>(initial);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit() {
        setError(null);
        try {
            await update.mutateAsync({ groupSlug, permissions });
            onOpenChange(false);
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : "Kunne ikke lagre tilgangene.",
            );
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Rediger ledertilganger</DialogTitle>
                </DialogHeader>
                <FieldGroup>
                    <Field>
                        <FieldLabel>Tilganger</FieldLabel>
                        <PermissionDomainCheckboxes
                            value={permissions}
                            onChange={setPermissions}
                        />
                        <p className="text-sm text-muted-foreground">
                            Gjelder bare i denne gruppen, og følger den som til
                            enhver tid er leder.
                        </p>
                    </Field>
                    {error ? (
                        <p className="text-sm text-destructive">{error}</p>
                    ) : null}
                </FieldGroup>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Avbryt
                    </Button>
                    <Button
                        disabled={update.isPending}
                        onClick={() => void handleSubmit()}
                    >
                        Lagre
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
    const assign = useMutation(assignPositionMutation);
    const unassign = useMutation(unassignPositionMutation);
    const { data: members } = useQuery(getGroupMembersQuery(groupSlug, 0));
    const [name, setName] = useState(position?.name ?? "");
    const [scope, setScope] = useState<"group" | "global">(
        position?.scope ?? "group",
    );
    const [permissions, setPermissions] = useState<string[]>(
        position?.permissions ?? [],
    );
    const [holder, setHolder] = useState<UserSearchOption | null>(
        position?.holder
            ? {
                  id: position.holder.userId,
                  name: position.holder.name,
                  image: position.holder.image,
              }
            : null,
    );
    const [holderQuery, setHolderQuery] = useState("");
    const [error, setError] = useState<string | null>(null);
    const isPending =
        create.isPending ||
        update.isPending ||
        assign.isPending ||
        unassign.isPending;

    // Holders must be members of the group, so the group's own member list is
    // the candidate set — filtered client-side on name.
    const memberOptions: UserSearchOption[] = useMemo(() => {
        const q = holderQuery.trim().toLowerCase();
        return (members ?? [])
            .map((member) => ({
                id: member.user?.id ?? member.userId,
                name: member.user?.name ?? member.userId,
                image: member.user?.image ?? null,
            }))
            .filter((option) =>
                q.length === 0
                    ? true
                    : (option.name ?? "").toLowerCase().includes(q),
            )
            .slice(0, 10);
    }, [members, holderQuery]);

    // Linked leader-verv follow the linked group's leader and reject manual
    // assignment server-side, so the field is not offered for them.
    const canAssignHolder = !position?.linkedGroupSlug;

    async function handleSubmit() {
        setError(null);
        try {
            let positionId: string;
            if (position) {
                await update.mutateAsync({
                    groupSlug,
                    positionId: position.id,
                    data: { name, permissions, scope },
                });
                positionId = position.id;
            } else {
                const created = await create.mutateAsync({
                    groupSlug,
                    data: { name, permissions, scope },
                });
                positionId = created.id;
            }

            if (canAssignHolder) {
                const previousHolderId = position?.holder?.userId ?? null;
                if (previousHolderId && previousHolderId !== holder?.id) {
                    // A position has at most one holder; the old one has to go
                    // before the new one can be assigned.
                    await unassign.mutateAsync({
                        groupSlug,
                        positionId,
                        userId: previousHolderId,
                    });
                }
                if (holder && holder.id !== previousHolderId) {
                    await assign.mutateAsync({
                        groupSlug,
                        positionId,
                        userId: holder.id,
                    });
                }
            }

            if (!position) {
                setName("");
                setScope("group");
                setPermissions([]);
                setHolder(null);
            }
            setHolderQuery("");
            onOpenChange(false);
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : "Kunne ikke lagre vervet.",
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
                    {canAssignHolder ? (
                        <Field>
                            <FieldLabel>Bruker</FieldLabel>
                            <div className="flex flex-wrap items-center gap-2">
                                {holder ? (
                                    <HolderChip
                                        name={holder.name}
                                        image={holder.image}
                                        onRemove={() => setHolder(null)}
                                    />
                                ) : (
                                    <UserSearchCombobox
                                        holder={null}
                                        emptyLabel="Ingen tildelt"
                                        query={holderQuery}
                                        onQueryChange={setHolderQuery}
                                        results={memberOptions}
                                        onSelect={setHolder}
                                        onOpenChange={(isOpen) => {
                                            if (!isOpen) setHolderQuery("");
                                        }}
                                        placeholder="Søk blant gruppens medlemmer…"
                                    />
                                )}
                            </div>
                        </Field>
                    ) : null}
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
                    {error ? (
                        <p className="text-sm text-destructive">{error}</p>
                    ) : null}
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
                        onClick={() => void handleSubmit()}
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

/**
 * Roles that are managed automatically and must not be assigned by hand here:
 * - `member` is the Feide baseline synced to every active student, so it would
 *   list every user and isn't something you hand out from this page.
 * - `moderator` is retired — nobody should hold it.
 */
const HIDDEN_ROLE_NAMES = new Set(["member", "moderator"]);

function RolesSection({ onCreateInGroup }: { onCreateInGroup: () => void }) {
    const { data: roles, isPending, error } = useQuery(getRolesQuery());

    const visibleRoles = (roles ?? []).filter(
        (role) => !HIDDEN_ROLE_NAMES.has(role.name),
    );

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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                    Nye roller opprettes som verv i en gruppe. Rollene her er
                    faste og gjelder hele TIHLDE.
                </p>
                <Button onClick={onCreateInGroup}>
                    <PlusIcon className="size-4" />
                    Nytt verv i gruppe
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
                            {visibleRoles.map((role) => (
                                <RoleRow key={role.id} role={role} />
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
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

/**
 * Edit an existing global role. New roles are not created here — they belong in
 * a group as a verv, see `PositionDialog`.
 */
function RoleDialog({
    open,
    onOpenChange,
    role,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    role: Role;
}) {
    const update = useMutation(updateRoleMutation);
    const [name, setName] = useState(role.name);
    const [description, setDescription] = useState(role.description ?? "");
    const [permissions, setPermissions] = useState<string[]>(
        role.permissions ?? [],
    );
    const isPending = update.isPending;

    function handleSubmit() {
        update.mutate(
            {
                roleId: role.id,
                data: {
                    name,
                    description: description || null,
                    permissions,
                },
            },
            { onSuccess: () => onOpenChange(false) },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>{`Rediger «${role.name}»`}</DialogTitle>
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
                        Lagre
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
