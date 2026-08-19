import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DotSquareIcon, PlusIcon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { Strike } from "@tihlde/sdk";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import {
    Dialog,
    DialogBody,
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
import { Textarea } from "@tihlde/ui/ui/textarea";

import {
    createStrikeMutation,
    deleteStrikeMutation,
    getEventsQuery,
    getStrikesQuery,
} from "#/api/queries/events";
import { Stagger } from "@tihlde/ui/ui/motion";

import { searchUsersQuery } from "#/api/queries/roles";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { useAnyScopePermission } from "#/hooks/use-permission";
import {
    UserSearchCombobox,
    type UserSearchOption,
} from "#/components/user-search-combobox";
import { initials } from "#/lib/utils";

import { avatarImageUrl } from "#/lib/assets";

export const Route = createFileRoute("/admin/prikker")({
    component: StrikesAdminPage,
    loader: () => ({ breadcrumbs: "Prikker" }),
});

function StrikesAdminPage() {
    const canCreate = useAnyScopePermission([
        "events:strikes:create",
        "events:update",
        "events:manage",
    ]);
    const [createOpen, setCreateOpen] = useState(false);

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" />
            }
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <AdminPageHeader
                    title="Prikker"
                    description="Se og administrer prikker medlemmer har fått på arrangementer."
                />
                {canCreate ? (
                    <Button onClick={() => setCreateOpen(true)}>
                        <PlusIcon className="size-4" />
                        Ny prikk
                    </Button>
                ) : null}
            </div>

            <StrikesSection />

            <CreateStrikeDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
            />
        </Stagger>
    );
}

function StrikesSection() {
    const [page, setPage] = useState(0);
    const { data, isPending } = useQuery(getStrikesQuery(page));
    const remove = useMutation(deleteStrikeMutation);
    // Arranging a group's events carries its prikker, so the arrangør sees the
    // delete button too. The API still answers per prikk: the button only
    // works on prikker from their own groups' arrangementer.
    const canDelete = useAnyScopePermission([
        "events:strikes:delete",
        "events:update",
        "events:manage",
    ]);

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

    const strikes = data?.strikes ?? [];

    if (strikes.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={DotSquareIcon}
                        title="Ingen prikker"
                        description="Det er ingen registrerte prikker."
                    />
                </CardContent>
            </Card>
        );
    }

    function handleDelete(strike: Strike) {
        if (window.confirm("Slette denne prikken? Dette kan ikke angres.")) {
            remove.mutate({ strikeId: strike.id });
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Bruker</TableHead>
                                <TableHead>Arrangement</TableHead>
                                <TableHead>Antall</TableHead>
                                <TableHead>Begrunnelse</TableHead>
                                <TableHead>Dato</TableHead>
                                <TableHead className="text-right">
                                    Handlinger
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {strikes.map((strike) => (
                                <TableRow key={strike.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="size-7">
                                                <AvatarImage
                                                    src={avatarImageUrl(
                                                        strike.user.image ??
                                                            undefined,
                                                    )}
                                                />
                                                <AvatarFallback>
                                                    {initials(
                                                        strike.user.name ?? "?",
                                                    )}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span>{strike.user.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{strike.event.title}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            {strike.count}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {strike.reason ?? "—"}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(
                                            strike.createdAt,
                                        ).toLocaleDateString("nb-NO")}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end">
                                            {canDelete ? (
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    disabled={remove.isPending}
                                                    onClick={() =>
                                                        handleDelete(strike)
                                                    }
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {(data?.pages ?? 0) > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <span className="text-sm text-muted-foreground">
                        Side {page + 1} av {data?.pages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => setPage((current) => current - 1)}
                    >
                        Forrige
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={data?.nextPage == null}
                        onClick={() => setPage((current) => current + 1)}
                    >
                        Neste
                    </Button>
                </div>
            )}
        </div>
    );
}

function useDebounced(value: string, delayMs = 200): string {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timeout = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timeout);
    }, [value, delayMs]);
    return debounced;
}

const STRIKE_COUNTS = ["1", "2", "3"] as const;

function CreateStrikeDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [user, setUser] = useState<UserSearchOption | null>(null);
    const [userQuery, setUserQuery] = useState("");
    const [eventId, setEventId] = useState<string | null>(null);
    const [count, setCount] = useState<string>("1");
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string | null>(null);

    const debouncedQuery = useDebounced(userQuery);
    const { data: searchResults, isFetching } = useQuery({
        ...searchUsersQuery(debouncedQuery),
        enabled: debouncedQuery.length >= 2,
    });
    const { data: events } = useQuery(getEventsQuery(0, {}, 100));

    const create = useMutation(createStrikeMutation);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        if (!user) {
            setError("Velg en bruker.");
            return;
        }
        if (!eventId) {
            setError("Velg et arrangement.");
            return;
        }
        try {
            await create.mutateAsync({
                data: {
                    userId: user.id,
                    eventId,
                    count: Number(count),
                    reason: reason.trim() || undefined,
                },
            });
            setUser(null);
            setUserQuery("");
            setEventId(null);
            setCount("1");
            setReason("");
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    const eventItems = (events?.items ?? []).map((item) => ({
        value: item.id,
        label: item.title,
    }));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form
                    onSubmit={handleSubmit}
                    className="flex min-h-0 flex-auto flex-col gap-4"
                >
                    <DialogHeader>
                        <DialogTitle>Ny prikk</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <FieldGroup>
                            <Field>
                                <FieldLabel>Bruker</FieldLabel>
                                <UserSearchCombobox
                                    holder={user}
                                    emptyLabel="Velg bruker"
                                    query={userQuery}
                                    onQueryChange={setUserQuery}
                                    results={searchResults ?? []}
                                    isSearching={isFetching}
                                    onSelect={(selected) => setUser(selected)}
                                    onRemove={
                                        user ? () => setUser(null) : undefined
                                    }
                                    onOpenChange={(isOpen) => {
                                        if (!isOpen) setUserQuery("");
                                    }}
                                />
                            </Field>
                            <Field>
                                <FieldLabel>Arrangement</FieldLabel>
                                <Select
                                    items={eventItems}
                                    value={eventId}
                                    onValueChange={(value) =>
                                        setEventId(value ?? null)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Velg arrangement" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {eventItems.map((item) => (
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
                            <Field>
                                <FieldLabel>Antall prikker</FieldLabel>
                                <Select
                                    items={STRIKE_COUNTS.map((value) => ({
                                        value,
                                        label: value,
                                    }))}
                                    value={count}
                                    onValueChange={(value) => {
                                        if (value) setCount(value);
                                    }}
                                >
                                    <SelectTrigger className="w-24">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STRIKE_COUNTS.map((value) => (
                                            <SelectItem
                                                key={value}
                                                value={value}
                                            >
                                                {value}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="strike-reason">
                                    Begrunnelse (valgfritt)
                                </FieldLabel>
                                <Textarea
                                    id="strike-reason"
                                    rows={2}
                                    value={reason}
                                    onChange={(event) =>
                                        setReason(event.target.value)
                                    }
                                />
                            </Field>
                        </FieldGroup>
                        {error && (
                            <p
                                className="text-sm text-destructive"
                                role="alert"
                            >
                                {error}
                            </p>
                        )}
                    </DialogBody>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Avbryt
                        </Button>
                        <Button type="submit" disabled={create.isPending}>
                            Opprett
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
