import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Clock, MapPin, Users } from "lucide-react";
import { Page } from "~/components/layout/page";
import { RegistrationCard } from "~/components/registration-card";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { formatDateRange } from "~/lib/date";
import { getEventQuery } from "~/lib/queries/events";

export const Route = createFileRoute("/_main/arrangementer/$id")({
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getEventQuery(params.id)),
    component: EventDetailPage,
});

function EventDetailPage() {
    const { id } = Route.useParams();
    const { data: event } = useSuspenseQuery(getEventQuery(id));

    if (!event) return null;

    return (
        <Page>
            <div className="space-y-6">
                <a
                    href="/arrangementer"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    Tilbake til arrangementer
                </a>

                {event.image && (
                    <img
                        src={event.image}
                        alt={event.title}
                        className="max-h-80 w-full rounded-lg object-cover"
                    />
                )}

                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                    <div className="space-y-6">
                        <header className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">
                                    {event.category.label}
                                </Badge>
                                {event.closed && (
                                    <Badge
                                        variant="outline"
                                        className="text-muted-foreground"
                                    >
                                        Stengt
                                    </Badge>
                                )}
                                {event.isPaidEvent && (
                                    <Badge variant="outline">Betalt</Badge>
                                )}
                            </div>
                            <h1 className="font-heading text-3xl font-bold md:text-4xl">
                                {event.title}
                            </h1>
                        </header>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <Calendar className="size-4" />
                                {formatDateRange(
                                    event.startTime,
                                    event.endTime,
                                )}
                            </span>
                            {event.location && (
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="size-4" />
                                    {event.location}
                                </span>
                            )}
                            {event.organizer && (
                                <span className="flex items-center gap-1.5">
                                    <Users className="size-4" />
                                    {event.organizer.name}
                                </span>
                            )}
                        </div>

                        <Separator />

                        {event.reactions.length > 0 && (
                            <>
                                <Separator />
                                <div className="flex flex-wrap gap-2">
                                    {groupReactions(event.reactions).map(
                                        ([emoji, count]) => (
                                            <span
                                                key={emoji}
                                                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-sm"
                                            >
                                                {emoji}{" "}
                                                <span className="text-muted-foreground">
                                                    {count}
                                                </span>
                                            </span>
                                        ),
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <aside className="space-y-4">
                        <RegistrationCard event={event} />

                        {event.payInfo && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">
                                        Betaling
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1 text-sm text-muted-foreground">
                                    <p>Pris: {event.payInfo.price} kr</p>
                                    <p className="flex items-center gap-1">
                                        <Clock className="size-3.5" />
                                        Betalingsfrist:{" "}
                                        {
                                            event.payInfo
                                                .paymentGracePeriodMinutes
                                        }{" "}
                                        min etter påmelding
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </aside>
                </div>
            </div>
        </Page>
    );
}

function groupReactions(reactions: { emoji: string }[]): [string, number][] {
    const counts = new Map<string, number>();
    for (const r of reactions) {
        counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
