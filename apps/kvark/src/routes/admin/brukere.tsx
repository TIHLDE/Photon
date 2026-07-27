import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon, Trash2, UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Input } from "@tihlde/ui/ui/input";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
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
import { searchUsersQuery } from "#/api/queries/roles";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminGroupPicker } from "#/components/admin-group-picker";
import { AdminPageHeader } from "#/components/admin-page-header";
import {
    UserSearchCombobox,
    type UserSearchOption,
} from "#/components/user-search-combobox";
import { useDebounced } from "#/lib/use-debounced";
import { computeClassYear, initials } from "#/lib/utils";

const ROLE_LABELS: Record<string, string> = {
    leader: "Leder",
    member: "Medlem",
};

const MEMBER_SINCE_FORMAT = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
});

/** Sentinel for "no filter" — the Select needs a concrete value. */
const ALL = "__all__";
/** Sentinel for members without a registered study programme. */
const NO_STUDY = "__none__";

/**
 * Studieprogram + klassetrinn på én linje, f.eks. "Dataingeniør · 3. klasse".
 * Klassetrinn vises bare i intervallet 1–5 (bachelor 3 + master 2) — utenfor
 * det er medlemmet i praksis alumni, siden medlemskap aldri fjernes.
 */
function formatStudy(
    programme: string | null,
    startYear: number | null,
): string | null {
    if (!programme) return null;
    if (startYear === null) return programme;
    const classYear = computeClassYear(startYear);
    if (classYear < 1 || classYear > 5) return programme;
    return `${programme} · ${classYear}. klasse`;
}

