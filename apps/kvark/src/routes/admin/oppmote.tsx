import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CircleCheckBigIcon, InfoIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Badge } from "@tihlde/ui/ui/badge";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Field, FieldLabel } from "@tihlde/ui/ui/field";
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

import {
    getEventRegistrationsQuery,
    getEventsQuery,
    setAttendanceMutation,
} from "#/api/queries/events";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminNoAccess } from "#/components/admin-no-access";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { AdminPageHeader } from "#/components/admin-page-header";
import { AdminStatCard } from "#/components/admin-stat-card";

const STATUS_LABELS: Record<string, string> = {
    registered: "Påmeldt",
    attended: "Møtt",
    no_show: "Ikke møtt",
};

const STATUS_VARIANTS: Record<
    string,
    "default" | "secondary" | "outline" | "destructive"
> = {
    registered: "outline",
    attended: "default",
    no_show: "destructive",
};

export const Route = createFileRoute("/admin/oppmote")({
    component: AttendanceAdminPage,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getEventsQuery(0));
        return { breadcrumbs: "Oppmøte" };
    },
});

function AttendanceAdminPage() {
    const canSetAttendance = useAnyScopePermission([
        "events:update",
        "events:manage",
    ]);
    const { data: events } = useSuspenseQuery(getEventsQuery(0));
    const [eventId, setEventId] = useState<string | null>(
        events.items[0]?.id ?? null,
    );
    const eventOptions = useMemo(
        () =>
            events.items.map((event) => ({
                value: event.id,
                label: event.title,
            })),
        [events.items],
    );

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Oppmøte"
                description="Registrer hvem som møtte opp. Deltakere som fortsatt står som påmeldt når arrangementet er over, kan få prikker for no-show."
            />

            {!canSetAttendance ? (
                <AdminNoAccess action="registrere oppmøte" />
            ) : (
                <>
                    <Alert>
                        <InfoIcon className="size-4" />
                        <AlertTitle>Slik gis no-show-prikker</AlertTitle>
                        <AlertDescription>
                            Huk av dem som møtte opp. Etter at arrangementet er
                            slutt gir systemet automatisk 2 prikker til alle som
                            fortsatt er påmeldt – men kun for arrangementer som
                            kan gi prikker, og kun dersom minst én er huket av.
                        </AlertDescription>
                    </Alert>

                    <Field className="sm:max-w-96">
                        <FieldLabel>Arrangement</FieldLabel>
                        <Select
                            items={eventOptions}
                            value={eventId ?? ""}
                            onValueChange={setEventId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Velg arrangement" />
                            </SelectTrigger>
                            <SelectContent>
                                {eventOptions.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>

                    {eventId ? (
                        <AttendanceSection eventId={eventId} />
                    ) : (
                        <Card>
                            <CardContent>
                                <AdminEmptyState
                                    icon={CircleCheckBigIcon}
                                    title="Ingen arrangementer"
                                    description="Det finnes ingen arrangementer å registrere oppmøte for."
                                />
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}

function AttendanceSection({ eventId }: { eventId: string }) {
    const { data, isPending } = useQuery(
        getEventRegistrationsQuery(eventId, 0, {}, 200),
    );
    const setAttendance = useMutation(setAttendanceMutation);

    const participants = data?.registeredUsers ?? [];

    const stats = useMemo(() => {
        const attended = participants.filter(
            (p) => p.status === "attended",
        ).length;
        return { attended, total: participants.length };
    }, [participants]);

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

    if (participants.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={CircleCheckBigIcon}
                        title="Ingen påmeldte"
                        description="Dette arrangementet har ingen påmeldte deltakere."
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
                <AdminStatCard
                    label="Møtt"
                    value={`${stats.attended} / ${stats.total}`}
                    icon={CircleCheckBigIcon}
                />
                <AdminStatCard
                    label="Påmeldte"
                    value={stats.total}
                    icon={CircleCheckBigIcon}
                />
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Navn</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">
                                    Møtt
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {participants.map((participant) => {
                                const status =
                                    participant.status ?? "registered";
                                return (
                                    <TableRow key={participant.id}>
                                        <TableCell>
                                            {participant.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    STATUS_VARIANTS[status] ??
                                                    "outline"
                                                }
                                            >
                                                {STATUS_LABELS[status] ??
                                                    status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end">
                                                <Checkbox
                                                    checked={
                                                        status === "attended"
                                                    }
                                                    disabled={
                                                        setAttendance.isPending
                                                    }
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        setAttendance.mutate({
                                                            eventId,
                                                            userId: participant.id,
                                                            attended:
                                                                Boolean(
                                                                    checked,
                                                                ),
                                                        })
                                                    }
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
