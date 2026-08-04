import { createFileRoute } from "@tanstack/react-router";
import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { PlusIcon, Trash2, UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Input } from "@tihlde/ui/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@tihlde/ui/ui/field";
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
import type { Group, GroupMember } from "@tihlde/sdk";

import {
    addGroupMemberMutation,
    getGroupMembersQuery,
    getGroupsQuery,
    removeGroupMemberMutation,
    updateGroupMemberRoleMutation,
} from "#/api/queries/groups";
import { Stagger } from "@tihlde/ui/ui/motion";

import { searchUsersQuery } from "#/api/queries/roles";
import {
    getUsersInfiniteQuery,
    updateUserStudyYearMutation,
} from "#/api/queries/user";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminGroupPicker } from "#/components/admin-group-picker";
import { AdminPageHeader } from "#/components/admin-page-header";
import { usePermission } from "#/hooks/use-permission";
import {
    UserSearchCombobox,
    type UserSearchOption,
} from "#/components/user-search-combobox";
import { useDebounced } from "#/lib/use-debounced";
import { computeClassYear, initials, programmeLength } from "#/lib/utils";

import { avatarImageUrl } from "#/lib/assets";

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
 * Klassetrinn vises kun mens studiet varer (3 år på bachelor, 5 på master);
 * etterpå er medlemmet alumni, og kullet sier mer enn et klassetrinn som
 * fortsetter å telle oppover.
 */
function formatStudy(
    programme: string | null,
    startYear: number | null,
): string | null {
    if (!programme) return null;
    if (startYear === null) return programme;
    const classYear = computeClassYear(startYear);
    if (classYear < 1 || classYear > programmeLength(programme)) {
        return `${programme} · kull ${startYear}`;
    }
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
    // Ingen gruppe valgt = alle brukere. Gruppenedtrekket filtrerer bare på
    // studie, så det viser kun STUDY-gruppene (typen lagres i VERSALER fra
    // Lepton, derfor lower()).
    const studyGroups = useMemo(
        () => groups.filter((group) => group.type.toLowerCase() === "study"),
        [groups],
    );
    const cohortYears = useMemo(
        () =>
            groups
                .filter((group) => group.type.toLowerCase() === "studyyear")
                .map((group) => Number.parseInt(group.name, 10))
                .filter((year) => Number.isFinite(year))
                .sort((a, b) => b - a),
        [groups],
    );
    const [groupSlug, setGroupSlug] = useState<string | null>(null);
    const [addOpen, setAddOpen] = useState(false);

    /**
     * Medlemskap i studie- og kullgrupper bygges opp fra Feide ved hver
     * innlogging, og API-et avviser håndredigering av dem (400). Lista vises
     * derfor uten rolle- og fjern-handlinger for slike grupper.
     */
    // Add/remove members and role changes all require `groups:manage`
    // GLOBALLY server-side (no scope, no leader bypass), so anything less
    // makes the list read-only rather than showing controls that 403.
    const canManageMembers = usePermission("groups:manage");
    const selectedGroup = groups.find((group) => group.slug === groupSlug);
    const readOnly = selectedGroup
        ? ["study", "studyyear"].includes(selectedGroup.type.toLowerCase()) ||
          !canManageMembers
        : !canManageMembers;

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title="Brukere"
                description="Søk i alle brukere, eller velg et studie for å administrere medlemskap og roller."
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <Field className="sm:max-w-72">
                    <FieldLabel>Studie</FieldLabel>
                    <AdminGroupPicker
                        groups={studyGroups}
                        value={groupSlug}
                        onValueChange={setGroupSlug}
                        allLabel="Alle brukere"
                    />
                </Field>
                {groupSlug && !readOnly && (
                    <Button onClick={() => setAddOpen(true)}>
                        <PlusIcon className="size-4" />
                        Legg til medlem
                    </Button>
                )}
            </div>

            {groupSlug ? (
                <MembersTable groupSlug={groupSlug} readOnly={readOnly} />
            ) : (
                <AllUsersTable
                    studyGroups={studyGroups}
                    cohortYears={cohortYears}
                />
            )}

            {groupSlug && !readOnly && (
                <AddMemberDialog
                    groupSlug={groupSlug}
                    open={addOpen}
                    onOpenChange={setAddOpen}
                />
            )}
        </Stagger>
    );
}

