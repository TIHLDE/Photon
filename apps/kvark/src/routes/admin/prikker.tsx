import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { GavelIcon, InfoIcon, PlusIcon, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Badge } from "@tihlde/ui/ui/badge";
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
import { Textarea } from "@tihlde/ui/ui/textarea";
import type { Fine } from "@tihlde/sdk";

import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminGroupPicker } from "#/components/admin-group-picker";
import { AdminPageHeader } from "#/components/admin-page-header";
import { AdminStatCard } from "#/components/admin-stat-card";
import {
    createFineMutation,
    deleteFineMutation,
    getGroupFinesQuery,
    getGroupsQuery,
    updateFineMutation,
} from "#/api/queries/groups";

const STATUSES = ["pending", "approved", "paid", "rejected"] as const;
type FineStatus = (typeof STATUSES)[number];

const STATUS_LABELS: Record<FineStatus, string> = {
    pending: "Venter",
    approved: "Godkjent",
    paid: "Betalt",
    rejected: "Avvist",
};

const STATUS_VARIANTS: Record<
    FineStatus,
    "default" | "secondary" | "outline" | "destructive"
> = {
    pending: "outline",
    approved: "secondary",
    paid: "default",
    rejected: "destructive",
};

export const Route = createFileRoute("/admin/prikker")({
    component: FinesAdminPage,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getGroupsQuery(0));
        return { breadcrumbs: "Prikker" };
    },
});

function FinesAdminPage() {
    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));
    const [groupSlug, setGroupSlug] = useState<string | null>(
        groups.find((group) => group.finesActivated)?.slug ??
            groups[0]?.slug ??
            null,
    );
    const [createOpen, setCreateOpen] = useState(false);

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Prikker og bøter"
                description="Se og administrer bøter medlemmer har fått i en gruppe."
            />

            <Alert>
                <InfoIcon className="size-4" />
                <AlertTitle>Bøtesystem per gruppe</AlertTitle>
                <AlertDescription>
                    Bøter (prikker) er knyttet til enkeltgrupper. Velg en gruppe
                    for å se, opprette og oppdatere bøtene dens. Grupper som
                    ikke har aktivert bøtesystemet vil normalt være tomme.
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
                    <Button onClick={() => setCreateOpen(true)}>
                        <PlusIcon className="size-4" />
                        Ny bot
                    </Button>
                )}
            </div>

            {groupSlug ? (
                <FinesSection groupSlug={groupSlug} />
            ) : (
                <Card>
                    <CardContent>
                        <AdminEmptyState
                            icon={GavelIcon}
                            title="Velg en gruppe"
                            description="Velg en gruppe for å se bøtene."
                        />
                    </CardContent>
                </Card>
            )}

            {groupSlug && (
                <CreateFineDialog
                    groupSlug={groupSlug}
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                />
            )}
        </div>
    );
}

