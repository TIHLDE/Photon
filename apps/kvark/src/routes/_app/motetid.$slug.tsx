import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { HTTPError } from "ky";
import { Suspense } from "react";

import {
    getMotetidEventQuery,
    motetidGoogleConnectMutation,
    motetidSyncCalendarMutation,
    saveMotetidAvailabilityMutation,
} from "#/api/queries/motetid";
import {
    MotetidEventBoard,
    type SyncCalendarResult,
} from "#/components/motetid/event-board";

// The board is publicly viewable via the share link — no auth gate here.
// Logged-out visitors see the heatmap read-only with a login CTA.
export const Route = createFileRoute("/_app/motetid/$slug")({
    component: MotetidEventPage,
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getMotetidEventQuery(params.slug)),
});

async function parseHttpError(
    error: unknown,
): Promise<{ message: string; requiresReconnect: boolean }> {
    if (error instanceof HTTPError) {
        const body = (await error.response
            .clone()
            .json()
            .catch(() => undefined)) as
            | { error?: string; message?: string; requiresReconnect?: boolean }
            | undefined;
        return {
            message: body?.error ?? body?.message ?? "Noe gikk galt.",
            requiresReconnect: Boolean(body?.requiresReconnect),
        };
    }
    return { message: "Noe gikk galt.", requiresReconnect: false };
}

function MotetidEventSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

function MotetidEventBoardContainer() {
    const { slug } = Route.useParams();
    const { data: event } = useSuspenseQuery(getMotetidEventQuery(slug));

    const save = useMutation(saveMotetidAvailabilityMutation);
    const sync = useMutation(motetidSyncCalendarMutation);
    const connect = useMutation(motetidGoogleConnectMutation);

    const shareUrl =
        typeof window !== "undefined"
            ? `${window.location.origin}/motetid/${slug}`
            : `/motetid/${slug}`;

    async function handleSave(
        slots: {
            date: string;
            time: string;
            status: "AVAILABLE" | "IF_NEEDED";
        }[],
    ) {
        try {
            return await save.mutateAsync({
                slug,
                data: { name: event.viewer.name ?? "", slots },
            });
        } catch (error) {
            const { message } = await parseHttpError(error);
            throw new Error(message);
        }
    }

    async function handleSyncCalendar(): Promise<SyncCalendarResult> {
        try {
            const data = await sync.mutateAsync({ slug });
            return { ok: true, blocked: data.blocked, events: data.events };
        } catch (error) {
            const { message, requiresReconnect } = await parseHttpError(error);
            return { ok: false, requiresReconnect, error: message };
        }
    }

    async function handleConnectCalendar(returnTo: string) {
        const { url } = await connect.mutateAsync({ returnTo });
        window.location.assign(url);
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-2xl font-semibold">{event.title}</h1>
                    <Button variant="link" render={<Link to="/motetid" />}>
                        Til mine arrangementer
                    </Button>
                </div>
            </div>

            <MotetidEventBoard
                slug={event.slug}
                shareUrl={shareUrl}
                dates={event.dates}
                startTime={event.startTime}
                endTime={event.endTime}
                slotDuration={event.slotDuration}
                deadline={event.deadline}
                viewer={event.viewer}
                participants={event.participants}
                onSave={handleSave}
                onSyncCalendar={handleSyncCalendar}
                onConnectCalendar={handleConnectCalendar}
            />
        </div>
    );
}

function MotetidEventPage() {
    return (
        <div className="mx-auto w-full max-w-7xl px-3 py-8 sm:px-8">
            <Suspense fallback={<MotetidEventSkeleton />}>
                <MotetidEventBoardContainer />
            </Suspense>
        </div>
    );
}