/** Prefer the API's own error message over ky's generic HTTP status text. */
async function extractErrorMessage(error: unknown): Promise<string> {
    // Structural check instead of `instanceof HTTPError` — Vite can bundle
    // duplicate ky instances, which breaks instanceof across modules.
    const response =
        error && typeof error === "object" && "response" in error
            ? error.response
            : null;
    if (response instanceof Response) {
        try {
            const body = (await response.clone().json()) as {
                message?: string;
            };
            if (body.message) {
                return body.message;
            }
        } catch {
            // Fall through to the generic message.
        }
    }
    return error instanceof Error ? error.message : String(error);
}

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

    const [search, setSearch] = useState("");
    const [study, setStudy] = useState<string>(ALL);
    const [role, setRole] = useState<string>(ALL);
    const [year, setYear] = useState<string>(ALL);

    const debouncedSearch = useDebounced(search);

    // Filtervalgene speiler dataene som faktisk ligger i gruppen, slik at man
    // ikke kan velge et studie eller et år som gir null treff.
    const studyOptions = useMemo(
        () =>
            Array.from(
                new Set(
                    (members ?? [])
                        .map((m) => m.user.studyProgram)
                        .filter((p): p is string => Boolean(p)),
                ),
            ).sort((a, b) => a.localeCompare(b, "nb-NO")),
        [members],
    );

    const yearOptions = useMemo(
        () =>
            Array.from(
                new Set(
                    (members ?? []).map((m) =>
                        new Date(m.createdAt).getFullYear(),
                    ),
                ),
            ).sort((a, b) => b - a),
        [members],
    );

    const filtered = useMemo(() => {
        const needle = debouncedSearch.toLowerCase();
        return (members ?? []).filter((member) => {
            if (needle && !member.user.name.toLowerCase().includes(needle)) {
                return false;
            }
            if (role !== ALL && member.role !== role) {
                return false;
            }
            if (study === NO_STUDY && member.user.studyProgram) {
                return false;
            }
            if (
                study !== ALL &&
                study !== NO_STUDY &&
                member.user.studyProgram !== study
            ) {
                return false;
            }
            if (
                year !== ALL &&
                String(new Date(member.createdAt).getFullYear()) !== year
            ) {
                return false;
            }
            return true;
        });
    }, [members, debouncedSearch, role, study, year]);

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
                `Fjerne ${member.user.name} fra gruppen? Dette kan ikke angres.`,
            )
        ) {
            remove.mutate({ groupSlug, userId: member.userId });
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field>
                    <FieldLabel htmlFor="member-search">Navn</FieldLabel>
                    <Input
                        id="member-search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Søk etter navn…"
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor="member-filter-study">
                        Studie
                    </FieldLabel>
                    <FilterSelect
                        id="member-filter-study"
                        value={study}
                        onValueChange={setStudy}
                        allLabel="Alle studier"
                        options={[
                            ...studyOptions.map((option) => ({
                                value: option,
                                label: option,
                            })),
                            { value: NO_STUDY, label: "Uten studie" },
                        ]}
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor="member-filter-role">Rolle</FieldLabel>
                    <FilterSelect
                        id="member-filter-role"
                        value={role}
                        onValueChange={setRole}
                        allLabel="Alle roller"
                        options={Object.entries(ROLE_LABELS).map(
                            ([value, label]) => ({ value, label }),
                        )}
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor="member-filter-year">
                        Medlem siden
                    </FieldLabel>
                    <FilterSelect
                        id="member-filter-year"
                        value={year}
                        onValueChange={setYear}
                        allLabel="Alle år"
                        options={yearOptions.map((option) => ({
                            value: String(option),
                            label: String(option),
                        }))}
                    />
                </Field>
            </div>

            <p className="text-sm">
                Viser {filtered.length} av {members.length} medlemmer
            </p>

            {filtered.length === 0 ? (
                <Card>
                    <CardContent>
                        <AdminEmptyState
                            icon={UsersIcon}
                            title="Ingen treff"
                            description="Ingen medlemmer passer med filtrene."
                        />
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Navn</TableHead>
                                    <TableHead>Studie</TableHead>
                                    <TableHead>Rolle</TableHead>
                                    <TableHead>Medlem siden</TableHead>
                                    <TableHead className="text-right">
                                        Handlinger
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((member) => (
                                    <TableRow key={member.userId}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="size-7">
                                                    <AvatarImage
                                                        src={
                                                            member.user.image ??
                                                            undefined
                                                        }
                                                    />
                                                    <AvatarFallback>
                                                        {initials(
                                                            member.user.name ??
                                                                "?",
                                                        )}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-medium">
                                                    {member.user.name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {formatStudy(
                                                member.user.studyProgram,
                                                member.user.studyStartYear,
                                            ) ?? "—"}
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                items={Object.entries(
                                                    ROLE_LABELS,
                                                ).map(([value, label]) => ({
                                                    value,
                                                    label,
                                                }))}
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
                                                    {Object.entries(
                                                        ROLE_LABELS,
                                                    ).map(([value, label]) => (
                                                        <SelectItem
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            {MEMBER_SINCE_FORMAT.format(
                                                new Date(member.createdAt),
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end">
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    disabled={remove.isPending}
                                                    onClick={() =>
                                                        handleRemove(member)
                                                    }
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
            )}
        </div>
    );
}

/**
 * Nedtrekk for et enkelt kolonnefilter, med et fast "alle"-valg øverst.
 */
function FilterSelect({
    id,
    value,
    onValueChange,
    allLabel,
    options,
}: {
    id: string;
    value: string;
    onValueChange: (value: string) => void;
    allLabel: string;
    options: { value: string; label: string }[];
}) {
    const items = [{ value: ALL, label: allLabel }, ...options];
    return (
        <Select
            items={items}
            value={value}
            onValueChange={(next) => onValueChange((next as string) ?? ALL)}
        >
            <SelectTrigger id={id} className="w-full">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                        {item.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
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
    const [selectedUser, setSelectedUser] = useState<UserSearchOption | null>(
        null,
    );
    const [query, setQuery] = useState("");
    const [role, setRole] = useState<"member" | "leader">("member");
    const [error, setError] = useState<string | null>(null);

    const debouncedQuery = useDebounced(query);
    const { data: searchResults, isFetching } = useQuery({
        ...searchUsersQuery(debouncedQuery),
        enabled: debouncedQuery.length >= 2,
    });

    const add = useMutation(addGroupMemberMutation);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedUser) {
            setError("Velg en bruker først.");
            return;
        }
        setError(null);
        try {
            await add.mutateAsync({
                groupSlug,
                data: { userId: selectedUser.id, role },
            });
            setSelectedUser(null);
            setQuery("");
            setRole("member");
            onOpenChange(false);
        } catch (err) {
            setError(await extractErrorMessage(err));
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
                            <FieldLabel>Bruker</FieldLabel>
                            <UserSearchCombobox
                                holder={selectedUser}
                                query={query}
                                onQueryChange={setQuery}
                                results={searchResults ?? []}
                                isSearching={isFetching}
                                onSelect={setSelectedUser}
                                onRemove={() => setSelectedUser(null)}
                                emptyLabel="Søk etter bruker…"
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