function FinesSection({ groupSlug }: { groupSlug: string }) {
    const { data: fines, isPending } = useQuery(
        getGroupFinesQuery(groupSlug, 0),
    );
    const update = useMutation(updateFineMutation);
    const remove = useMutation(deleteFineMutation);

    const stats = useMemo(() => {
        const list = fines ?? [];
        const sumFor = (status: FineStatus) =>
            list
                .filter((fine) => fine.status === status)
                .reduce((sum, fine) => sum + fine.amount, 0);
        return {
            pending: sumFor("pending"),
            approved: sumFor("approved"),
            paid: sumFor("paid"),
        };
    }, [fines]);

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

    if (!fines || fines.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={GavelIcon}
                        title="Ingen bøter"
                        description="Denne gruppen har ingen registrerte bøter."
                    />
                </CardContent>
            </Card>
        );
    }

    function handleDelete(fine: Fine) {
        if (window.confirm("Slette denne boten? Dette kan ikke angres.")) {
            remove.mutate({ groupSlug, fineId: fine.id });
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
                <AdminStatCard
                    label="Venter"
                    value={`${stats.pending} kr`}
                    icon={GavelIcon}
                />
                <AdminStatCard
                    label="Godkjent"
                    value={`${stats.approved} kr`}
                    icon={GavelIcon}
                />
                <AdminStatCard
                    label="Betalt"
                    value={`${stats.paid} kr`}
                    icon={GavelIcon}
                />
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Bruker-ID</TableHead>
                                <TableHead>Begrunnelse</TableHead>
                                <TableHead>Beløp</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">
                                    Handlinger
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fines.map((fine) => (
                                <TableRow key={fine.id}>
                                    <TableCell>
                                        <code className="text-xs">
                                            {fine.userId}
                                        </code>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span>{fine.reason}</span>
                                            {fine.defense && (
                                                <span className="text-xs text-muted-foreground">
                                                    Forsvar: {fine.defense}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{fine.amount} kr</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge
                                                variant={
                                                    STATUS_VARIANTS[
                                                        fine.status as FineStatus
                                                    ] ?? "outline"
                                                }
                                            >
                                                {STATUS_LABELS[
                                                    fine.status as FineStatus
                                                ] ?? fine.status}
                                            </Badge>
                                            <Select
                                                items={STATUSES.map(
                                                    (status) => ({
                                                        value: status,
                                                        label: STATUS_LABELS[
                                                            status
                                                        ],
                                                    }),
                                                )}
                                                value={fine.status}
                                                onValueChange={(value) => {
                                                    if (
                                                        !value ||
                                                        value === fine.status
                                                    ) {
                                                        return;
                                                    }
                                                    update.mutate({
                                                        groupSlug,
                                                        fineId: fine.id,
                                                        data: {
                                                            status: value as FineStatus,
                                                        },
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {STATUSES.map((status) => (
                                                        <SelectItem
                                                            key={status}
                                                            value={status}
                                                        >
                                                            {
                                                                STATUS_LABELS[
                                                                    status
                                                                ]
                                                            }
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                disabled={remove.isPending}
                                                onClick={() =>
                                                    handleDelete(fine)
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
        </div>
    );
}

function CreateFineDialog({
    groupSlug,
    open,
    onOpenChange,
}: {
    groupSlug: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [userId, setUserId] = useState("");
    const [reason, setReason] = useState("");
    const [amount, setAmount] = useState("");
    const [defense, setDefense] = useState("");
    const [error, setError] = useState<string | null>(null);

    const create = useMutation(createFineMutation);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        const amountValue = Number(amount);
        if (!Number.isInteger(amountValue) || amountValue <= 0) {
            setError("Beløp må være et positivt heltall.");
            return;
        }
        try {
            await create.mutateAsync({
                groupSlug,
                data: {
                    userId: userId.trim(),
                    groupSlug,
                    reason: reason.trim(),
                    amount: amountValue,
                    defense: defense.trim() || undefined,
                },
            });
            setUserId("");
            setReason("");
            setAmount("");
            setDefense("");
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
                        <DialogTitle>Ny bot</DialogTitle>
                    </DialogHeader>
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="fine-user-id">
                                Bruker-ID
                            </FieldLabel>
                            <Input
                                id="fine-user-id"
                                required
                                value={userId}
                                onChange={(event) =>
                                    setUserId(event.target.value)
                                }
                                placeholder="Feide-/bruker-ID"
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="fine-reason">
                                Begrunnelse
                            </FieldLabel>
                            <Textarea
                                id="fine-reason"
                                required
                                rows={2}
                                value={reason}
                                onChange={(event) =>
                                    setReason(event.target.value)
                                }
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="fine-amount">
                                Beløp (NOK)
                            </FieldLabel>
                            <Input
                                id="fine-amount"
                                type="number"
                                min={1}
                                required
                                value={amount}
                                onChange={(event) =>
                                    setAmount(event.target.value)
                                }
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="fine-defense">
                                Forsvar (valgfritt)
                            </FieldLabel>
                            <Textarea
                                id="fine-defense"
                                rows={2}
                                value={defense}
                                onChange={(event) =>
                                    setDefense(event.target.value)
                                }
                            />
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
                        <Button type="submit" disabled={create.isPending}>
                            Opprett
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
