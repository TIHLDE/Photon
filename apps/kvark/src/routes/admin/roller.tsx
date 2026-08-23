import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { Group, GroupPosition } from "@tihlde/sdk";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@tihlde/ui/ui/accordion";
import {
    Avatar,
    AvatarFallback,
    AvatarGroup,
    AvatarImage,
} from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import {
    Dialog,
    DialogBody,
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
import { MoreHorizontalIcon, PlusIcon, ShieldIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Stagger } from "@tihlde/ui/ui/motion";

import { requireAdminSection } from "#/lib/admin-access";
import { getGroupMembersQuery, getGroupsQuery } from "#/api/queries/groups";
import {
    assignPositionMutation,
    createPositionMutation,
    deletePositionMutation,
    getGroupPositionsQuery,
    getLeaderPermissionsQuery,
    getMemberPermissionsQuery,
    unassignPositionMutation,
    updateLeaderPermissionsMutation,
    updateMemberPermissionsMutation,
    updatePositionMutation,
} from "#/api/queries/roles";
import {
    ConfirmDeleteDialog,
    usePendingConfirm,
} from "#/components/confirm-delete-dialog";
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
    GROUP_SCOPABLE_DOMAINS,
    PERMISSION_DOMAINS,
    domainsOf,
    summarizeExtraPermissions,
    summarizeExtraPermissionsByScope,
    summarizePermissions,
    toggleDomain,
} from "#/lib/permission-domains";
import { initials } from "#/lib/utils";

import { avatarImageUrl } from "#/lib/assets";

export const Route = createFileRoute("/admin/roller")({
    component: RolesAdminPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "roller", {
            allowGroupLeader: true,
        });
    },
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getGroupsQuery(0));
        return { breadcrumbs: "Tilganger" };
    },
});

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

/**
 * Whether the viewer may hand out permissions that reach all of TIHLDE.
 *
 * The server rule is "you may only grant what you hold yourself, at the scope
 * you grant it at", so a group leader — who holds nothing globally — can never
 * write the global list. Rather than show them a section every checkbox in
 * which would 403, it is hidden unless they hold something org-wide.
 */
function useCanGrantGlobally(): boolean {
    return usePermission(["root", "roles:create"]);
}

/**
 * Whether the viewer may change the group leader's own permissions.
 *
 * Mirrors `canManageLeaderPermissions` server-side, and is deliberately
 * stricter than {@link useCanManagePositions}: leading a group does not put
 * your own access in your own hands. A leader manages the group's verv and
 * what every member holds; the leader row is moved for them by someone holding
 * «Tilganger». That is what keeps the two lists independent — trimming what
 * members get can no longer trim the leader, and no leader can lock themselves
 * out of their own group mid-opptak.
 */
function useCanManageLeaderPermissions(groupSlug: string): boolean {
    return useScopedPermission(
        ["groups:manage", "roles:create"],
        `group:${groupSlug}`,
    );
}

function RolesAdminPage() {
    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title="Tilganger"
                description="Administrer verv og tilganger for hver gruppe."
            />

            <PositionsSection />
        </Stagger>
    );
}

// =============================================================================
// Shared: domain-level permission checkboxes
// =============================================================================

/** No domains covered — the leader row subtracts nothing. */
const EMPTY_DOMAINS: Set<string> = new Set();