/**
 * Alle brukere i systemet — ikke bare de som ligger i en gruppe. Søk og filtre
 * kjøres server-side, og lista hentes sidevis, siden det er ~2000 brukere.
 */
function AllUsersTable({
    studyGroups,
    cohortYears,
}: {
    studyGroups: Group[];
    cohortYears: number[];
}) {
    const [search, setSearch] = useState("");
    const [study, setStudy] = useState<string>(ALL);
    const [year, setYear] = useState<string>(ALL);
    const [editing, setEditing] = useState<{
        id: string;
        name: string;
        studyStartYear: number | null;
    } | null>(null);

    /**
     * Kullet er en avledet gruppe, så medlemslista nekter å redigere det (400).
     * `users:manage` er den eneste veien inn, og kravet er globalt — uten det
     * skjuler vi handlingen i stedet for å vise en knapp som svarer 403.
     */
    const canEditCohort = usePermission("users:manage");

    const debouncedSearch = useDebounced(search);

    const {
        data,
        isPending,
        isFetching,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery(
        getUsersInfiniteQuery({
            search: debouncedSearch.trim() || undefined,
            // Backend-sentinelen for "uten studie" er "none".
            study:
                study === ALL ? undefined : study === NO_STUDY ? "none" : study,
            studyStartYear: year === ALL ? undefined : Number(year),
        }),
    );

    const users = useMemo(
        () => (data?.pages ?? []).flatMap((page) => page.items),
        [data],
    );
    const totalCount = data?.pages[0]?.totalCount ?? 0;

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field>
                    <FieldLabel htmlFor="user-search">Navn</FieldLabel>
                    <Input
                        id="user-search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Søk etter navn eller brukernavn…"
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor="user-filter-study">Studie</FieldLabel>
                    <FilterSelect
                        id="user-filter-study"
                        value={study}
                        onValueChange={setStudy}
                        allLabel="Alle studier"
                        options={[
                            ...studyGroups.map((group) => ({
                                value: group.slug,
                                label: group.name,
                            })),
                            { value: NO_STUDY, label: "Uten studie" },
                        ]}
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor="user-filter-year">Kull</FieldLabel>
                    <FilterSelect
                        id="user-filter-year"
                        value={year}
                        onValueChange={setYear}
                        allLabel="Alle kull"
                        options={cohortYears.map((option) => ({
                            value: String(option),
                            label: String(option),
                        }))}
                    />
                </Field>
            </div>

            {isPending ? (
                <Card>
                    <CardContent className="flex flex-col gap-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <Skeleton key={index} className="h-10 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : users.length === 0 ? (
                <Card>
                    <CardContent>
                        <AdminEmptyState
                            icon={UsersIcon}
                            title="Ingen treff"
                            description="Ingen brukere passer med søket og filtrene."
                        />
                    </CardContent>
                </Card>
            ) : (
                <>
                    <p className="text-sm">
                        Viser {users.length} av {totalCount} brukere
                    </p>
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Navn</TableHead>
                                        <TableHead>Brukernavn</TableHead>
                                        <TableHead>Studie</TableHead>
                                        <TableHead>Kull</TableHead>
                                        {canEditCohort && (
                                            <TableHead className="w-0" />
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="size-7">
                                                        <AvatarImage
                                                            src={avatarImageUrl(
                                                                user.image ??
                                                                    undefined,
                                                            )}
                                                        />
                                                        <AvatarFallback>
                                                            {initials(
                                                                user.name ??
                                                                    "?",
                                                            )}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm font-medium">
                                                        {user.name}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {user.username ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                                {formatStudy(
                                                    user.studyProgram,
                                                    user.studyStartYear,
                                                ) ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                                {user.studyStartYear ?? "—"}
                                            </TableCell>
                                            {canEditCohort && (
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            setEditing({
                                                                id: user.id,
                                                                name: user.name,
                                                                studyStartYear:
                                                                    user.studyStartYear,
                                                            })
                                                        }
                                                    >
                                                        Rett kull
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    {hasNextPage && (
                        <div className="flex justify-center">
                            <Button
                                variant="outline"
                                disabled={isFetchingNextPage || isFetching}
                                onClick={() => fetchNextPage()}
                            >
                                Last inn flere
                            </Button>
                        </div>
                    )}
                </>
            )}

            <EditCohortDialog
                user={editing}
                open={editing !== null}
                onOpenChange={(open) => {
                    if (!open) setEditing(null);
                }}
            />
        </div>
    );
}

function MembersTable({
    groupSlug,
    readOnly,
}: {
    groupSlug: string;
    /** Feide-avledede grupper kan ikke redigeres for hånd. */
    readOnly: boolean;
}) {
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
                                    {!readOnly && (
                                        <TableHead className="text-right">
                                            Handlinger
                                        </TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((member) => (
                                    <TableRow key={member.userId}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="size-7">
                                                    <AvatarImage
                                                        src={avatarImageUrl(
                                                            member.user.image ??
                                                                undefined,
                                                        )}
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
                                            {readOnly ? (
                                                (ROLE_LABELS[member.role] ??
                                                member.role)
                                            ) : (
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
                                                            value ===
                                                                member.role
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
                                                        ).map(
                                                            ([
                                                                value,
                                                                label,
                                                            ]) => (
                                                                <SelectItem
                                                                    key={value}
                                                                    value={
                                                                        value
                                                                    }
                                                                >
                                                                    {label}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {MEMBER_SINCE_FORMAT.format(
                                                new Date(member.createdAt),
                                            )}
                                        </TableCell>
                                        {!readOnly && (
                                            <TableCell>
                                                <div className="flex justify-end">
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        disabled={
                                                            remove.isPending
                                                        }
                                                        onClick={() =>
                                                            handleRemove(member)
                                                        }
                                                    >
                                                        <Trash2 className="size-4" />
                                                        Fjern
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        )}
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

/**
 * Rett kullet til ett medlem.
 *
 * Feide gir ikke kull for alle studier, så nye medlemmer antas å være
 * 1. klassinger. Den antakelsen er riktig for høstopptaket og for alle som
 * bytter studium, men feil for en som melder seg inn senere i løpet — og de
 * merker det selv, fordi de mister prioritet på sitt eget kulls arrangementer.
 */
function EditCohortDialog({
    user,
    open,
    onOpenChange,
}: {
    user: { id: string; name: string; studyStartYear: number | null } | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [value, setValue] = useState("");
    const [error, setError] = useState<string | null>(null);

    const update = useMutation(updateUserStudyYearMutation);

    // Feltet følger medlemmet dialogen ble åpnet for, ikke forrige gang den var
    // åpen — ellers rettes feil person når to rader åpnes etter hverandre.
    const [lastUserId, setLastUserId] = useState<string | null>(null);
    if (user && user.id !== lastUserId) {
        setLastUserId(user.id);
        setValue(
            user.studyStartYear === null ? "" : String(user.studyStartYear),
        );
        setError(null);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!user) return;

        const trimmed = value.trim();
        const startYear = trimmed === "" ? null : Number(trimmed);

        if (startYear !== null && !Number.isInteger(startYear)) {
            setError("Kullet må være et årstall, for eksempel 2026.");
            return;
        }

        setError(null);
        try {
            await update.mutateAsync({ userId: user.id, startYear });
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
                        <DialogTitle>Rett kull</DialogTitle>
                        <DialogDescription>{user?.name}</DialogDescription>
                    </DialogHeader>
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="cohort-year">Kull</FieldLabel>
                            <Input
                                id="cohort-year"
                                inputMode="numeric"
                                value={value}
                                onChange={(event) =>
                                    setValue(event.target.value)
                                }
                                placeholder="2026"
                            />
                            <FieldDescription>
                                Overstyrer Feide permanent. Medlemmet flyttes
                                til kullgruppa med en gang, og senere
                                innlogginger endrer den ikke tilbake. Tomt felt
                                fjerner kullet.
                            </FieldDescription>
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
                        <Button type="submit" disabled={update.isPending}>
                            Lagre
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
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
