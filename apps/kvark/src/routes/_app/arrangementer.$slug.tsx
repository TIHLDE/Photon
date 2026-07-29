import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@tihlde/ui/ui/button";
import {
    ArrowLeft,
    CalendarDays,
    CalendarPlus,
    GraduationCap,
    MapPin,
    PencilLine,
    QrCode,
    UsersRound,
} from "lucide-react";

import { authQueryOptions } from "#/api/auth";
import {
    getEventByIdQuery,
    getEventRegistrationsQuery,
    registerForEventMutation,
    unregisterFromEventMutation,
} from "#/api/queries/events";
import { DetailDateRange } from "#/components/detail-date-range";
import { DetailField } from "#/components/detail-field";
import { DetailHero } from "#/components/detail-hero";
import { DetailIdentity } from "#/components/detail-identity";
import { DetailPage } from "#/components/detail-page";
import { DetailsCard } from "#/components/details-card";
import { EventQrDialog } from "#/components/event-qr-dialog";
import { EventRegistrantsDialog } from "#/components/event-registrants-dialog";
import { EventRegistrationCard } from "#/components/event-registration-card";
import { IconActionButton } from "#/components/icon-action-button";
import { ShareButton } from "#/components/share-button";
import { buildGoogleCalendarUrl } from "#/lib/calendar-url";
import {
    deriveRegistrationState,
    formatEventDate,
    formatEventPrice,
    formatEventTime,
} from "#/lib/event";

export const Route = createFileRoute("/_app/arrangementer/$slug")({
    component: EventDetailPage,
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getEventByIdQuery(params.slug)),
});

const ADMIN_PERMISSIONS = ["events:update", "events:manage", "events:delete"];

function EventDetailPage() {
    const { slug } = Route.useParams();
    const navigate = useNavigate();

    const { data: event } = useSuspenseQuery(getEventByIdQuery(slug));
    const { data: session } = useQuery(authQueryOptions);
    const { data: registrations } = useQuery(
        getEventRegistrationsQuery(event.id, 0),
    );

    const registerMutation = useMutation(registerForEventMutation);
    const unregisterMutation = useMutation(unregisterFromEventMutation);

    const isAdmin = Boolean(
        session?.permissions?.some(
            (p) => ADMIN_PERMISSIONS.includes(p) || p === "root",
        ),
    );

    const registrationState = deriveRegistrationState(
        event.registration,
        event.closed,
    );
    const price = formatEventPrice(event.isPaidEvent, event.payInfo?.price);
    const registeredCount = registrations?.totalCount ?? 0;
    const registrants = (registrations?.registeredUsers ?? []).map((u) => ({
        id: u.id,
        name: u.name,
        allowPhoto: u.allowPhoto,
    }));

    const calendarUrl = buildGoogleCalendarUrl({
        title: event.title,
        location: event.location ?? "",
        start: { iso: event.startTime },
        end: { iso: event.endTime },
    });

    function handleRegister({ allowPhoto }: { allowPhoto: boolean }) {
        if (!session) {
            navigate({ to: "/login", search: { redirectTo: location.href } });
            return;
        }
        registerMutation.mutate({ eventId: event.id, allowPhoto });
    }

    function handleUnregister() {
        unregisterMutation.mutate({ eventId: event.id });
    }

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
            hero={
                <DetailHero
                    imageUrl={event.image ?? undefined}
                    alt={event.imageAlt ?? undefined}
                />
            }
            header={
                <>
                    <div className="flex items-center justify-between gap-2">
                        <DetailIdentity
                            name={event.organizer?.name ?? "TIHLDE"}
                            logoUrl={event.organizer?.image ?? undefined}
                        />
                        <div className="flex items-center gap-1">
                            <ShareButton label="Del arrangement" />
                            {isAdmin ? (
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
                            value={`${formatEventDate(event.startTime)}, kl. ${formatEventTime(event.startTime)}`}
                        />
                        <DetailField
                            icon={MapPin}
                            value={event.location ?? ""}
                        />
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
                                    date: formatEventDate(event.startTime),
                                    time: formatEventTime(event.startTime),
                                }}
                                end={{
                                    date: formatEventDate(event.endTime),
                                    time: formatEventTime(event.endTime),
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
                            <DetailField
                                icon={MapPin}
                                value={event.location ?? ""}
                            />,
                            ...(event.restrictedToInstitute
                                ? [
                                      <DetailField
                                          icon={GraduationCap}
                                          label="Kun for"
                                          value={`Studenter ved ${event.restrictedToInstitute.shortName}`}
                                      />,
                                  ]
                                : []),
                        ]}
                    />

                    <EventRegistrationCard
                        registrationState={registrationState}
                        capacity={null}
                        registeredCount={registeredCount}
                        waitlistCount={0}
                        isAdmin={isAdmin}
                        price={price}
                        onRegister={handleRegister}
                        onUnregister={handleUnregister}
                        waitlistPosition={
                            event.registration?.waitlistPosition ?? undefined
                        }
                        headerSlot={
                            isAdmin ? (
                                <EventRegistrantsDialog
                                    title={event.title}
                                    registrants={registrants}
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
                            registrationState === "joined" ? (
                                <EventQrDialog
                                    title={event.title}
                                    registrantName={
                                        session?.user?.name ?? "Deltaker"
                                    }
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
                </>
            }
        />
    );
}