function PermissionDomainCheckboxes({
    value,
    onChange,
    domains = PERMISSION_DOMAINS,
    lockedDomains,
    lockedHint,
}: {
    value: string[];
    onChange: (next: string[]) => void;
    /** Which domains to offer. Defaults to all of them. */
    domains?: typeof PERMISSION_DOMAINS;
    /**
     * Domains the group already grants every member at this scope. They render
     * ticked and disabled: the access is real, but it is edited one level up,
     * and offering a second switch for it would only let the two disagree.
     */
    lockedDomains?: Set<string>;
    lockedHint?: string;
}) {
    const present = domainsOf(value);
    const hasRoot = value.includes("root");
    const anyLocked = domains.some((d) => lockedDomains?.has(d.slug));

    return (
        <div className="flex flex-col gap-2">
            {hasRoot ? (
                <p className="text-sm text-muted-foreground">
                    Full tilgang (root) — har alle tilganger.
                </p>
            ) : null}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {domains.map((domain) => {
                    const locked = lockedDomains?.has(domain.slug) ?? false;
                    const checked =
                        hasRoot || locked || present.has(domain.slug);
                    return (
                        <label
                            key={domain.slug}
                            className="flex items-center gap-2"
                        >
                            <Checkbox
                                checked={checked}
                                disabled={hasRoot || locked}
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
            {anyLocked && lockedHint ? (
                <p className="text-sm text-muted-foreground">{lockedHint}</p>
            ) : null}
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

/**
 * Holders in the read-only table: the row shows who holds the verv, while
 * adding and removing them belongs in the edit dialog.
 *
 * One holder gets their name spelled out — there is room for it, and a lone
 * face without a name is a riddle. Several stack into overlapping avatars
 * instead, which keeps the column narrow; the names stay on hover and for
 * screen readers.
 */
function HolderAvatars({
    holders,
}: {
    holders: { userId: string; name: string | null; image: string | null }[];
}) {
    const single = holders.length === 1 ? holders[0] : null;

    if (single) {
        return (
            <div className="flex items-center gap-2">
                <HolderAvatar holder={single} />
                <span className="text-sm">{single.name}</span>
            </div>
        );
    }

    return (
        <AvatarGroup>
            {holders.map((holder) => (
                <HolderAvatar key={holder.userId} holder={holder} />
            ))}
        </AvatarGroup>
    );
}

function HolderAvatar({
    holder,
}: {
    holder: { name: string | null; image: string | null };
}) {
    return (
        <Avatar size="sm" title={holder.name ?? undefined}>
            <AvatarImage src={avatarImageUrl(holder.image ?? undefined)} />
            <AvatarFallback>{initials(holder.name ?? "?")}</AvatarFallback>
            <span className="sr-only">{holder.name}</span>
        </Avatar>
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
    return (
        <AccordionItem value={group.slug} className="px-4">
            <AccordionTrigger>{group.name}</AccordionTrigger>
            <AccordionContent>
                {isOpen ? <PositionsTable groupSlug={group.slug} /> : null}
            </AccordionContent>
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
    const [editing, setEditing] = useState<GroupPosition | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const confirmDelete = usePendingConfirm<GroupPosition>();
    // The rows below list only what a holder has beyond the group, so they
    // need the group's own two lists. Reading them requires managing the
    // group; without them the column falls back to the full list.
    const coveredForGroupScope = useGroupCoveredDomains(
        groupSlug,
        canManage,
        "group",
    );
    const coveredForGlobalScope = useGroupCoveredDomains(
        groupSlug,
        canManage,
        "global",
    );

    // The group's leader is a membership role, not a verv — shown as a pinned
    // first row so the group's leadership reads together with its verv. It is
    // changed from the group's member list, not here.
    const leaders = useMemo(
        () => (members ?? []).filter((member) => member.role === "leader"),
        [members],
    );

    if (isPending) {
        return (
            <div className="flex flex-col gap-3 py-2">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                ))}
            </div>
        );
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
                    <MemberPermissionsRow
                        groupSlug={groupSlug}
                        canManage={canManage}
                        memberCount={members?.length ?? 0}
                    />

                    <LeaderRow
                        groupSlug={groupSlug}
                        canManage={canManage}
                        leaders={leaders.map((leader) => ({
                            userId: leader.userId,
                            name: leader.user?.name ?? leader.userId,
                            image: leader.user?.image ?? null,
                        }))}
                    />

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
                                {/* Read-only: holders are added and removed in
                                    «Rediger», so the row just shows who holds
                                    the verv. */}
                                {position.holders.length > 0 ? (
                                    <HolderAvatars holders={position.holders} />
                                ) : (
                                    <span className="text-sm text-muted-foreground">
                                        {position.linkedGroupSlug
                                            ? "Settes av gruppens leder"
                                            : "Ingen tildelt"}
                                    </span>
                                )}
                            </TableCell>
                            <TableCell className="max-w-72 truncate text-sm text-muted-foreground">
                                {canManage
                                    ? summarizeExtraPermissions(
                                          position.permissions,
                                          position.scope === "global"
                                              ? coveredForGlobalScope
                                              : coveredForGroupScope,
                                      )
                                    : summarizePermissions(
                                          position.permissions,
                                      )}
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
                                                    confirmDelete.request(
                                                        position,
                                                    )
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

                    {/* Closing row: the empty state and the create button sit
                        together, so an empty table says what is missing and
                        offers the fix in the same line. */}
                    {canManage || positions?.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4}>
                                <div className="flex items-center justify-between gap-2">
                                    {positions?.length === 0 ? (
                                        <span className="text-sm text-muted-foreground">
                                            Ingen verv ennå.
                                        </span>
                                    ) : (
                                        <span />
                                    )}
                                    {canManage ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setCreateOpen(true)}
                                        >
                                            <PlusIcon className="size-4" />
                                            Ny rolle
                                        </Button>
                                    ) : null}
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : null}
                </TableBody>
            </Table>

            {createOpen && (
                <PositionDialog
                    groupSlug={groupSlug}
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    position={null}
                />
            )}

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

            <ConfirmDeleteDialog
                open={confirmDelete.open}
                onOpenChange={(open) => !open && confirmDelete.clear()}
                title={`Slette vervet «${confirmDelete.shown?.name}»?`}
                description="Alle som har vervet mister tilgangene det gir. Dette kan ikke angres."
                confirmLabel="Slett verv"
                isPending={remove.isPending}
                onConfirm={() => {
                    if (!confirmDelete.pending) return;
                    remove.mutate({
                        groupSlug,
                        positionId: confirmDelete.pending.id,
                    });
                    confirmDelete.clear();
                }}
            />
        </>
    );
}

/**
 * What every member of the group holds, pinned as the first row of the table.
 *
 * This is the row that replaced the invisible `group.roleId` link: "everyone
 * in Index administers TIHLDE" used to be a fact you could only find in the
 * database, and is now a set of checkboxes above the group's verv.
 */
function MemberPermissionsRow({
    groupSlug,
    canManage,
    memberCount,
}: {
    groupSlug: string;
    canManage: boolean;
    memberCount: number;
}) {
    const [editing, setEditing] = useState(false);
    // Only managers may read this — asking as anyone else is a guaranteed 403.
    const { data } = useQuery({
        ...getMemberPermissionsQuery(groupSlug),
        enabled: canManage,
    });
    const permissions = data?.permissions ?? [];
    const globalPermissions = data?.globalPermissions ?? [];

    return (
        <TableRow>
            <TableCell>
                <div className="flex flex-col">
                    <span className="font-medium">Alle medlemmer</span>
                    <span className="text-xs text-muted-foreground">
                        Gjelder alle som er med i gruppen
                    </span>
                </div>
            </TableCell>
            <TableCell>
                <span className="text-sm text-muted-foreground">
                    {memberCount === 1
                        ? "1 medlem"
                        : `${memberCount} medlemmer`}
                </span>
            </TableCell>
            <TableCell className="max-w-72 truncate text-sm text-muted-foreground">
                {canManage
                    ? summarizePermissions([
                          ...permissions,
                          ...globalPermissions,
                      ])
                    : "Gruppens medlemstilganger"}
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
                <MemberPermissionsDialog
                    groupSlug={groupSlug}
                    open={editing}
                    onOpenChange={setEditing}
                    permissions={permissions}
                    globalPermissions={globalPermissions}
                />
            )}
        </TableRow>
    );
}

