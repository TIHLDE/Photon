import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Separator } from "@tihlde/ui/ui/separator";
import { MarkdownView } from "@tihlde/ui/complex/markdown";
import {
    ArrowLeft,
    CalendarDays,
    CalendarPlus,
    Mail,
    MapPin,
    PencilLine,
    QrCode,
    UsersRound,
} from "lucide-react";

import { DetailDateRange } from "#/components/detail-date-range";
import { DetailField } from "#/components/detail-field";
import { DetailHero } from "#/components/detail-hero";
import { DetailIdentity } from "#/components/detail-identity";
import { DetailPage } from "#/components/detail-page";
import { DetailsCard } from "#/components/details-card";
import { EventMap } from "#/components/event-map";
import { EventQrDialog } from "#/components/event-qr-dialog";
import { EventRegistrantsDialog } from "#/components/event-registrants-dialog";
import { EventRegistrationCard } from "#/components/event-registration-card";
import { IconActionButton } from "#/components/icon-action-button";
import { ShareButton } from "#/components/share-button";
import { richRegistry } from "#/components/markdown/directives/presets";
import { buildGoogleCalendarUrl } from "#/lib/calendar-url";
import { getEventBySlug } from "#/mock/events";

export const Route = createFileRoute("/_app/arrangementer/$slug")({
    component: EventDetailPage,
    loader: ({ params }) => {
        const event = getEventBySlug(params.slug);
        if (!event) throw notFound();
        return { event };
    },
});

function EventDetailPage() {
    const { event } = Route.useLoaderData();

    const calendarUrl = buildGoogleCalendarUrl(event);

    return (
        <DetailPage
            back={
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        render={<Link to="/arrangementer" />}
                    >
                        <ArrowLeft />
                        Alle arrangementer
                    </Button>
                </div>
            }
            hero={<DetailHero imageUrl={event.imageUrl} />}
            header={
                <>
                    <div className="flex items-center justify-between gap-2">
                        <DetailIdentity
                            name={event.organizer}
                            logoUrl={event.organizerLogoUrl}
                        />
                        <div className="flex items-center gap-1">
                            <ShareButton label="Del arrangement" />
                            {event.isAdmin ? (
                                <IconActionButton
                                    icon={PencilLine}
                                    label="Rediger arrangement"
                                />
                            ) : null}
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl">{event.title}</h1>

                    <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 lg:flex">
                        <DetailField
                            icon={CalendarDays}
                            value={`${event.start.date}, kl. ${event.start.time}`}
                        />
                        <DetailField icon={MapPin} value={event.location} />
                    </div>
                </>
            }
            sidebar={
                <>
                    <DetailsCard
                        title="Detaljer"
                        items={[
                            <DetailDateRange
                                start={{
                                    date: event.start.date,
                                    time: event.start.time,
                                }}
                                end={{
                                    date: event.end.date,
                                    time: event.end.time,
                                }}
                                action={
                                    <IconActionButton
                                        icon={CalendarPlus}
                                        label="Legg til i kalender"
                                        render={
                                            <a
                                                href={calendarUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            />
                                        }
                                    />
                                }
                            />,
                            [
                                <DetailField
                                    icon={MapPin}
                                    value={event.location}
                                />,
                                <DetailField
                                    icon={Mail}
                                    value={event.contactPerson}
                                />,
                            ],
                        ]}
                    />

                    <EventRegistrationCard
                        registrationState={event.registrationState}
                        registrationOpensAt={event.registrationOpensAt}
                        registrationOpensInLabel={
                            event.registrationOpensInLabel
                        }
                        registrationClosesAt={event.registrationClosesAt}
                        unregisterDeadline={event.unregisterDeadline}
                        capacity={event.capacity}
                        registeredCount={event.registeredCount}
                        waitlistCount={event.waitlistCount}
                        isAdmin={event.isAdmin}
                        price={event.price}
                        headerSlot={
                            event.isAdmin ? (
                                <EventRegistrantsDialog
                                    title={event.title}
                                    registrants={event.registrants}
                                    trigger={
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Se alle påmeldte"
                                        >
                                            <UsersRound />
                                        </Button>
                                    }
                                />
                            ) : null
                        }
                        qrSlot={
                            event.registrationState === "joined" ? (
                                <EventQrDialog
                                    title={event.title}
                                    registrantName="Iver Lindholm"
                                    trigger={
                                        <Button className="w-full">
                                            <QrCode />
                                            Påmeldingsbevis
                                        </Button>
                                    }
                                />
                            ) : null
                        }
                    />

                    {event.mapEmbedUrl ? (
                        <EventMap
                            src={event.mapEmbedUrl}
                            title={`Kart for ${event.title}`}
                        />
                    ) : null}
                </>
            }
            body={
                <>
                    <Separator />
                    <MarkdownView registry={richRegistry} source={event.body} />
                </>
            }
        />
    );
}