/**
 * Two sections rather than a three-way control per domain.
 *
 * Almost every group only ever wants the first one, and giving "hele TIHLDE"
 * equal visual weight invites clicking it. The second section is also hidden
 * outright for anyone who could not save it anyway, so a group leader's
 * dialog is just the four checkboxes that mean something for their group.
 */
function MemberPermissionsDialog({
    groupSlug,
    open,
    onOpenChange,
    permissions: initialScoped,
    globalPermissions: initialGlobal,
}: {
    groupSlug: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    permissions: string[];
    globalPermissions: string[];
}) {
    const update = useMutation(updateMemberPermissionsMutation);
    const canGrantGlobally = useCanGrantGlobally();
    const [scoped, setScoped] = useState<string[]>(initialScoped);
    const [global, setGlobal] = useState<string[]>(initialGlobal);
    const [error, setError] = useState<string | null>(null);

    // A global grant matches any scope, so ticking a domain here already
    // covers the group. Locking the local box says so instead of leaving two
    // switches that can disagree about the same access.
    const globalDomains = domainsOf(global);

    async function handleSubmit() {
        setError(null);
        try {
            await update.mutateAsync({
                groupSlug,
                permissions: scoped,
                globalPermissions: global,
            });
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
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Tilganger for alle medlemmer</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Gjelder denne gruppen</FieldLabel>
                            <PermissionDomainCheckboxes
                                value={scoped}
                                onChange={setScoped}
                                domains={GROUP_SCOPABLE_DOMAINS}
                                lockedDomains={globalDomains}
                                lockedHint="Avhukede felt er allerede gitt for hele TIHLDE nedenfor."
                            />
                            <p className="text-sm text-muted-foreground">
                                Alle i gruppen får dette, men bare for gruppens
                                eget innhold. Andre områder kan ikke begrenses
                                til én gruppe, og ligger derfor bare nedenfor.
                            </p>
                        </Field>

                        {canGrantGlobally ? (
                            <Field>
                                <FieldLabel>Gjelder hele TIHLDE</FieldLabel>
                                <PermissionDomainCheckboxes
                                    value={global}
                                    onChange={setGlobal}
                                />
                                <p className="text-sm text-muted-foreground">
                                    Alle i gruppen får dette på tvers av alle
                                    grupper. Du kan bare gi bort tilganger du
                                    selv har.
                                </p>
                            </Field>
                        ) : null}

                        {error ? (
                            <p className="text-sm text-destructive">{error}</p>
                        ) : null}
                    </FieldGroup>
                </DialogBody>
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

/**
 * Domains the group already grants every member, and which a verv or the
 * leader therefore should not offer a second switch for.
 *
 * A global grant matches any scope, so it locks the domain at both scopes; a
 * group-scoped one only locks group-scoped verv. Without that split, a group
 * that lets its members arrange its own events could never hand anyone a verv
 * arranging events for all of TIHLDE.
 */
function useGroupCoveredDomains(
    groupSlug: string,
    enabled: boolean,
    scope: "group" | "global",
): Set<string> {
    const { data } = useQuery({
        ...getMemberPermissionsQuery(groupSlug),
        enabled,
    });
    return useMemo(() => {
        const covered = domainsOf(data?.globalPermissions ?? []);
        if (scope === "group") {
            for (const domain of domainsOf(data?.permissions ?? [])) {
                covered.add(domain);
            }
        }
        return covered;
    }, [data, scope]);
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
    const canEdit = useCanManageLeaderPermissions(groupSlug);
    // Only managers may read this — asking as anyone else is a guaranteed 403.
    const { data } = useQuery({
        ...getLeaderPermissionsQuery(groupSlug),
        enabled: canManage,
    });
    const permissions = data?.permissions ?? [];
    const globalPermissions = data?.globalPermissions ?? [];
    // Groups that call their leader something else — HS's «President» — used
    // to keep a separate verv by that name held by the same person. The title
    // lives on the leader row instead, so there is only one of them.
    const title = data?.title ?? null;

    return (
        <TableRow>
            <TableCell>
                <div className="flex flex-col">
                    <span className="font-medium">{title ?? "Leder"}</span>
                    <span className="text-xs text-muted-foreground">
                        {title
                            ? "Gruppens leder — settes i medlemslisten"
                            : "Settes i gruppens medlemsliste"}
                    </span>
                </div>
            </TableCell>
            <TableCell>
                {leaders.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                        Ingen tildelt
                    </span>
                ) : (
                    <HolderAvatars holders={leaders} />
                )}
            </TableCell>
            <TableCell className="max-w-72 truncate text-sm text-muted-foreground">
                {canManage
                    ? // Nothing subtracted for what the group also gives every
                      // member: the leader's set stands on its own now, and
                      // «Ingen egne tilganger» is exactly the warning that was
                      // missing when a leader's access rode on the member list.
                      summarizeExtraPermissionsByScope([
                          { permissions, covered: EMPTY_DOMAINS },
                          {
                              permissions: globalPermissions,
                              covered: EMPTY_DOMAINS,
                          },
                      ])
                    : "Gruppens ledertilganger"}
            </TableCell>
            <TableCell>
                {canEdit ? (
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
                    globalPermissions={globalPermissions}
                    title={title}
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
    globalPermissions: initialGlobal,
    title: initialTitle,
}: {
    groupSlug: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    permissions: string[];
    globalPermissions: string[];
    /** The group's own name for the role, or null for plain «Leder». */
    title: string | null;
}) {
    const update = useMutation(updateLeaderPermissionsMutation);
    const canGrantGlobally = useCanGrantGlobally();
    const [permissions, setPermissions] = useState<string[]>(initial);
    const [global, setGlobal] = useState<string[]>(initialGlobal);
    const [title, setTitle] = useState(initialTitle ?? "");
    const [error, setError] = useState<string | null>(null);
    // Only the leader's own org-wide list locks a box here: ticking a domain
    // for all of TIHLDE already covers this group, so two switches for it
    // could only disagree.
    //
    // What the group gives every member deliberately does NOT lock anything.
    // It used to, and that is how a leader ended up with an empty row that
    // looked full: the access was real but rode on the member list, and
    // trimming that list took it away. Giving the leader their own copy has to
    // be possible even when members happen to hold the same thing.
    const covered = useMemo(() => domainsOf(global), [global]);

    async function handleSubmit() {
        setError(null);
        try {
            await update.mutateAsync({
                groupSlug,
                permissions,
                // Left out entirely for someone who cannot write it — sending
                // the list back unchanged would 403 them out of saving the
                // group-scoped half they may edit.
                globalPermissions: canGrantGlobally ? global : undefined,
                // Blank means «Leder» — the field is cleared, not left as it was.
                title: title.trim() || null,
            });
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
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Rediger lederrollen</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Tittel</FieldLabel>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Leder"
                            />
                            <p className="text-sm text-muted-foreground">
                                Hva gruppen kaller lederen sin, f.eks.
                                «President». Tomt felt gir «Leder».
                            </p>
                        </Field>
                        <Field>
                            <FieldLabel>Gjelder denne gruppen</FieldLabel>
                            <PermissionDomainCheckboxes
                                value={permissions}
                                onChange={setPermissions}
                                lockedDomains={covered}
                                lockedHint="Avhukede felt er allerede gitt for hele TIHLDE nedenfor."
                            />
                            <p className="text-sm text-muted-foreground">
                                Gjelder bare gruppens eget innhold, og følger
                                den som til enhver tid er leder. Står for seg
                                selv: lederen beholder dette selv om gruppen
                                endrer hva alle medlemmer får.
                            </p>
                        </Field>

                        {canGrantGlobally ? (
                            <Field>
                                <FieldLabel>Gjelder hele TIHLDE</FieldLabel>
                                <PermissionDomainCheckboxes
                                    value={global}
                                    onChange={setGlobal}
                                />
                                <p className="text-sm text-muted-foreground">
                                    Lederen får dette på tvers av alle grupper —
                                    det presidenten trenger utover HS. Du kan
                                    bare gi bort tilganger du selv har.
                                </p>
                            </Field>
                        ) : null}

                        {error ? (
                            <p className="text-sm text-destructive">{error}</p>
                        ) : null}
                    </FieldGroup>
                </DialogBody>
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
    // Flere kan dele ett verv (#646), så dialogen redigerer en liste.
    const [holders, setHolders] = useState<UserSearchOption[]>(
        (position?.holders ?? []).map((holder) => ({
            id: holder.userId,
            name: holder.name,
            image: holder.image,
        })),
    );
    const [holderQuery, setHolderQuery] = useState("");
    const [error, setError] = useState<string | null>(null);
    // Follows the verv's own scope: a group-scoped verv is covered by both of
    // the group's lists, a global one only by the global list.
    const covered = useGroupCoveredDomains(groupSlug, true, scope);
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
            .filter(
                (option) => !holders.some((holder) => holder.id === option.id),
            )
            .slice(0, 10);
    }, [members, holderQuery, holders]);

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
                const previousIds = (position?.holders ?? []).map(
                    (holder) => holder.userId,
                );
                const nextIds = holders.map((holder) => holder.id);

                for (const userId of previousIds.filter(
                    (id) => !nextIds.includes(id),
                )) {
                    await unassign.mutateAsync({
                        groupSlug,
                        positionId,
                        userId,
                    });
                }
                for (const userId of nextIds.filter(
                    (id) => !previousIds.includes(id),
                )) {
                    await assign.mutateAsync({
                        groupSlug,
                        positionId,
                        userId,
                    });
                }
            }

            if (!position) {
                setName("");
                setScope("group");
                setPermissions([]);
                setHolders([]);
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
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {position ? `Rediger «${position.name}»` : "Nytt verv"}
                    </DialogTitle>
                </DialogHeader>
                <DialogBody>
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
                                <FieldLabel>Brukere</FieldLabel>
                                <div className="flex flex-wrap items-center gap-2">
                                    {holders.map((holder) => (
                                        <HolderChip
                                            key={holder.id}
                                            name={holder.name}
                                            image={holder.image}
                                            onRemove={() =>
                                                setHolders((current) =>
                                                    current.filter(
                                                        (candidate) =>
                                                            candidate.id !==
                                                            holder.id,
                                                    ),
                                                )
                                            }
                                        />
                                    ))}
                                    <UserSearchCombobox
                                        holder={null}
                                        emptyLabel={
                                            holders.length > 0
                                                ? "Legg til flere"
                                                : "Ingen tildelt"
                                        }
                                        query={holderQuery}
                                        onQueryChange={setHolderQuery}
                                        results={memberOptions}
                                        onSelect={(user) =>
                                            setHolders((current) =>
                                                current.some(
                                                    (candidate) =>
                                                        candidate.id ===
                                                        user.id,
                                                )
                                                    ? current
                                                    : [...current, user],
                                            )
                                        }
                                        onOpenChange={(isOpen) => {
                                            if (!isOpen) setHolderQuery("");
                                        }}
                                        placeholder="Søk blant gruppens medlemmer…"
                                    />
                                </div>
                            </Field>
                        ) : null}
                        <Field>
                            <FieldLabel>Tilganger</FieldLabel>
                            <PermissionDomainCheckboxes
                                value={permissions}
                                onChange={setPermissions}
                                lockedDomains={covered}
                                lockedHint="Avhukede felt er allerede gitt til alle medlemmer av gruppen."
                            />
                        </Field>
                        <Field>
                            <label className="flex items-center gap-2">
                                <Checkbox
                                    checked={scope === "global"}
                                    onCheckedChange={(next) =>
                                        setScope(
                                            next === true ? "global" : "group",
                                        )
                                    }
                                />
                                <span className="text-sm">
                                    Gjelder hele TIHLDE (ikke bare denne
                                    gruppen) — krever
                                    rolle-administrasjonstilgang
                                </span>
                            </label>
                        </Field>
                        {error ? (
                            <p className="text-sm text-destructive">{error}</p>
                        ) : null}
                    </FieldGroup>
                </DialogBody>
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
